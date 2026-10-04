// Maße der Hopper-Figur aus dem Grundbild (tools/hopper-base.ts) – ohne den Maler zu laden,
// damit Karten die Figur schon auslegen können, bevor sie gemalt ist.

import META from '../../data/hopperBase.json'

export const FIG_W = META.width
export const FIG_H = META.height

export interface ArmBox {
  /** Lage des Armbilds im Grundbild */
  x: number
  y: number
  w: number
  h: number
  /** Drehpunkt (Mitte des Ärmelsaums) */
  px: number
  py: number
  /** Halbe Saumbreite */
  r: number
}

/** Armbilder links und rechts – mit Rand für die Kappe am Drehpunkt, die beim Anheben die Lücke zum Ärmel füllt */
export const ARMS: ArmBox[] = META.arms.map((a) => {
  const pad = Math.ceil(a.r)
  return { x: a.x0 - pad, y: a.y0 - pad, w: a.x1 - a.x0 + 1 + 2 * pad, h: a.y1 - a.y0 + 1 + pad, px: a.px, py: a.py, r: a.r }
})

/** Mitte zwischen den Augen – Bezugspunkt, wenn der Hopper hinter der Karte hervorschaut */
export const EYE_POINT = { x: (META.eyes[0].x + META.eyes[1].x) / 2, y: (META.eyes[0].y + META.eyes[1].y) / 2 }

/** Halsansatz (Oberkante des Trikots) – auf Karten schaut nur der Kopf darüber hervor */
export const NECK = META.shirt.y0
