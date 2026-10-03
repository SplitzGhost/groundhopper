import type { Transition } from 'motion/react'

/** Knackige Feder für Antippen und kleine Elemente */
export const spring: Transition = { type: 'spring', stiffness: 520, damping: 32, mass: 0.8 }
/** Weiche Feder für Übergänge und Indikatoren */
export const softSpring: Transition = { type: 'spring', stiffness: 300, damping: 30 }
