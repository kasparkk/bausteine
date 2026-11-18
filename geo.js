/* Baustein geo: Koordinaten fuer Feld-Apps.
   Herkunft: verj-ngungsaufnahme2/src/utm33.js + koordinaten.js
   (identisch auch in Monitoring-App-f-r-willi).

   Umrechnung WGS84 (das, was das Handy liefert) nach ETRS89 / UTM Zone 33N,
   EPSG:25833 - das Koordinatensystem der Aufnahmemaske.

   Warum ueberhaupt: Die Excel-Maske traegt X- und Y-Koordinate in EPSG:25833
   ein, das Handy kennt aber nur Laenge und Breite. Damit die exportierten
   Punkte ohne Nacharbeit in QGIS oder in die vorhandenen Datenbestaende
   passen, rechnet die App beides mit und schreibt beides in den Export.

   ETRS89 und WGS84 unterscheiden sich in Mitteleuropa um wenige Zentimeter,
   weil ETRS89 mit der eurasischen Platte mitwandert. Gegenueber der
   GNSS-Genauigkeit eines Handys (im Bestand eher 5-15 m) faellt das nicht
   ins Gewicht; die Umrechnung behandelt beide Bezugssysteme daher als
   gleich. Fuer zentimetergenaue Arbeit waere ein echter Datumsuebergang
   noetig.

   Gerechnet wird die uebliche Reihenentwicklung der transversalen
   Mercator-Abbildung (Snyder, Map Projections - A Working Manual) auf dem
   GRS80-Ellipsoid.

   Genauigkeit gegen pyproj (geprueft 47-55 Grad Nord): innerhalb der Zone 33
   (12-18 Grad Ost) unter 1 cm, bei 6 bzw. 24 Grad Ost unter 5 cm, an den
   Raendern des zugelassenen Bereichs (3 bzw. 27 Grad Ost) bis 40 cm.
   Die Umrechnung gilt nur fuer die Nordhalbkugel. */

import { alsZahl } from "./zahlen.js";

const a = 6378137.0; // grosse Halbachse GRS80
const f = 1 / 298.257222101; // Abplattung GRS80
const k0 = 0.9996; // Massstabsfaktor der UTM-Abbildung
const LON0 = (15 * Math.PI) / 180; // Mittelmeridian der Zone 33
const FE = 500000; // Ostwert des Mittelmeridians

const e2 = f * (2 - f);
const ep2 = e2 / (1 - e2);

const bogen = (grad) => (grad * Math.PI) / 180;
const grad = (bogenmass) => (bogenmass * 180) / Math.PI;
const aufCm = (meter) => Math.round(meter * 100) / 100;

/* Meridianbogenlaenge vom Aequator bis zur Breite phi. */
function meridianbogen(phi) {
  return (
    a *
    ((1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 ** 3) / 256) * phi -
      ((3 * e2) / 8 + (3 * e2 * e2) / 32 + (45 * e2 ** 3) / 1024) * Math.sin(2 * phi) +
      ((15 * e2 * e2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * phi) -
      ((35 * e2 ** 3) / 3072) * Math.sin(6 * phi))
  );
}

/* Laenge/Breite in Grad -> { x, y } in Metern (EPSG:25833).
   Ausserhalb eines sinnvollen Bereichs um die Zone 33 wird null geliefert:
   eine Zahl auszugeben, die dort niemand mehr verwenden kann, waere
   irrefuehrender als gar keine. */
export function nachUtm33(breiteGrad, laengeGrad) {
  if (!Number.isFinite(breiteGrad) || !Number.isFinite(laengeGrad)) return null;
  if (breiteGrad < -80 || breiteGrad > 84) return null;
  if (laengeGrad < 3 || laengeGrad > 27) return null;
  const { x, y } = vorwaerts(breiteGrad, laengeGrad);
  return { x: aufCm(x), y: aufCm(y) };
}

/* Die eigentliche Rechnung, ungerundet und ohne Pruefung. */
function vorwaerts(breiteGrad, laengeGrad) {
  const phi = bogen(breiteGrad);
  const dl = bogen(laengeGrad) - LON0;

  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const tanPhi = Math.tan(phi);

  const N = a / Math.sqrt(1 - e2 * sinPhi * sinPhi);
  const T = tanPhi * tanPhi;
  const C = ep2 * cosPhi * cosPhi;
  const A = dl * cosPhi;
  const M = meridianbogen(phi);

  const x =
    FE +
    k0 *
      N *
      (A +
        ((1 - T + C) * A ** 3) / 6 +
        ((5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5) / 120);

  const y =
    k0 *
    (M +
      N *
        tanPhi *
        ((A * A) / 2 +
          ((5 - T + 9 * C + 4 * C * C) * A ** 4) / 24 +
          ((61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6) / 720));

  return { x, y };
}

/* Rueckweg: EPSG:25833 -> Laenge/Breite in Grad. Wird gebraucht, wenn
   Soll-Koordinaten als Rechts-/Hochwert eingegeben werden, die Karte und die
   Entfernungsanzeige aber Laenge und Breite brauchen.

   Statt einer eigenen Reihe fuer den Rueckweg wird der Hinweg umgekehrt:
   grob schaetzen, dann Breite und Laenge so lange verschieben (Newton), bis
   der Hinweg x und y trifft. Nach vier bis fuenf Schritten auf Bruchteile
   eines Millimeters genau, im ganzen Bereich. */
export function ausUtm33(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  // Spanne passend zu nachUtm33 (3-27 Grad Ost ergeben am Aequator x von
  // etwa -0,85 bis 1,85 Mio.); was ausserhalb liegt, ist ein Tippfehler
  // oder vertauscht.
  if (x < -900000 || x > 1900000 || y < 0 || y > 9400000) return null;

  let breite = y / 111132; // Meter je Breitengrad
  let laenge = 15 + (x - FE) / (111320 * Math.cos(bogen(breite)));
  const h = 1e-6;
  for (let schritt = 0; schritt < 10; schritt++) {
    const p = vorwaerts(breite, laenge);
    const dx = p.x - x;
    const dy = p.y - y;
    if (Math.hypot(dx, dy) < 1e-4) break;
    const pb = vorwaerts(breite + h, laenge);
    const pl = vorwaerts(breite, laenge + h);
    const a11 = (pb.x - p.x) / h, a12 = (pl.x - p.x) / h;
    const a21 = (pb.y - p.y) / h, a22 = (pl.y - p.y) / h;
    const det = a11 * a22 - a12 * a21;
    breite -= (a22 * dx - a12 * dy) / det;
    laenge -= (a11 * dy - a21 * dx) / det;
  }
  return { breite, laenge };
}

/* Entfernung zweier Punkte in Metern (Haversine, Erde als Kugel).
   Auf den Entfernungen einer Untersuchungsflaeche liegt der Fehler
   gegenueber der Ellipsoidrechnung im Zentimeterbereich - unerheblich
   neben der GNSS-Genauigkeit. */
export function entfernung(breite1, laenge1, breite2, laenge2) {
  const R = 6371008.8;
  const dPhi = bogen(breite2 - breite1);
  const dLam = bogen(laenge2 - laenge1);
  const s =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(bogen(breite1)) * Math.cos(bogen(breite2)) * Math.sin(dLam / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/* Rechtweisende Peilung von Punkt 1 nach Punkt 2, in Grad ab Nord. */
export function peilung(breite1, laenge1, breite2, laenge2) {
  const p1 = bogen(breite1);
  const p2 = bogen(breite2);
  const dl = bogen(laenge2 - laenge1);
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (grad(Math.atan2(y, x)) + 360) % 360;
}

const HIMMELSRICHTUNGEN = ["N", "NO", "O", "SO", "S", "SW", "W", "NW"];

export const himmelsrichtung = (winkel) =>
  Number.isFinite(winkel)
    ? HIMMELSRICHTUNGEN[Math.round((((winkel % 360) + 360) % 360) / 45) % 8]
    : "";

/* Koordinatenpaare am Stueck, wie sie in den Ausgaben stehen sollen.
   UTM: Rechts- und Hochwert fuer die Aufnahmemaske; Grad: Breite, Laenge
   fuer Kartenprogramme. Punkt als Dezimaltrenner, weil das Komma die beiden
   Werte trennt. Leere Eingaben ergeben "" (siehe alsZahl). */
export const utmPaar = (breite, laenge) => {
  const utm = nachUtm33(alsZahl(breite), alsZahl(laenge));
  return utm ? `${utm.x.toFixed(2)}, ${utm.y.toFixed(2)}` : "";
};

export const gradPaar = (breite, laenge) => {
  const b = alsZahl(breite);
  const l = alsZahl(laenge);
  return Number.isFinite(b) && Number.isFinite(l) ? `${b.toFixed(6)}, ${l.toFixed(6)}` : "";
};
