// Typen fuer TypeScript-Apps (z. B. wildverkauf); der Code steht in kamera.js.
export type KameraZustand = "laeuft" | "nein";
export interface KameraOptionen {
  aenderung?: (zustand: KameraZustand, fehler?: { name?: string; message?: string }) => void;
  breite?: number;
  hoehe?: number;
  bildrate?: number;
}
export function kamera(
  video: HTMLVideoElement | null | (() => HTMLVideoElement | null),
  optionen?: KameraOptionen,
): { stop(): void };
