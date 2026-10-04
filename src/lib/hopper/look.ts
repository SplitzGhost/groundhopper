// Aussehen eines Hoppers: Hautfarbe, Haarfarbe und Augenform – bewusst wenige, grobe Optionen.
// Die Figur selbst ist das Grundbild aus inspiration/hopper/ (siehe tools/hopper-base.ts), umgefärbt in paint.ts.
// Dazu, was er trägt: das Basis-Trikot oder ein gesammeltes Heimtrikot (Verein + Saison).

/** Mitteltöne – die Schattierung kommt aus dem Grundbild */
export const SKINS = ['#f4d2b8', '#e9b690', '#d7966d', '#b97a50', '#8e5735', '#5f3823'] as const
export const HAIR_COLORS = ['#2a1e17', '#5b3a24', '#a76c44', '#d8b06a', '#b4472b', '#9a9aa2', '#ece6da', '#3b6fd8', '#e05a9a'] as const

export type EyeShape = 'oval' | 'round' | 'big' | 'small' | 'happy' | 'sleepy' | 'lashes' | 'wink'

export const EYE_SHAPES: { id: EyeShape; label: string }[] = [
  { id: 'oval', label: 'Klassisch' },
  { id: 'round', label: 'Rund' },
  { id: 'big', label: 'Groß' },
  { id: 'small', label: 'Klein' },
  { id: 'happy', label: 'Fröhlich' },
  { id: 'sleepy', label: 'Verschlafen' },
  { id: 'lashes', label: 'Wimpern' },
  { id: 'wink', label: 'Zwinkern' },
]

export interface HopperLook {
  skin: number
  hairColor: number
  eyes: EyeShape
}

/** Was der Hopper anhat. null = Basis-Trikot, sonst Trikot-Schlüssel „Verein|Saisonstart“ */
export type KitId = string | null

export interface Hopper {
  look: HopperLook
  kit: KitId
  /** Letzte Änderung – beim Zusammenführen zweier Geräte gewinnt der neuere Stand */
  updatedAt: string
}

export const DEFAULT_LOOK: HopperLook = { skin: 2, hairColor: 2, eyes: 'oval' }

const pickIndex = (n: number) => Math.floor(Math.random() * n)

/** Zufälliger Vorschlag für den Start im Editor */
export function randomLook(): HopperLook {
  return {
    skin: pickIndex(SKINS.length),
    hairColor: pickIndex(6),
    eyes: Math.random() < 0.5 ? 'oval' : EYE_SHAPES[pickIndex(EYE_SHAPES.length)].id,
  }
}

const inRange = (n: unknown, max: number) => (typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < max ? n : null)

/** Liest einen Hopper defensiv ein (Server, Freunde, alter Speicherstand). null = keiner angelegt. */
export function parseHopper(raw: unknown): Hopper | null {
  if (!raw || typeof raw !== 'object') return null
  const h = raw as Partial<Hopper>
  const l = (h.look ?? {}) as Partial<Record<keyof HopperLook, unknown>>
  return {
    look: {
      skin: inRange(l.skin, SKINS.length) ?? DEFAULT_LOOK.skin,
      hairColor: inRange(l.hairColor, HAIR_COLORS.length) ?? DEFAULT_LOOK.hairColor,
      // Ältere Stände hatten eine Augenfarbe (Zahl) statt einer Form
      eyes: EYE_SHAPES.find((e) => e.id === l.eyes)?.id ?? DEFAULT_LOOK.eyes,
    },
    kit: typeof h.kit === 'string' && h.kit.includes('|') ? h.kit : null,
    updatedAt: typeof h.updatedAt === 'string' ? h.updatedAt : new Date(0).toISOString(),
  }
}

/** Stabiler Schlüssel fürs Bild-Caching */
export function lookKey(l: HopperLook): string {
  return `${l.skin}-${l.hairColor}-${l.eyes}`
}
