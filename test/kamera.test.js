import { test } from "node:test";
import assert from "node:assert/strict";
import { kamera } from "../kamera.js";

// Kleine Attrappe fuer Kamera, Video und Dokument
function umgebung({ verweigert = false, verzoegerung = 0 } = {}) {
  const spuren = [];
  const anfragen = [];
  const horcher = new Set();
  const neueSpur = () => {
    const spur = { readyState: "live", muted: false, gestoppt: false, stop() { this.gestoppt = true; this.readyState = "ended"; } };
    spuren.push(spur);
    return spur;
  };
  globalThis.document = {
    visibilityState: "visible",
    addEventListener: (_n, f) => horcher.add(f),
    removeEventListener: (_n, f) => horcher.delete(f),
  };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      mediaDevices: {
        async getUserMedia(wunsch) {
          anfragen.push(wunsch);
          await new Promise((r) => setTimeout(r, verzoegerung));
          if (verweigert) throw new Error("NotAllowedError");
          const spur = neueSpur();
          return { getTracks: () => [spur], getVideoTracks: () => [spur] };
        },
      },
    },
  });
  const video = { srcObject: null, gespielt: 0, play() { this.gespielt++; return Promise.resolve(); } };
  const sichtbar = () => horcher.forEach((f) => f());
  return { spuren, anfragen, video, sichtbar, horcher };
}
const warte = (ms = 5) => new Promise((r) => setTimeout(r, ms));

test("startet die Rueckkamera mit begrenzter Groesse und meldet laeuft", async () => {
  const u = umgebung();
  const zustaende = [];
  const k = kamera(u.video, { aenderung: (z) => zustaende.push(z) });
  await warte();
  assert.deepEqual(zustaende, ["laeuft"]);
  assert.ok(u.video.srcObject);
  assert.equal(u.video.gespielt, 1);
  assert.deepEqual(u.anfragen[0].video, {
    facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 960 }, frameRate: { ideal: 30, max: 30 },
  });
  assert.equal(u.anfragen[0].audio, false);
  k.stop();
  assert.ok(u.spuren[0].gestoppt, "stop schaltet die Kamera aus");
  assert.equal(u.horcher.size, 0, "kein Horcher bleibt haengen");
});

test("keine Freigabe oder kein Geraet: nein", async () => {
  const u = umgebung({ verweigert: true });
  const zustaende = [];
  kamera(u.video, { aenderung: (z, f) => zustaende.push([z, f?.message]) });
  await warte();
  assert.deepEqual(zustaende, [["nein", "NotAllowedError"]]);
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} });
  const z2 = [];
  kamera(u.video, { aenderung: (z, f) => z2.push([z, f?.name]) });
  await warte();
  assert.deepEqual(z2, [["nein", "NotSupportedError"]]);
});

test("stop waehrend der Freigabe: Kamera geht gleich wieder aus, keine Meldung", async () => {
  const u = umgebung({ verzoegerung: 10 });
  const zustaende = [];
  const k = kamera(u.video, { aenderung: (z) => zustaende.push(z) });
  k.stop();
  await warte(20);
  assert.deepEqual(zustaende, []);
  assert.ok(u.spuren[0].gestoppt);
  assert.equal(u.video.srcObject, null);
});

test("zurueck aus dem Hintergrund: beendete Spur wird neu gestartet, sonst weitergespielt", async () => {
  const u = umgebung();
  const k = kamera(() => u.video);
  await warte();
  u.sichtbar();
  assert.equal(u.anfragen.length, 1, "Spur lebt: kein Neustart");
  assert.equal(u.video.gespielt, 2, "nur weiterspielen");
  u.spuren[0].readyState = "ended"; // Android hat die Spur beendet
  u.sichtbar();
  await warte();
  assert.equal(u.anfragen.length, 2, "Neustart");
  assert.notEqual(u.spuren[1], u.spuren[0]);
  k.stop();
  assert.ok(u.spuren[1].gestoppt);
});
