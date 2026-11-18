/* Baustein gps: den aktuellen Standort einmal abfragen.
   Herkunft: die drei gleichen getCurrentPosition-Aufrufe in
   verj-ngungsaufnahme2 (Baummessung, Verjuengung, Monitoring-Kopf).

   Liefert ein Promise auf { breite, laenge, genauigkeit } (Genauigkeit in
   Metern, wie das Geraet sie schaetzt). Schlaegt die Ortung fehl, wird ein
   Error geworfen, dessen grund sagt, warum:
     "kein-gps"          - das Geraet bzw. der Browser kann nicht orten
     "nicht-verfuegbar"  - verweigert, kein Empfang oder Zeit abgelaufen

   Immer frisch (kein zwischengespeicherter Standort) und mit hoher
   Genauigkeit; nach 12 Sekunden wird aufgegeben - im Bestand dauert ein
   erster Fix manchmal, ewig warten soll aber niemand. */

export const ORTUNG_ZEIT_MS = 12000;

const fehler = (grund) => Object.assign(new Error(grund), { grund });

export function ortung({ zeit = ORTUNG_ZEIT_MS } = {}) {
  return new Promise((erfuellt, abgelehnt) => {
    const geo = globalThis.navigator?.geolocation;
    if (!geo) return abgelehnt(fehler("kein-gps"));
    geo.getCurrentPosition(
      ({ coords }) =>
        erfuellt({ breite: coords.latitude, laenge: coords.longitude, genauigkeit: coords.accuracy }),
      () => abgelehnt(fehler("nicht-verfuegbar")),
      { enableHighAccuracy: true, timeout: zeit, maximumAge: 0 },
    );
  });
}
