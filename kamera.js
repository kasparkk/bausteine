/* Baustein kamera: die Rueckkamera als Live-Bild in ein <video>.
   Herkunft: der Sucher des Hoehenmessers in verj-ngungsaufnahme2
   (baum/Hoehenmesser.jsx), mit allem, was dort im Bestand gelernt wurde.

   const k = kamera(video, { aenderung: (zustand) => ... });
   ...
   k.stop();

   video      das <video>-Element oder eine Funktion, die es liefert (wird
              erst gebraucht, wenn das Bild da ist - in React also z. B.
              () => videoRef.current)
   aenderung  wird mit "laeuft" oder "nein" aufgerufen; bei "nein" kommt als
              zweites der Grund mit (fehler.name, z. B. "NotAllowedError" =
              Freigabe verweigert, "NotSupportedError" = Geraet/Browser kann
              keine Kamera)
   breite, hoehe, bildrate
              gewuenschte Bildgroesse. Ohne diese Bitte liefern manche Geraete
              1080p oder mehr - fuer einen Sucher auf dem Handy verschwendete
              Rechenzeit. Fuer Fotos in hoher Aufloesung ist ein Live-Bild
              ohnehin der falsche Weg: <input type="file" capture> oeffnet
              die Kamera-App des Handys mit voller Sensoraufloesung.

   Was der Baustein selbst erledigt:
   - Rueckkamera, wo vorhanden (sonst die, die es gibt).
   - Wird stop() aufgerufen, waehrend die Freigabe noch laeuft, wird die
     Kamera sofort wieder ausgeschaltet, statt im Hintergrund weiterzulaufen.
   - Zurueck aus dem Hintergrund: Android beendet die Kameraspur, wenn die
     App weggeschaltet oder der Bildschirm gesperrt wird; das Bild bliebe
     schwarz. Dann wird neu gestartet, sonst nur weitergespielt.
   - stop() schaltet die Kamera wirklich aus (Laempchen aus, Akku geschont). */

export function kamera(video, { aenderung = () => {}, breite = 1280, hoehe = 960, bildrate = 30 } = {}) {
  let strom = null;
  let gestoppt = false;
  const element = () => (typeof video === "function" ? video() : video);
  const ausschalten = () => {
    strom?.getTracks().forEach((spur) => spur.stop());
    strom = null;
  };

  const starten = async () => {
    const medien = globalThis.navigator?.mediaDevices;
    if (!medien?.getUserMedia) return aenderung("nein", { name: "NotSupportedError" });
    try {
      const neu = await medien.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: breite },
          height: { ideal: hoehe },
          frameRate: { ideal: bildrate, max: bildrate },
        },
        audio: false,
      });
      if (gestoppt) {
        neu.getTracks().forEach((spur) => spur.stop());
        return;
      }
      strom = neu;
      const el = element();
      if (el) {
        el.srcObject = neu;
        // autoPlay allein genuegt nicht ueberall (nach dem Hintergrund).
        el.play?.()?.catch?.(() => {});
      }
      aenderung("laeuft");
    } catch (fehler) {
      if (!gestoppt) aenderung("nein", fehler);
    }
  };

  const wieder = () => {
    if (gestoppt || document.visibilityState !== "visible") return;
    const spur = strom?.getVideoTracks?.()[0];
    if (!spur || spur.readyState === "ended" || spur.muted) {
      ausschalten();
      starten();
    } else {
      element()?.play?.()?.catch?.(() => {});
    }
  };

  globalThis.document?.addEventListener?.("visibilitychange", wieder);
  starten();

  return {
    stop() {
      gestoppt = true;
      globalThis.document?.removeEventListener?.("visibilitychange", wieder);
      ausschalten();
    },
  };
}
