/* Baustein geo: Koordinaten fuer Feld-Apps, weltweit.
   Herkunft: verj-ngungsaufnahme2/src/utm33.js + koordinaten.js
   (identisch auch in Monitoring-App-f-r-willi).

   Umrechnung zwischen Laenge/Breite (was das Handy liefert) und UTM in jeder
   der 60 Zonen, Nord- und Suedhalbkugel. nachUtm33/ausUtm33 sind die
   Kurzform fuer ETRS89 / UTM 33N (EPSG:25833), das Koordinatensystem der
   Aufnahmemasken in Brandenburg.

   Bezugssystem: Gerechnet wird auf dem GRS80-Ellipsoid ohne Datumsuebergang.
   Handy-Koordinaten (WGS84) und ETRS89 liegen in Europa inzwischen rund
   0,9 m auseinander, weil ETRS89 mit der eurasischen Platte mitwandert
   (gut 2,5 cm im Jahr seit 1989; Groessenordnung aus dem Gedaechtnis, nicht
   nachgemessen). Neben der GNSS-Genauigkeit eines Handys im Bestand (5-15 m)
   faellt das nicht ins Gewicht; fuer Vermessungsarbeit waere ein echter
   Datumsuebergang noetig.

   Gerechnet wird die uebliche Reihenentwicklung der transversalen
   Mercator-Abbildung (Snyder, Map Projections - A Working Manual).

   Genauigkeit gegen pyproj: in der eigenen Zone (bis 3 Grad vom
   Mittelmeridian) ueberall unter 1 cm, meist nur die Rundung auf cm. Wird
   eine fremde Zone erzwungen, waechst der Fehler mit dem Abstand: bei 9 Grad
   einige cm, bei 12 Grad (dem erlaubten Hoechstabstand) bis 1,5 m.
   Nicht abgedeckt: die Polkappen noerdlich von 84 und suedlich von 80 Grad
   (dort gilt UPS statt UTM). */

import { alsZahl } from "./zahlen.js";

const a = 6378137.0; // grosse Halbachse GRS80
const f = 1 / 298.257222101; // Abplattung GRS80
const k0 = 0.9996; // Massstabsfaktor der UTM-Abbildung
const FE = 500000; // Ostwert des Mittelmeridians
const FN_SUED = 10000000; // Nordwert-Zuschlag auf der Suedhalbkugel
const MAX_ABSTAND = 12; // hoechstens so viele Grad vom Mittelmeridian

const e2 = f * (2 - f);
const ep2 = e2 / (1 - e2);

const bogen = (grad) => (grad * Math.PI) / 180;
const grad = (bogenmass) => (bogenmass * 180) / Math.PI;
const aufCm = (meter) => Math.round(meter * 100) / 100;
const mittelmeridian = (zone) => zone * 6 - 183;
// Laengenunterschied auf -180..180 Grad bringen (Datumsgrenze bei Zone 1/60)
const laengenAbstand = (laenge, zone) => ((((laenge - mittelmeridian(zone)) % 360) + 540) % 360) - 180;
const istZone = (zone) => Number.isInteger(zone) && zone >= 1 && zone <= 60;

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

/* Die UTM-Zone, in der ein Punkt amtlich liegt - mit den beiden Ausnahmen
   des UTM-Systems: Suedwestnorwegen gehoert zu Zone 32, Spitzbergen ist in
   die Zonen 31, 33, 35 und 37 aufgeteilt. */
export function utmZone(breite, laenge) {
  const b = alsZahl(breite);
  const l = alsZahl(laenge);
  if (!Number.isFinite(b) || !Number.isFinite(l)) return null;
  const lon = ((((l + 180) % 360) + 360) % 360) - 180;
  if (b >= 56 && b < 64 && lon >= 3 && lon < 12) return 32;
  if (b >= 72 && b < 84 && lon >= 0 && lon < 42) {
    return lon < 9 ? 31 : lon < 21 ? 33 : lon < 33 ? 35 : 37;
  }
  return Math.min(60, Math.floor((lon + 180) / 6) + 1);
}

/* Laenge/Breite in Grad -> { x, y, zone, nord } in Metern.
   Ohne Zonenangabe die amtliche Zone des Punktes; mit Zonenangabe diese
   (z. B. fuer eine Maske, die alles in Zone 33 will), solange der Punkt
   hoechstens 12 Grad von deren Mittelmeridian liegt. Ausserhalb wird null
   geliefert: eine Zahl, die dort niemand mehr verwenden kann, waere
   irrefuehrender als gar keine. */
export function nachUtm(breite, laenge, zone = utmZone(breite, laenge)) {
  if (!Number.isFinite(breite) || !Number.isFinite(laenge) || !istZone(zone)) return null;
  if (breite < -80 || breite > 84) return null;
  const dl = laengenAbstand(laenge, zone);
  if (Math.abs(dl) > MAX_ABSTAND) return null;
  const nord = breite >= 0;
  const { x, y } = vorwaerts(breite, dl);
  return { x: aufCm(x), y: aufCm(nord ? y : y + FN_SUED), zone, nord };
}

/* Die eigentliche Rechnung, ungerundet und ohne Pruefung; dl ist der
   Abstand zum Mittelmeridian in Grad. Auf der Suedhalbkugel ist y negativ. */
function vorwaerts(breiteGrad, dl) {
  const phi = bogen(breiteGrad);

  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const tanPhi = Math.tan(phi);

  const N = a / Math.sqrt(1 - e2 * sinPhi * sinPhi);
  const T = tanPhi * tanPhi;
  const C = ep2 * cosPhi * cosPhi;
  const A = bogen(dl) * cosPhi;
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

/* Rueckweg: UTM -> Laenge/Breite in Grad. Wird gebraucht, wenn
   Soll-Koordinaten als Rechts-/Hochwert eingegeben werden, die Karte und die
   Entfernungsanzeige aber Laenge und Breite brauchen. nord = false fuer die
   Suedhalbkugel.

   Statt einer eigenen Reihe fuer den Rueckweg wird der Hinweg umgekehrt:
   grob schaetzen, dann Breite und Laenge so lange verschieben (Newton), bis
   der Hinweg x und y trifft; nach hoechstens drei Schritten auf Bruchteile
   eines Millimeters. Landet das Ergebnis ausserhalb des Bereichs, den
   nachUtm fuer diese Zone annimmt (z. B. Rechtswert mit einer Ziffer zu
   viel), oder trifft es nicht, kommt null. */
export function ausUtm(x, y, zone, nord = true) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !istZone(zone)) return null;
  // Grobe Spanne (12 Grad vom Mittelmeridian ergeben am Aequator x von etwa
  // -0,85 bis 1,85 Mio.); was ausserhalb liegt, ist Tippfehler oder vertauscht.
  if (x < -900000 || x > 1900000 || y < 0 || y > FN_SUED) return null;
  const yN = nord ? y : y - FN_SUED; // Abstand vom Aequator, im Sueden negativ

  let breite = yN / 111132; // Meter je Breitengrad
  let dl = (x - FE) / (111320 * Math.cos(bogen(breite)));
  let rest = Infinity;
  const h = 1e-6;
  for (let schritt = 0; schritt < 10; schritt++) {
    const p = vorwaerts(breite, dl);
    const dx = p.x - x;
    const dy = p.y - yN;
    rest = Math.hypot(dx, dy);
    if (rest < 1e-4) break;
    const pb = vorwaerts(breite + h, dl);
    const pl = vorwaerts(breite, dl + h);
    const a11 = (pb.x - p.x) / h, a12 = (pl.x - p.x) / h;
    const a21 = (pb.y - p.y) / h, a22 = (pl.y - p.y) / h;
    const det = a11 * a22 - a12 * a21;
    breite -= (a22 * dx - a12 * dy) / det;
    dl -= (a11 * dy - a21 * dx) / det;
  }
  // Bereich wie bei nachUtm, mit Spielraum fuer Punkte genau auf dem Rand.
  const e = 1e-6;
  const imBereich = (nord ? breite > -e && breite < 84 + e : breite < e && breite > -80 - e) &&
    Math.abs(dl) < MAX_ABSTAND + e;
  if (rest > 1e-3 || !imBereich) return null;
  const laenge = ((((mittelmeridian(zone) + dl + 180) % 360) + 360) % 360) - 180;
  return { breite, laenge };
}

/* Kurzform fuer ETRS89 / UTM 33N (EPSG:25833), wie bisher: { x, y } bzw.
   { breite, laenge }. Nur Nordhalbkugel, 3-27 Grad Ost. */
export function nachUtm33(breite, laenge) {
  const r = breite >= 0 ? nachUtm(breite, laenge, 33) : null;
  return r && { x: r.x, y: r.y };
}

export const ausUtm33 = (x, y) => ausUtm(x, y, 33, true);

/* Entfernung zweier Punkte in Metern (Haversine, Erde als Kugel).
   Auf den Entfernungen einer Untersuchungsflaeche liegt der Fehler
   gegenueber der Ellipsoidrechnung im Zentimeterbereich - unerheblich
   neben der GNSS-Genauigkeit. */
export function entfernung(...werte) {
  const [breite1, laenge1, breite2, laenge2] = werte.map(alsZahl);
  // Fehlt ein Wert, gibt es keine Entfernung (NaN) - nicht die zum Aequator.
  const R = 6371008.8;
  const dPhi = bogen(breite2 - breite1);
  const dLam = bogen(laenge2 - laenge1);
  const s =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(bogen(breite1)) * Math.cos(bogen(breite2)) * Math.sin(dLam / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/* Rechtweisende Peilung von Punkt 1 nach Punkt 2, in Grad ab Nord. */
export function peilung(...werte) {
  const [breite1, laenge1, breite2, laenge2] = werte.map(alsZahl);
  const p1 = bogen(breite1);
  const p2 = bogen(breite2);
  const dl = bogen(laenge2 - laenge1);
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (grad(Math.atan2(y, x)) + 360) % 360;
}

const HIMMELSRICHTUNGEN = ["N", "NO", "O", "SO", "S", "SW", "W", "NW"];

export const himmelsrichtung = (eingabe) => {
  const winkel = alsZahl(eingabe);
  return Number.isFinite(winkel)
    ? HIMMELSRICHTUNGEN[Math.round((((winkel % 360) + 360) % 360) / 45) % 8]
    : "";
};

/* Koordinatenpaare am Stueck, wie sie in den Ausgaben stehen sollen.
   UTM: Rechts- und Hochwert fuer die Aufnahmemaske (Standard Zone 33; mit
   zone = "auto" die amtliche Zone des Punktes); Grad: Breite, Laenge fuer
   Kartenprogramme. Punkt als Dezimaltrenner, weil das Komma die beiden
   Werte trennt. Leere Eingaben ergeben "" (siehe alsZahl). */
export const utmPaar = (breite, laenge, zone = 33) => {
  const b = alsZahl(breite);
  const l = alsZahl(laenge);
  const utm = zone === "auto" ? nachUtm(b, l) : zone === 33 ? nachUtm33(b, l) : nachUtm(b, l, zone);
  return utm ? `${utm.x.toFixed(2)}, ${utm.y.toFixed(2)}` : "";
};

export const gradPaar = (breite, laenge) => {
  const b = alsZahl(breite);
  const l = alsZahl(laenge);
  return Number.isFinite(b) && Number.isFinite(l) ? `${b.toFixed(6)}, ${l.toFixed(6)}` : "";
};
