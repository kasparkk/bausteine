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
