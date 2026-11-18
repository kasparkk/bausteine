/* Baustein zahlen: Zahlen mit fester Nachkommastellenzahl formatieren.
   Herkunft: die sieben "nk"-Kopien in Monitoring-App-f-r-willi und
   verj-ngungsaufnahme2. Die Kopien unterschieden sich nur im Standardwert
   fuer "stellen" und darin, ob das Gebietsschema fest "de-DE" war oder aus
   der Spracheinstellung kam - beides ist hier ein Parameter.

   Fehlt der Wert (null, undefined, "", keine Zahl), kommt "–" heraus statt
   "0,0" oder "NaN": eine erfundene Null waere irrefuehrender als ein Strich.
   Ein Wert, der auf null gerundet wird, erscheint ohne Minuszeichen. */

export const FEHLT = "–";

/* Eingabe als Zahl; null, undefined und "" gelten als "kein Wert" (NaN).
   Number("") waere sonst 0 - eine erfundene Null, bei Koordinaten sogar ein
   Punkt am Aequator. */
export const alsZahl = (wert) => (wert == null || wert === "" ? NaN : Number(wert));

export const nk = (wert, stellen = 1, ort = "de-DE") => {
  const zahl = alsZahl(wert);
  if (!Number.isFinite(zahl)) return FEHLT;
  const text = zahl.toLocaleString(ort, {
    minimumFractionDigits: stellen,
    maximumFractionDigits: stellen,
  });
  // -0,04 auf eine Stelle ergaebe sonst "-0,0"
  return /^-[0.,\s]*$/.test(text) ? text.slice(1) : text;
};
