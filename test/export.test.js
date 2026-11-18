import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { baueXlsx, baueXlsxMehrblatt, baueCsv, weitergeben } from "../export.js";

const alsDatei = async (blob) => {
  const pfad = join(mkdtempSync(join(tmpdir(), "bs-")), "t.xlsx");
  writeFileSync(pfad, Buffer.from(await blob.arrayBuffer()));
  return pfad;
};

test("xlsx ist ein gueltiges ZIP mit den noetigen Teilen", async () => {
  const blob = baueXlsx([["Art", "Anzahl"], ["Kiefer", 12], ["Eiche & Co <x>", 3.5]], "Ergebnis");
  const pfad = await alsDatei(blob);
  const liste = execFileSync("unzip", ["-Z1", pfad]).toString();
  for (const teil of ["[Content_Types].xml", "xl/workbook.xml", "xl/worksheets/sheet1.xml"]) {
    assert.ok(liste.includes(teil), teil);
  }
  execFileSync("unzip", ["-tq", pfad]); // wirft bei kaputter Pruefsumme
  const blatt = execFileSync("unzip", ["-p", pfad, "xl/worksheets/sheet1.xml"]).toString();
  assert.ok(blatt.includes("<v>12</v>"), "Zahl bleibt Zahl");
  assert.ok(blatt.includes("Eiche &amp; Co &lt;x&gt;"), "Text wird maskiert");
});

test("Blattnamen werden gesaeubert und eindeutig", async () => {
  const blob = baueXlsxMehrblatt([
    { name: "A/B", zeilen: [[1]] },
    { name: "a b", zeilen: [[2]] },
    { name: "leer", zeilen: [] },
  ]);
  const pfad = await alsDatei(blob);
  const wb = execFileSync("unzip", ["-p", pfad, "xl/workbook.xml"]).toString();
  assert.ok(wb.includes('name="A B"') && wb.includes('name="a b 2"'));
  assert.ok(!wb.includes("leer"), "leere Blaetter fallen weg");
});

test("CSV im deutschen Excel-Format", () => {
  const csv = baueCsv([["Art", "Wert"], ["Kiefer; jung", 1.5], [null, 'a"b']]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.equal(csv.slice(1), 'Art;Wert\r\n"Kiefer; jung";1,5\r\n;"a""b"');
});

test("weitergeben: Download, wenn Teilen nicht geht", async () => {
  const geklickt = [];
  globalThis.navigator ??= {};
  globalThis.document = {
    createElement: () => ({ click() { geklickt.push(this.download); } }),
    body: { appendChild() {}, removeChild() {} },
  };
  URL.createObjectURL = () => "blob:x";
  URL.revokeObjectURL = () => {};
  const r = await weitergeben(new Blob(["x"]), "a.csv", "T");
  assert.equal(r, "gespeichert");
  assert.deepEqual(geklickt, ["a.csv"]);
});

test("weitergeben: Teilen-Menue und Abbruch", async () => {
  Object.defineProperty(globalThis, "navigator", { value: { canShare: () => true, share: async () => {} }, configurable: true });
  assert.equal(await weitergeben(new Blob(["x"]), "a.csv", "T"), "geteilt");
  globalThis.navigator.share = async () => { const e = new Error("x"); e.name = "AbortError"; throw e; };
  assert.equal(await weitergeben(new Blob(["x"]), "a.csv", "T"), "abgebrochen");
});

test("Sonderfaelle in Excel-Zellen", async () => {
  const lang = "&".repeat(40000);
  const blob = baueXlsx([[NaN, Infinity, true, false, "  rand  ", new Date("2026-11-18T10:00:00Z"), lang, "a\u0001b"]]);
  const pfad = await alsDatei(blob);
  execFileSync("unzip", ["-tq", pfad]);
  const blatt = execFileSync("unzip", ["-p", pfad, "xl/worksheets/sheet1.xml"]).toString();
  assert.ok(!blatt.includes("NaN") && !blatt.includes("Infinity"));
  assert.ok(blatt.includes('t="b"><v>1</v>') && blatt.includes('t="b"><v>0</v>'));
  assert.ok(blatt.includes('xml:space="preserve">  rand  <'));
  assert.ok(blatt.includes("2026-11-18T10:00:00.000Z"));
  assert.ok(blatt.includes("ab") && !blatt.includes("\u0001"));
  const zelle = blatt.match(/(&amp;)+/)[0];
  assert.equal(zelle.length / 5, 32767, "auf 32767 Zeichen gekuerzt, ohne Maskierung zu zerschneiden");
});

test("Blattname mit Apostroph am Rand", async () => {
  const pfad = await alsDatei(baueXlsxMehrblatt([{ name: "'Ergebnis'", zeilen: [[1]] }, { name: "'''", zeilen: [[2]] }]));
  const wb = execFileSync("unzip", ["-p", pfad, "xl/workbook.xml"]).toString();
  assert.ok(wb.includes('name="Ergebnis"') && wb.includes('name="Tabelle2"'));
});

test("CSV: Zeilenumbruch, NaN und Datum", () => {
  const csv = baueCsv([["a\rb", NaN, new Date("2026-01-02T00:00:00Z")]]);
  assert.equal(csv.slice(1), '"a\rb";;2026-01-02T00:00:00.000Z');
});

const wohlgeformt = (pfad, teil) => {
  // unzip liest [ ] als Muster, deshalb maskieren
  const xml = execFileSync("unzip", ["-p", pfad, teil.replace(/[[\]]/g, "\\$&")]);
  execFileSync("xmllint", ["--noout", "-"], { input: xml }); // wirft bei kaputtem XML
};

test("alle XML-Teile sind wohlgeformt, auch mit verbotenen Zeichen", async () => {
  const pfad = await alsDatei(
    baueXlsxMehrblatt([
      { name: "\u0001", zeilen: [["a\uFFFEb\uFFFF", "\u0001x", "<&>"]] },
      { name: "\u0002", zeilen: [[1]] },
      { name: "History", zeilen: [[2]] },
    ]),
  );
  const liste = execFileSync("unzip", ["-Z1", pfad]).toString().trim().split("\n");
  for (const teil of liste) wohlgeformt(pfad, teil);
  const wb = execFileSync("unzip", ["-p", pfad, "xl/workbook.xml"]).toString();
  assert.ok(wb.includes('name="Tabelle1"') && wb.includes('name="Tabelle2"'), "leere Namen bekommen Ersatz");
  assert.ok(wb.includes('name="History 2"'), "reservierter Name");
});

test("gleiche Blattnamen werden durchnummeriert", async () => {
  const pfad = await alsDatei(baueXlsxMehrblatt(["a", "a", "a", "A 2"].map((name) => ({ name, zeilen: [[1]] }))));
  const wb = execFileSync("unzip", ["-p", pfad, "xl/workbook.xml"]).toString();
  const namen = [...wb.matchAll(/name="([^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual(namen, ["a", "a 2", "a 3", "A 2 2"]);
});

test("ungueltiges Datum und fehlende Zeile brechen nichts ab", async () => {
  assert.equal(baueCsv([[new Date("x"), 1]]).slice(1), ";1");
  const pfad = await alsDatei(baueXlsx([[new Date("x")], undefined, ["ok"]]));
  wohlgeformt(pfad, "xl/worksheets/sheet1.xml");
});

test("weitergeben: anderer Fehler beim Teilen -> Download", async () => {
  const vorher = globalThis.navigator;
  const geklickt = [];
  globalThis.document = {
    createElement: () => ({ click() { geklickt.push([this.download, this.href]); } }),
    body: { appendChild() {}, removeChild() {} },
  };
  URL.createObjectURL = () => "blob:y";
  URL.revokeObjectURL = () => {};
  Object.defineProperty(globalThis, "navigator", {
    value: { canShare: () => true, share: async () => { const e = new Error("x"); e.name = "NotAllowedError"; throw e; } },
    configurable: true,
  });
  try {
    assert.equal(await weitergeben(new Blob(["x"]), "b.xlsx", "T"), "gespeichert");
    assert.deepEqual(geklickt, [["b.xlsx", "blob:y"]]);
  } finally {
    Object.defineProperty(globalThis, "navigator", { value: vorher, configurable: true });
  }
});
