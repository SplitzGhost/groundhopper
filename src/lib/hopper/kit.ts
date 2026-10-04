// Trikots für den Hopper: keine Kopie der Originale, sondern eine vereinfachte Fassung aus Grundfarbe,
// Muster, Ärmeln und Kragen – so passen sie zum Comic-Stil und bleiben trotzdem sofort erkennbar.
// Die Daten pro Verein und Saison stehen in src/data/kits.json (erzeugt mit `npm run kits`, danach von Hand geprüft).
// Ohne Eintrag gibt es ein schlichtes Trikot in den Vereinsfarben.

import { clubInfo } from '../../data/clubs.ts'
import type { KitSpec } from '../../shared/kits.ts'

export type { KitPattern, KitSpec } from '../../shared/kits.ts'

/** Basis-Trikot für alle, die noch kein Trikot gesammelt oder keins angezogen haben */
export const BASIC_KIT: KitSpec = { b: '#ffffff', c: '#ffffff', cs: 'v' }

/** Saisonstart (Jahr) eines Spieltags YYYY-MM-DD: Juli bis Juni */
export function seasonOf(date: string): number {
  const y = Number(date.slice(0, 4))
  const m = Number(date.slice(5, 7))
  return m >= 7 ? y : y - 1
}

export const seasonLabel = (s: number) => `${s}/${String((s + 1) % 100).padStart(2, '0')}`

export const kitId = (club: string, season: number) => `${club}|${season}`

export function parseKitId(id: string): { club: string; season: number } | null {
  const i = id.lastIndexOf('|')
  const season = Number(id.slice(i + 1))
  return i > 0 && Number.isInteger(season) ? { club: id.slice(0, i), season } : null
}

const isLight = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.72
}

/** Schlichtes Trikot aus den Vereinsfarben – für Vereine und Saisons ohne eigenen Eintrag */
export function fallbackKit(club: string): KitSpec {
  const { primary, secondary } = clubInfo(club)
  const same = primary.toLowerCase() === secondary.toLowerCase()
  const trim = same ? (isLight(primary) ? '#1b2a4a' : '#ffffff') : secondary
  return { b: primary, c: trim, cs: 'v', sh: same || isLight(secondary) ? primary : secondary, so: primary }
}

type KitTable = Record<string, Record<string, KitSpec>>
let table: KitTable | null = null
let loading: Promise<KitTable> | null = null

/** Trikotdaten nachladen (eigenes Paket, nur wenn ein Hopper gezeigt wird) */
export function loadKits(): Promise<KitTable> {
  loading ??= import('../../data/kits.json').then((m) => (table = m.default as unknown as KitTable))
  return loading
}

/** Trikot zu einem Schlüssel; die Tabelle muss geladen sein, sonst gibt es das Ersatztrikot */
export function kitSpec(id: string | null): KitSpec {
  if (!id) return BASIC_KIT
  const ref = parseKitId(id)
  if (!ref) return BASIC_KIT
  return table?.[ref.club]?.[ref.season] ?? fallbackKit(ref.club)
}

/** true = echtes, nachgebautes Heimtrikot (nicht nur Vereinsfarben) */
export const hasRealKit = (id: string) => {
  const ref = parseKitId(id)
  return !!ref && !!table?.[ref.club]?.[ref.season]
}
