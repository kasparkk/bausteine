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
