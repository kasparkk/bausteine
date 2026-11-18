/* Baustein export: Tabellen als Excel- oder CSV-Datei und das Weitergeben
   einer fertigen Datei (Teilen-Menue, sonst Download).
   Herkunft: xlsx.js (identisch in verj-ngungsaufnahme2 und
   Monitoring-App-f-r-willi), baueCsv aus monitoring/export.js und die fuenf
   gleichen "weitergeben"-Funktionen in den Ansichten.

   Erzeugt eine echte Excel-Datei (.xlsx) - ohne Zusatzbibliothek.

   Warum selbst gebaut: Eine .xlsx ist nur ein ZIP mit ein paar XML-Dateien.
   Fertige Bibliotheken dafuer sind mehrere hundert Kilobyte gross; die App
   soll im Wald aber schnell und offline starten. Hier wird deshalb genau das
   Minimum geschrieben, das Excel braucht - ein oder mehrere Blaetter mit
   Text, Zahlen und Wahrheitswerten, keine Formatierung. Datumsangaben werden
   als ISO-Text in UTC geschrieben (kein Excel-Datum).

   Der ZIP-Teil legt die Dateien unkomprimiert ab ("store"). Das ist erlaubt,
   spart eine Kompressionsroutine und faellt bei diesen Datenmengen nicht auf. */

const XML_KOPF = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

// Namensraeume und Typen des Office-Formats, jeweils einmal hinterlegt.
const NS_TABELLE = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const NS_PAKET_BEZUG = "http://schemas.openxmlformats.org/package/2006/relationships";
const NS_DOK_BEZUG = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const TYP_OFFICE = "application/vnd.openxmlformats-officedocument.spreadsheetml";

const XML_ZEICHEN = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };

// In XML verbotene Zeichen: Steuerzeichen und die "Nicht-Zeichen" U+FFFE/FFFF.
const XML_VERBOTEN = /[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFE\uFFFF]/g;
const ohneVerbotene = (text) => String(text).replace(XML_VERBOTEN, "");

function xmlText(wert) {
  return ohneVerbotene(wert).replace(/[&<>"']/g, (z) => XML_ZEICHEN[z]);
}

/* Datum als Text; ein ungueltiges Datum (z. B. new Date(undefined) aus
   einem leeren Feld) wird leer statt die ganze Ausgabe abzubrechen. */
const datumText = (d) => (Number.isNaN(d.getTime()) ? "" : d.toISOString());

// Spaltennummer -> Buchstaben (1 -> A, 27 -> AA)
function spaltenName(nr) {
  let name = "";
  while (nr > 0) {
    const rest = (nr - 1) % 26;
    name = String.fromCharCode(65 + rest) + name;
    nr = Math.floor((nr - rest) / 26);
  }
  return name;
}

function blattXml(zeilen) {
  const inhalt = zeilen
    .map((zeile, zi) => {
      const zellen = (Array.isArray(zeile) ? zeile : [])
        .map((wert, si) => {
          const pos = `${spaltenName(si + 1)}${zi + 1}`;
          if (wert === null || wert === undefined || wert === "") return "";
          // Zahlen als Zahl, damit in Excel gerechnet werden kann.
          if (typeof wert === "number") {
            // NaN und Unendlich kennt Excel nicht - lieber eine leere Zelle.
            return Number.isFinite(wert) ? `<c r="${pos}"><v>${wert}</v></c>` : "";
          }
          if (typeof wert === "boolean") {
            return `<c r="${pos}" t="b"><v>${wert ? 1 : 0}</v></c>`;
          }
          // Excel fasst hoechstens 32767 Zeichen je Zelle (vor dem Maskieren kuerzen).
          const roh = wert instanceof Date ? datumText(wert) : String(wert);
          const text = xmlText(roh.slice(0, 32767));
          // xml:space, sonst schneidet Excel Leerzeichen am Rand ab.
          return `<c r="${pos}" t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`;
        })
        .join("");
      return `<row r="${zi + 1}">${zellen}</row>`;
    })
    .join("");

  return (
    `${XML_KOPF}<worksheet xmlns="${NS_TABELLE}">` +
    `<sheetData>${inhalt}</sheetData></worksheet>`
  );
}

// --- ZIP ------------------------------------------------------------------

const CRC_TABELLE = (() => {
  const tabelle = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let wert = i;
    for (let bit = 0; bit < 8; bit++) {
      wert = wert & 1 ? 0xedb88320 ^ (wert >>> 1) : wert >>> 1;
    }
    tabelle[i] = wert >>> 0;
  }
  return tabelle;
})();

function crc32(bytes) {
  let wert = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    wert = CRC_TABELLE[(wert ^ bytes[i]) & 0xff] ^ (wert >>> 8);
  }
  return (wert ^ 0xffffffff) >>> 0;
}

/* Die Felder ab "benoetigte Version" bis "Laenge Zusatzfeld" stehen im
   lokalen Kopf und im zentralen Verzeichnis gleich - nur an anderer Stelle. */
function gemeinsameFelder(sicht, ab, pruefsumme, groesse, nameLaenge) {
  sicht.setUint16(ab, 20, true); // benoetigte Version
  sicht.setUint16(ab + 2, 0, true); // Flags
  sicht.setUint16(ab + 4, 0, true); // Verfahren: unkomprimiert
  sicht.setUint16(ab + 6, 0, true); // Uhrzeit
  sicht.setUint16(ab + 8, 0x0021, true); // Datum (01.01.1980)
  sicht.setUint32(ab + 10, pruefsumme, true);
  sicht.setUint32(ab + 14, groesse, true); // gepackt
  sicht.setUint32(ab + 18, groesse, true); // ungepackt
  sicht.setUint16(ab + 22, nameLaenge, true);
  sicht.setUint16(ab + 24, 0, true); // Zusatzfeld
}

function zipBauen(dateien) {
  const kodierer = new TextEncoder();
  const stuecke = [];
  const zentral = [];
  let versatz = 0;

  for (const datei of dateien) {
    const name = kodierer.encode(datei.name);
    const daten = kodierer.encode(datei.inhalt);
    const pruefsumme = crc32(daten);

    // Lokaler Kopf: Signatur, gemeinsame Felder, Name
    const kopf = new Uint8Array(30 + name.length);
    const k = new DataView(kopf.buffer);
    k.setUint32(0, 0x04034b50, true);
    gemeinsameFelder(k, 4, pruefsumme, daten.length, name.length);
    kopf.set(name, 30);
    stuecke.push(kopf, daten);

    // Eintrag im zentralen Verzeichnis; Kommentar, Datentraeger und
    // Attribute bleiben 0 (neue Arrays sind schon genullt).
    const eintrag = new Uint8Array(46 + name.length);
    const e = new DataView(eintrag.buffer);
    e.setUint32(0, 0x02014b50, true);
    e.setUint16(4, 20, true); // erzeugt von Version
    gemeinsameFelder(e, 6, pruefsumme, daten.length, name.length);
    e.setUint32(42, versatz, true);
    eintrag.set(name, 46);
    zentral.push(eintrag);

    versatz += kopf.length + daten.length;
  }

  // Abschluss des zentralen Verzeichnisses
  const schluss = new Uint8Array(22);
  const s = new DataView(schluss.buffer);
  s.setUint32(0, 0x06054b50, true);
  s.setUint16(8, dateien.length, true);
  s.setUint16(10, dateien.length, true);
  s.setUint32(12, zentral.reduce((summe, z) => summe + z.length, 0), true);
  s.setUint32(16, versatz, true);

  return new Blob([...stuecke, ...zentral, schluss], { type: `${TYP_OFFICE}.sheet` });
}

/* Baut aus Zeilen (Array von Arrays; Zahlen bleiben Zahlen) eine .xlsx.
   blattName landet als Reiterbeschriftung in Excel. */
export function baueXlsx(zeilen, blattName = "Tabelle1") {
  return baueXlsxMehrblatt([{ name: blattName, zeilen }]);
}

/* Mehrere Blaetter in einer Datei.

   Gebraucht fuer die Auswertung ueber alle Personen: dort gehoeren die
   fertige Auswertung, die Einzeleintraege und die Probekreise mit ihren
   Koordinaten zusammen in eine Datei, aber nicht in dieselbe Tabelle - je
   Blatt eine Zeilenart, sonst wird nichts davon auswertbar.

   blaetter = [{ name, zeilen }]                                          */
export function baueXlsxMehrblatt(blaetter) {
  const gueltig = blaetter.filter((b) => b.zeilen?.length);
  const teile = gueltig.length ? gueltig : [{ name: "Tabelle1", zeilen: [[""]] }];

  /* Excel verweigert die Datei bei doppelten, leeren oder zu langen
     Blattnamen, bei den Zeichen : \ / ? * [ ], bei einem Apostroph am Rand
     und beim reservierten Namen "History" - deshalb hier vorsorglich
     saeubern. Doppelte bekommen eine Nummer: a, a 2, a 3. */
  const vergeben = new Set(["history"]);
  const namen = teile.map((b, i) => {
    const basis =
      ohneVerbotene(b.name ?? "")
        .replace(/[:\\/?*\[\]]/g, " ")
        .slice(0, 31)
        .trim()
        .replace(/^'+|'+$/g, "") || `Tabelle${i + 1}`;
    let name = basis;
    for (let zaehler = 2; vergeben.has(name.toLowerCase()); zaehler++) {
      const anhang = ` ${zaehler}`;
      name = basis.slice(0, 31 - anhang.length) + anhang;
    }
    vergeben.add(name.toLowerCase());
    return name;
  });

  // Fuer jedes Blatt ein Stueck XML; Blaetter zaehlen ab 1.
  const jeBlatt = (stueck) => teile.map((_, i) => stueck(i + 1)).join("");
  const bezuege = (eintraege) =>
    `${XML_KOPF}<Relationships xmlns="${NS_PAKET_BEZUG}">${eintraege}</Relationships>`;

  const dateien = [
    {
      name: "[Content_Types].xml",
      inhalt:
        `${XML_KOPF}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="${TYP_OFFICE}.sheet.main+xml"/>` +
        jeBlatt((n) => `<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="${TYP_OFFICE}.worksheet+xml"/>`) +
        `</Types>`,
    },
    {
      name: "_rels/.rels",
      inhalt: bezuege(
        `<Relationship Id="rId1" Type="${NS_DOK_BEZUG}/officeDocument" Target="xl/workbook.xml"/>`,
      ),
    },
    {
      name: "xl/workbook.xml",
      inhalt:
        `${XML_KOPF}<workbook xmlns="${NS_TABELLE}" xmlns:r="${NS_DOK_BEZUG}"><sheets>` +
        jeBlatt((n) => `<sheet name="${xmlText(namen[n - 1])}" sheetId="${n}" r:id="rId${n}"/>`) +
        `</sheets></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      inhalt: bezuege(
        jeBlatt((n) => `<Relationship Id="rId${n}" Type="${NS_DOK_BEZUG}/worksheet" Target="worksheets/sheet${n}.xml"/>`),
      ),
    },
    ...teile.map((blatt, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, inhalt: blattXml(blatt.zeilen) })),
  ];

  return zipBauen(dateien);
}

/* CSV fuer den deutschen Excel-Import: Semikolon als Trenner, Komma als
   Dezimalzeichen, BOM voran, damit Umlaute nicht zerfallen.
   Bewusst nicht gegen "Formeln" in Textfeldern geschuetzt (Text, der mit
   = + - @ beginnt): die Daten stammen vom eigenen Team, und ein vorgesetztes
   Apostroph wuerde in Excel sichtbar und Werte wie "-5 cm" verfaelschen.
   zeilen = Array von Arrays; liefert Text. */
export function baueCsv(zeilen) {
  const feld = (wert) => {
    if (typeof wert === "number") return Number.isFinite(wert) ? String(wert).replace(".", ",") : "";
    const text = wert instanceof Date ? datumText(wert) : String(wert ?? "");
    return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return "\uFEFF" + zeilen.map((z) => z.map(feld).join(";")).join("\r\n");
}

/* Eine fertige Datei loswerden: erst ueber das Teilen-Menue des Handys,
   sonst als Download.

   Hinweis: Chrome auf Android teilt nur bestimmte Dateitypen (u. a. CSV mit
   type "text/csv", PDF, Text, Bilder) - eine .xlsx geht dort immer den Weg
   ueber den Download. Das ist so gewollt und funktioniert.

   Liefert "geteilt", "gespeichert" oder "abgebrochen" (Nutzer hat das
   Teilen-Menue geschlossen - kein Fehler). Scheitert auch der Download,
   wird der Fehler weitergeworfen, damit die App einen Ausweg anbieten kann. */
export async function weitergeben(blob, name, titel) {
  try {
    const datei = new File([blob], name, { type: blob.type });
    if (navigator.canShare?.({ files: [datei] })) {
      await navigator.share({ files: [datei], title: titel });
      return "geteilt";
    }
  } catch (fehler) {
    if (fehler?.name === "AbortError") return "abgebrochen";
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Erst spaeter freigeben: manche Browser (v. a. Safari) brechen den
  // Download sonst ab, weil die Adresse schon weg ist, bevor er beginnt.
  const uhr = setTimeout(() => URL.revokeObjectURL(url), 10000);
  uhr?.unref?.(); // haelt unter Node (Tests) den Prozess nicht auf
  return "gespeichert";
}
