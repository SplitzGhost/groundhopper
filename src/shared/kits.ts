// Beschreibung eines Hopper-Trikots (gemeinsam für App und tools/kits-build.ts)

export type KitPattern =
  /** Senkrechte Streifen: n farbige Streifen auf der Vorderseite, w = Anteil des Streifens (0–1) */
  | { k: 'stripes'; c: string; n?: number; w?: number }
  | { k: 'pinstripes'; c: string }
  /** Waagerechte Ringel */
  | { k: 'hoops'; c: string; n?: number; w?: number }
  /** Rechte Körperhälfte (von vorn gesehen) in c */
  | { k: 'halves'; c: string }
  /** Schärpe; dir 'l' = von rechts oben nach links unten (von vorn gesehen) */
  | { k: 'sash'; c: string; dir?: 'l' | 'r'; w?: number }
  /** Brustring, y = Mitte (0 unten – 1 Kragen) */
  | { k: 'band'; c: string; y?: number; h?: number }
  /** Ein breiter Mittelstreifen */
  | { k: 'vstripe'; c: string; w?: number }
  | { k: 'chevron'; c: string }
  /** Schulterpartie */
  | { k: 'yoke'; c: string }
  | { k: 'quarters'; c: string }
  /** Verlauf nach unten zu c */
  | { k: 'fade'; c: string }
  /** Dezentes Grafikmuster in c */
  | { k: 'tonal'; c: string }
  /** Karomuster (Schachbrett) */
  | { k: 'checks'; c: string }
  /** Kreuz: Mittelstreifen und Brustring (Parma) */
  | { k: 'cross'; c: string; w?: number }
  /** Diagonal geteilt; dir 'r' = c oben rechts (von vorn gesehen), 'l' = oben links */
  | { k: 'diag'; c: string; dir?: 'l' | 'r' }

export interface KitSpec {
  /** Grundfarbe */
  b: string
  p?: KitPattern
  /** Ärmel (Standard: Grundfarbe) */
  s?: string
  /** Kragen und Bündchen */
  c?: string
  /** Kragenform */
  cs?: 'crew' | 'v' | 'polo'
  /** Ärmelbündchen (Standard: Kragenfarbe) */
  cu?: string
  /** Hose (Standard: weiß) */
  sh?: string
  /** Stutzen (Standard: weiß) */
  so?: string
}
