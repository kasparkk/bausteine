# Bausteine

Getestete Bausteine fuer meine Apps. Was in mehr als einer App gebraucht
wird, kommt hierher, bekommt Tests und wird dann nur noch eingebunden statt
kopiert.

| Baustein | Inhalt | Herkunft |
|---|---|---|
| `geo` | WGS84 <-> UTM 33 (EPSG:25833), Entfernung, Peilung, Himmelsrichtung, Koordinaten als Text | verj-ngungsaufnahme2, Monitoring-App |
| `zahlen` | Zahlen mit fester Nachkommastellenzahl (`nk`) | 7 Kopien in beiden Apps |
| `export` | Excel (.xlsx, auch mehrere Blaetter), CSV fuers deutsche Excel, Datei teilen oder herunterladen | xlsx.js, monitoring/export.js, 5 Kopien von "weitergeben" |

## Benutzen

```js
import { nachUtm33, nk } from "bausteine";
```

Einbinden in eine App: `npm install github:kasparkk/bausteine`

## Regeln

1. Ein Baustein kommt erst rein, wenn seine Tests laufen (`npm test`).
2. Lieber allgemein als passgenau: Parameter statt fester Werte.
3. Vor einem neuen Baustein schauen, ob ein vorhandener reicht.

## Als Naechstes

`speicher`, `pwa`; in wald-lidar: `laz`, `baumerkennung`.

## Aenderungen

**0.4.0** (unabhaengige Durchsicht, 33 Tests)
- `geo`: `ausUtm33` liefert `null` statt Punkten ausserhalb des Bereichs (z. B. Rechtswert mit einer Ziffer zu viel); `entfernung`, `peilung` und `himmelsrichtung` geben bei fehlenden Werten NaN bzw. "" statt der Entfernung zum Aequator; Suedhalbkugel wird abgelehnt; Genauigkeitsangabe nachgemessen.
- `zahlen`: `alsZahl` macht aus " ", false oder [] keine 0 mehr; "−0,0" auch in Sprachen mit typografischem Minus behoben.
- `export`: U+FFFE/U+FFFF werden entfernt (sonst kaputtes XML); ungueltiges Datum bricht nichts mehr ab; doppelte Blattnamen werden sauber nummeriert (a, a 2, a 3); leere und reservierte Blattnamen ("History") abgefangen; fehlende Zeilen werden leer.

**0.3.2** Kuerzer bei gleicher Funktion: Rueckweg UTM nach Grad ohne eigene Reihe (grobe Schaetzung + Newton, im ganzen Bereich unter 1 cm zum Hinweg, auch suedlich von 42 Grad, wo vorher `null` kam); Maskieren fuer Excel in einem Schritt.

**0.3.1** Doppeltes entfernt, Ergebnisse unveraendert (byte-gleiche Excel-Dateien): gemeinsamer Meridianbogen-Koeffizient und Umrechnungshelfer in `geo`; `alsZahl` einmal in `zahlen`, von `geo` mitbenutzt; in `export` die ZIP-Kopffelder, Namensraeume und Blatt-Schleifen je nur einmal.

**0.3.0** (Durchsicht aller Bausteine)
- `geo`: Rueckweg UTM nach Grad wird nachgebessert, jetzt auf Millimeter genau statt bis 6 m am Rand; unmoegliche oder vertauschte Werte ergeben `null`; leere Eingaben ("") erfinden keinen Punkt am Aequator mehr; `himmelsrichtung(NaN)` ergibt "".
- `zahlen`: fehlende Werte ergeben "–" statt "0,0" oder "NaN"; kein "-0,0" mehr.
- `export`: Leerzeichen am Zellrand bleiben erhalten; NaN/Unendlich werden leere Zellen; Wahrheitswerte und Datumsangaben richtig; Zellen auf Excels Hoechstlaenge gekuerzt; Blattnamen ohne Apostroph am Rand; CSV quotet auch "\r"; Download wird erst nach 10 s freigegeben (Safari brach sonst ab).
