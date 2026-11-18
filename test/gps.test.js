import { test } from "node:test";
import assert from "node:assert/strict";
import { ortung } from "../gps.js";

const mitGeraet = (geolocation, ablauf) => async () => {
  const vorher = globalThis.navigator;
  Object.defineProperty(globalThis, "navigator", { value: { geolocation }, configurable: true });
  try {
    await ablauf();
  } finally {
    Object.defineProperty(globalThis, "navigator", { value: vorher, configurable: true });
  }
};

test("liefert Breite, Laenge und Genauigkeit mit den richtigen Optionen", mitGeraet(
  {
    getCurrentPosition(ok, _fehler, optionen) {
      assert.deepEqual(optionen, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
      ok({ coords: { latitude: 52.8, longitude: 14.2, accuracy: 6 } });
    },
  },
  async () => assert.deepEqual(await ortung(), { breite: 52.8, laenge: 14.2, genauigkeit: 6 }),
));

test("Ortung schlaegt fehl", mitGeraet(
  { getCurrentPosition: (_ok, fehler) => fehler({ code: 3 }) },
  async () => assert.rejects(ortung(), { grund: "nicht-verfuegbar" }),
));

test("Geraet ohne Ortung", mitGeraet(undefined, async () => {
  await assert.rejects(ortung(), { grund: "kein-gps" });
}));
