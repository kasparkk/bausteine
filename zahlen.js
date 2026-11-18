/* Baustein zahlen: Zahlen mit fester Nachkommastellenzahl formatieren.
   Herkunft: die sieben "nk"-Kopien in Monitoring-App-f-r-willi und
   verj-ngungsaufnahme2. Die Kopien unterschieden sich nur im Standardwert
   fuer "stellen" und darin, ob das Gebietsschema fest "de-DE" war oder aus
   der Spracheinstellung kam - beides ist hier ein Parameter. */

export const nk = (wert, stellen = 1, ort = "de-DE") =>
  Number(wert).toLocaleString(ort, {
    minimumFractionDigits: stellen,
    maximumFractionDigits: stellen,
  });
