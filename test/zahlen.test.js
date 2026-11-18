import { test } from "node:test";
import assert from "node:assert/strict";
import { nk } from "../zahlen.js";

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
