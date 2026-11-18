# Bausteine

Getestete Bausteine fuer meine Apps. Was in mehr als einer App gebraucht
wird, kommt hierher, bekommt Tests und wird dann nur noch eingebunden statt
kopiert.

| Baustein | Inhalt | Herkunft |
|---|---|---|
| `geo` | WGS84 <-> UTM 33 (EPSG:25833), Entfernung, Peilung, Himmelsrichtung, Koordinaten als Text | verj-ngungsaufnahme2, Monitoring-App |
| `zahlen` | Zahlen mit fester Nachkommastellenzahl (`nk`) | 7 Kopien in beiden Apps |

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

`export` (CSV/Excel), `speicher`, `pwa`; in wald-lidar: `laz`, `baumerkennung`.
