import { test } from "node:test";
import assert from "node:assert/strict";
import { nk, alsZahl } from "../zahlen.js";

test("deutsches Format mit fester Stellenzahl", () => {
  assert.equal(nk(12.5), "12,5");
  assert.equal(nk(3, 2), "3,00");
  assert.equal(nk(1234.567, 1), "1.234,6");
  assert.equal(nk("7", 0), "7");
});

test("anderes Gebietsschema", () => {
  assert.equal(nk(1234.5, 1, "en-GB"), "1,234.5");
});

test("fehlende Werte werden zum Strich", () => {
  for (const w of [null, undefined, "", NaN, Infinity, "abc"]) assert.equal(nk(w), "–");
  assert.equal(nk(0), "0,0", "eine echte Null bleibt eine Null");
});

test("kein Minus vor einer gerundeten Null", () => {
  assert.equal(nk(-0.04, 1), "0,0");
  assert.equal(nk(-0, 0), "0");
  assert.equal(nk(-0.06, 1), "-0,1");
  assert.equal(nk(-0.004, 2, "en-GB"), "0.00");
});

test("alsZahl: nur Zahlen und nicht-leerer Text", () => {
  for (const w of [null, undefined, "", "  ", false, true, [], {}]) assert.ok(Number.isNaN(alsZahl(w)), String(w));
  assert.equal(alsZahl(" 12.5 "), 12.5);
  assert.equal(alsZahl(0), 0);
  assert.equal(nk(" "), "–");
});

test("gerundete Null ohne Minus auch mit typografischem Minus", () => {
  assert.equal(nk(-0.04, 1, "sv-SE"), "0,0");
  assert.equal(nk(-0.04, 1, "fi-FI"), "0,0");
  assert.equal(nk(-0.06, 1, "sv-SE"), "\u22120,1");
});

test("leseZahl: Komma und Punkt, Ersatz bei Unlesbarem", async () => {
  const { leseZahl } = await import("../zahlen.js");
  assert.equal(leseZahl("12,5"), 12.5);
  assert.equal(leseZahl("12.5"), 12.5);
  assert.equal(leseZahl(" 7 "), 7);
  assert.equal(leseZahl("12,5 m"), 12.5);
  assert.equal(leseZahl(3), 3);
  for (const w of [null, undefined, "", "abc"]) assert.equal(leseZahl(w), 0);
  assert.ok(Number.isNaN(leseZahl("", NaN)));
});
