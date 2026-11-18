import { test } from "node:test";
import assert from "node:assert/strict";
import { alsZahl } from "../zahlen.js";
import { nachUtm, ausUtm, utmZone, nachUtm33, ausUtm33, entfernung, peilung, himmelsrichtung, utmPaar, gradPaar } from "../geo.js";

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

test("Rueckweg passt im ganzen Bereich zum Hinweg", () => {
  for (let b = 0.5; b <= 84; b += 4.1) for (let l = 3; l <= 27; l += 1.7) {
    const r = nachUtm33(b, l);
    const z = ausUtm33(r.x, r.y);
    assert.ok(z && entfernung(b, l, z.breite, z.laenge) < 0.01, `${b}/${l}`);
  }
});

test("ausUtm33 lehnt unmoegliche Werte ab", () => {
  assert.equal(ausUtm33(-1000000, 5800000), null);
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

// 25 zufaellige Punkte in Brandenburg, Referenz aus pyproj (EPSG:4326 -> 25833)
const BRANDENBURG = [
  [52.04482, 11.74306, 276661.891, 5771030.77],
  [52.79715, 11.46077, 261410.004, 5855578.174],
  [52.53253, 12.51648, 331549.176, 5823168.833],
  [51.4334, 13.02677, 362839.175, 5699869.432],
  [51.38624, 12.76112, 344215.347, 5695156.466],
  [51.46067, 11.52657, 258725.229, 5706778.668],
  [52.27639, 14.17667, 443827.19, 5792099.063],
  [51.58474, 12.00366, 292423.271, 5719107.945],
  [52.7431, 14.61175, 473790.06, 5843763.823],
  [52.62734, 12.62805, 339462.397, 5833457.94],
  [53.54539, 11.3677, 259365.181, 5939082.068],
  [53.27448, 12.24259, 316145.074, 5906352.001],
  [51.63179, 11.62405, 266373.503, 5725485.294],
  [52.00951, 14.13805, 440839.741, 5762446.664],
  [51.71567, 13.29376, 382129.079, 5730792.804],
  [52.7695, 12.54063, 334086.736, 5849465.729],
  [52.55981, 11.42604, 257758.922, 5829306.968],
  [51.43708, 11.94145, 287427.896, 5702869.974],
  [52.86492, 12.73933, 347823.2, 5859638.063],
  [52.02254, 13.30802, 383907.079, 5764896.536],
  [52.34232, 12.27916, 314658.58, 5802598.21],
  [53.12707, 13.71638, 414110.918, 5887175.877],
  [51.86142, 13.26793, 380729.925, 5747043.25],
  [52.50795, 14.35049, 455917.465, 5817734.557],
  [52.97772, 12.23658, 314470.141, 5873365.413]
];

test("Brandenburg: Hin- und Rueckweg gegen pyproj unter 1 cm", () => {
  for (const [b, l, x, y] of BRANDENBURG) {
    const r = nachUtm33(b, l);
    assert.ok(Math.hypot(r.x - x, r.y - y) < 0.01, `hin ${b}/${l}`);
    const z = ausUtm33(x, y);
    assert.ok(entfernung(b, l, z.breite, z.laenge) < 0.01, `zurueck ${b}/${l}`);
  }
});

test("ausUtm33 erfindet keine Punkte ausserhalb des Bereichs", () => {
  assert.equal(ausUtm33(1900000, 9400000), null);
  assert.equal(ausUtm33(1389917, 5819701), null, "Rechtswert mit einer Ziffer zu viel");
  for (let x = -900000; x <= 1900000; x += 70000) for (let y = 0; y <= 9400000; y += 235000) {
    const z = ausUtm33(x, y);
    if (z) assert.ok(z.breite > -1e-6 && z.breite < 84 + 1e-6 && z.laenge > 3 - 1e-6 && z.laenge < 27 + 1e-6, `${x}/${y}`);
  }
});

test("Suedhalbkugel wird abgelehnt", () => {
  assert.equal(nachUtm33(-10, 15), null);
});

test("fehlende Werte: keine Entfernung, keine Peilung", () => {
  assert.ok(Number.isNaN(entfernung(52, 13, null, 13)));
  assert.ok(Number.isNaN(entfernung(52, 13, "", 13)));
  assert.ok(Number.isNaN(peilung(52, 13, undefined, 13)));
  assert.equal(himmelsrichtung("90"), "O");
  assert.equal(gradPaar(" ", " "), "");
  assert.equal(utmPaar(" ", 13), "");
});

// Orte auf allen Kontinenten, Referenz aus pyproj (WGS84 / UTM, EPSG:326xx bzw. 327xx)
const WELT = [
  ["Minsk", 53.9, 27.56, 35, true, 536795.485, 5972540.999],
  ["Sydney", -33.87, 151.21, 56, false, 334435.706, 6250816.398],
  ["Bergen", 60.39, 5.32, 32, true, 297230.220, 6700510.175],
  ["Longyearbyen", 78.22, 15.65, 33, true, 514813.527, 8683004.153],
  ["Quito", -0.18, -78.47, 17, false, 781616.424, 9980085.048],
  ["Anchorage", 61.22, -149.9, 6, true, 344272.700, 6790747.648],
  ["Kapstadt", -33.92, 18.42, 34, false, 261488.826, 6243716.333],
  ["Fidschi", -17.7, 178.0, 60, false, 606044.604, 8042723.405],
  ["Samoa", -13.8, -172.1, 2, false, 381101.614, 8474120.246],
  ["Feuerland", -54.8, -68.3, 19, false, 545000.053, 3927239.381],
  ["Reykjavik", 64.15, -21.94, 27, true, 454270.465, 7114066.846],
  ["Singapur", 1.29, 103.85, 48, true, 372057.368, 142612.911],
  ["Antarktis", -79.9, 166.7, 58, false, 533277.242, 1129089.613],
  ["Nordgrenze", 83.9, -40.0, 24, true, 488136.731, 9317033.097],
];

test("weltweit: amtliche Zone, Hin- und Rueckweg gegen pyproj unter 1 cm", () => {
  for (const [ort, b, l, zone, nord, x, y] of WELT) {
    assert.equal(utmZone(b, l), zone, `Zone ${ort}`);
    const r = nachUtm(b, l);
    assert.equal(r.zone, zone, ort);
    assert.equal(r.nord, nord, ort);
    assert.ok(Math.hypot(r.x - x, r.y - y) < 0.01, `hin ${ort}`);
    const z = ausUtm(x, y, zone, nord);
    assert.ok(entfernung(b, l, z.breite, z.laenge) < 0.01, `zurueck ${ort}`);
  }
});

test("Rueckweg passt weltweit zum Hinweg, auch ueber die Datumsgrenze", () => {
  for (let b = -80; b <= 84; b += 9.1) for (let l = -180; l < 180; l += 13.7) {
    const r = nachUtm(b, l);
    const z = ausUtm(r.x, r.y, r.zone, r.nord);
    assert.ok(z && entfernung(b, l, z.breite, z.laenge) < 0.01, `${b}/${l}`);
  }
});

test("erzwungene Zone und Grenzen", () => {
  assert.equal(nachUtm(52.5, 13.4).zone, 33);
  assert.equal(nachUtm(50, 8).zone, 32, "Westdeutschland");
  assert.equal(nachUtm(50, 8, 33).zone, 33, "Maske will Zone 33");
  assert.equal(nachUtm(50, 30, 33), null, "mehr als 12 Grad vom Mittelmeridian");
  assert.equal(nachUtm(85, 10), null, "Polkappe");
  assert.equal(nachUtm(-81, 10), null, "Polkappe");
  assert.equal(nachUtm(50, 8, 61), null, "keine Zone 61");
  assert.equal(utmZone(null, 8), null);
  assert.equal(ausUtm(500000, 5000000, 0), null);
});

test("utmPaar mit Zone", () => {
  assert.equal(utmPaar(52.5163, 13.3777), "389917.83, 5819701.92");
  assert.equal(utmPaar(53.9, 27.56), "", "Minsk liegt fuer Zone 33 zu weit oestlich");
  assert.ok(utmPaar(53.9, 27.56, "auto").startsWith("536795"));
});
