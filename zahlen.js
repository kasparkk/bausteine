/* Baustein zahlen: Zahlen mit fester Nachkommastellenzahl formatieren.
   Herkunft: die sieben "nk"-Kopien in Monitoring-App-f-r-willi und
   verj-ngungsaufnahme2. Die Kopien unterschieden sich nur im Standardwert
   fuer "stellen" und darin, ob das Gebietsschema fest "de-DE" war oder aus
   der Spracheinstellung kam - beides ist hier ein Parameter.

   Fehlt der Wert (null, undefined, "", keine Zahl), kommt "–" heraus statt
   "0,0" oder "NaN": eine erfundene Null waere irrefuehrender als ein Strich.
   Ein Wert, der auf null gerundet wird, erscheint ohne Minuszeichen. */

export const FEHLT = "–";

/* Eingabe als Zahl. Nur Zahlen und nicht-leerer Text zaehlen; alles andere
   (null, undefined, "", "  ", false, [] ...) ist "kein Wert" (NaN).
   Number("") oder Number(false) waere sonst 0 - eine erfundene Null, bei
   Koordinaten sogar ein Punkt am Aequator. */
export const alsZahl = (wert) =>
  typeof wert === "number" ? wert
  : typeof wert === "string" && wert.trim() !== "" ? Number(wert)
  : NaN;

export const nk = (wert, stellen = 1, ort = "de-DE") => {
  let zahl = alsZahl(wert);
  if (!Number.isFinite(zahl)) return FEHLT;
  // Was auf null gerundet wird, als echte Null formatieren - sonst ergibt
  // -0,04 "-0,0" (in manchen Sprachen mit typografischem Minus).
  if (Number(zahl.toFixed(stellen)) === 0) zahl = 0;
  return zahl.toLocaleString(ort, {
    minimumFractionDigits: stellen,
    maximumFractionDigits: stellen,
  });
};

/* Eingetippte Zahl lesen, deutsch oder englisch: "12,5" und "12.5" ergeben
   12.5. Was sich nicht lesen laesst (leer, Text), ergibt ersatz - fuer
   Eingabefelder, in denen ein leeres Feld als 0 zaehlen soll.
   Wie parseFloat: fuehrende Zahl zaehlt ("12,5 m" -> 12.5); nur das erste
   Komma wird zum Punkt, Tausenderpunkte ("1.234,5") werden nicht erkannt. */
export const leseZahl = (wert, ersatz = 0) => {
  const zahl = parseFloat(String(wert ?? "").replace(",", "."));
  return Number.isFinite(zahl) ? zahl : ersatz;
};
