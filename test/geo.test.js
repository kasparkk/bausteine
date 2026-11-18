import { test } from "node:test";
import assert from "node:assert/strict";
import { nachUtm33, ausUtm33, entfernung, peilung, himmelsrichtung, utmPaar, gradPaar } from "../geo.js";

// Referenzwerte aus pyproj (EPSG:4326 -> EPSG:25833)
const referenz = [
  [52.5163, 13.3777, 389917.83, 5819701.92],
  [52.8, 14.2, 446064.41, 5850322.49],
  [51.0, 12.0, 289511.14, 5654109.18],
];

test("nachUtm33 stimmt mit pyproj ueberein (< 5 cm)", () => {
  for (const [b, l, x, y] of referenz) {
    const r = nachUtm33(b, l);
    assert.ok(Math.abs(r.x - x) < 0.05, `x ${r.x} vs ${x}`);
    assert.ok(Math.abs(r.y - y) < 0.05, `y ${r.y} vs ${y}`);
  }
});

test("ausUtm33 ist die Umkehrung (< 1 cm)", () => {
  for (const [b, l] of referenz) {
    const { x, y } = nachUtm33(b, l);
    const r = ausUtm33(x, y);
    assert.ok(entfernung(b, l, r.breite, r.laenge) < 0.01);
  }
});

test("nachUtm33 lehnt Unsinn ab", () => {
  assert.equal(nachUtm33(NaN, 13), null);
  assert.equal(nachUtm33(52, 40), null);
});

test("entfernung: 1 Grad Breite ~ 111,2 km", () => {
  assert.ok(Math.abs(entfernung(52, 13, 53, 13) - 111195) < 50);
});

test("peilung und himmelsrichtung", () => {
  assert.ok(Math.abs(peilung(52, 13, 53, 13)) < 1e-9);
  assert.equal(himmelsrichtung(peilung(52, 13, 52, 14)), "O");
  assert.equal(himmelsrichtung(359), "N");
});

test("Paare als Text", () => {
  assert.equal(utmPaar(52.5163, 13.3777), "389917.83, 5819701.92");
  assert.equal(gradPaar(52.5, 13.25), "52.500000, 13.250000");
  assert.equal(utmPaar(null, 13), "");
});

test("Raender des Bereichs: pyproj-Abweichung unter 0,5 m, Hin und zurueck exakt", () => {
  const rand = [
    [47, 3, -411804.96, 5275495.42],
    [55, 27, 1265669.98, 6160873.07],
    [50, 6, -144535.63, 5577555.96],
  ];
  for (const [b, l, x, y] of rand) {
    const r = nachUtm33(b, l);
    assert.ok(Math.hypot(r.x - x, r.y - y) < 0.5, `${b}/${l}`);
    const z = ausUtm33(r.x, r.y);
    assert.ok(entfernung(b, l, z.breite, z.laenge) < 0.05, `zurueck ${b}/${l}`);
  }
  assert.ok(Math.abs(nachUtm33(52.5, 15).x - 500000) < 0.01, "Mittelmeridian bei x = 500000");
  assert.equal(nachUtm33(52, 2.9), null);
});

test("ausUtm33 lehnt unmoegliche Werte ab", () => {
  assert.equal(ausUtm33(-600000, 5800000), null);
  assert.equal(ausUtm33(400000, -1), null);
  assert.equal(ausUtm33(5800000, 400000), null, "vertauschte Werte");
});

test("leere Eingaben erfinden keinen Punkt", () => {
  assert.equal(utmPaar("", ""), "");
  assert.equal(gradPaar("", 13), "");
  assert.equal(gradPaar(undefined, 13), "");
  assert.equal(gradPaar("52.5", "13.25"), "52.500000, 13.250000");
});

test("himmelsrichtung ohne Zahl", () => {
  assert.equal(himmelsrichtung(NaN), "");
  assert.equal(himmelsrichtung(-90), "W");
  assert.equal(himmelsrichtung(337.4), "NW");
  assert.equal(himmelsrichtung(337.6), "N");
});
