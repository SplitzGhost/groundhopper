// Aussehen eines Hoppers: Haut, Frisur, Haar- und Augenfarbe, Bart, Brille – bewusst wenige, grobe Optionen.
// Dazu, was er trägt: das Basis-Shirt oder ein gesammeltes Heimtrikot (Verein + Saison).
// Diese Datei kommt ohne three.js aus, damit Editor und Sync sie laden können, ohne die 3D-Engine zu ziehen.

export const SKINS = ['#f6d7c3', '#eebd9c', '#d99e76', '#bb7d55', '#8d5a3b', '#5e3a26'] as const
export const HAIR_COLORS = ['#2a1d16', '#5a3a22', '#9a6a3c', '#d9b26a', '#b2442a', '#9a9aa2', '#f1ede4', '#3b6fd8', '#e05a9a'] as const
export const EYE_COLORS = ['#3a2516', '#6b4424', '#3f7bb8', '#4f8a4a', '#6f7f8a'] as const

export type HairStyle = 'short' | 'side' | 'spiky' | 'curly' | 'afro' | 'long' | 'bun' | 'buzz' | 'bald'
export type Beard = 'none' | 'stubble' | 'moustache' | 'full'
export type Glasses = 'none' | 'round' | 'square' | 'sun'

export const HAIR_STYLES: { id: HairStyle; label: string }[] = [
  { id: 'short', label: 'Kurz' },
  { id: 'side', label: 'Seitenscheitel' },
  { id: 'spiky', label: 'Strubbelig' },
  { id: 'curly', label: 'Locken' },
  { id: 'afro', label: 'Afro' },
  { id: 'long', label: 'Lang' },
  { id: 'bun', label: 'Dutt' },
  { id: 'buzz', label: 'Raspel' },
  { id: 'bald', label: 'Glatze' },
]

export const BEARDS: { id: Beard; label: string }[] = [
  { id: 'none', label: 'Ohne' },
  { id: 'stubble', label: 'Stoppeln' },
  { id: 'moustache', label: 'Schnauzer' },
  { id: 'full', label: 'Vollbart' },
]

export const GLASSES: { id: Glasses; label: string }[] = [
  { id: 'none', label: 'Ohne' },
  { id: 'round', label: 'Rund' },
  { id: 'square', label: 'Eckig' },
  { id: 'sun', label: 'Sonnenbrille' },
]

export interface HopperLook {
  skin: number
  hair: HairStyle
  hairColor: number
  eyes: number
  beard: Beard
  glasses: Glasses
}

/** Was der Hopper anhat. null = Basis-Shirt, sonst Trikot-Schlüssel „Verein|Saisonstart“ */
export type KitId = string | null

export interface Hopper {
  look: HopperLook
  kit: KitId
  /** Letzte Änderung – beim Zusammenführen zweier Geräte gewinnt der neuere Stand */
  updatedAt: string
}

export const DEFAULT_LOOK: HopperLook = { skin: 1, hair: 'short', hairColor: 2, eyes: 0, beard: 'none', glasses: 'none' }

const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]

/** Zufälliger Vorschlag für den Start im Editor */
export function randomLook(): HopperLook {
  return {
    skin: Math.floor(Math.random() * SKINS.length),
    hair: pick(HAIR_STYLES.filter((h) => h.id !== 'bald')).id,
    hairColor: Math.floor(Math.random() * 6),
    eyes: Math.floor(Math.random() * EYE_COLORS.length),
    beard: Math.random() < 0.8 ? 'none' : pick(BEARDS).id,
    glasses: Math.random() < 0.8 ? 'none' : pick(GLASSES).id,
  }
}

const inRange = (n: unknown, max: number) => (typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < max ? n : null)
const oneOf = <T extends string>(x: unknown, list: { id: T }[]) => list.find((o) => o.id === x)?.id ?? null

/** Liest einen Hopper defensiv ein (Server, Freunde, alter Speicherstand). null = keiner angelegt. */
export function parseHopper(raw: unknown): Hopper | null {
  if (!raw || typeof raw !== 'object') return null
  const h = raw as Partial<Hopper>
  const l = (h.look ?? {}) as Partial<HopperLook>
  return {
    look: {
      skin: inRange(l.skin, SKINS.length) ?? DEFAULT_LOOK.skin,
      hair: oneOf(l.hair, HAIR_STYLES) ?? DEFAULT_LOOK.hair,
      hairColor: inRange(l.hairColor, HAIR_COLORS.length) ?? DEFAULT_LOOK.hairColor,
      eyes: inRange(l.eyes, EYE_COLORS.length) ?? DEFAULT_LOOK.eyes,
      beard: oneOf(l.beard, BEARDS) ?? 'none',
      glasses: oneOf(l.glasses, GLASSES) ?? 'none',
    },
    kit: typeof h.kit === 'string' && h.kit.includes('|') ? h.kit : null,
    updatedAt: typeof h.updatedAt === 'string' ? h.updatedAt : new Date(0).toISOString(),
  }
}

/** Stabiler Schlüssel fürs Bild-Caching */
export function lookKey(l: HopperLook): string {
  return `${l.skin}${l.hair}${l.hairColor}${l.eyes}${l.beard}${l.glasses}`
}
