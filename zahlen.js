/* Baustein zahlen: Zahlen mit fester Nachkommastellenzahl formatieren.
   Herkunft: die sieben "nk"-Kopien in Monitoring-App-f-r-willi und
   verj-ngungsaufnahme2. Die Kopien unterschieden sich nur im Standardwert
   fuer "stellen" und darin, ob das Gebietsschema fest "de-DE" war oder aus
   der Spracheinstellung kam - beides ist hier ein Parameter.

   Fehlt der Wert (null, undefined, "", keine Zahl), kommt "–" heraus statt
   "0,0" oder "NaN": eine erfundene Null waere irrefuehrender als ein Strich.
   Ein Wert, der auf null gerundet wird, erscheint ohne Minuszeichen. */

export const FEHLT = "–";

export const nk = (wert, stellen = 1, ort = "de-DE") => {
  const zahl = wert == null || wert === "" ? NaN : Number(wert);
  if (!Number.isFinite(zahl)) return FEHLT;
  const text = zahl.toLocaleString(ort, {
    minimumFractionDigits: stellen,
    maximumFractionDigits: stellen,
  });
  // -0,04 auf eine Stelle ergaebe sonst "-0,0"
  return /^-[0.,\s]*$/.test(text) ? text.slice(1) : text;
};
