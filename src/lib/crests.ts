// Wappen je Verein aus src/data/crests.json (erzeugt mit `npm run crests`). Gilt unabhängig
// von der Spielplan-Quelle, damit alle Ligen einheitliche Logos haben – auch im Demo-Modus.

import type { LeagueCode } from '../shared/types.ts'
import CRESTS from '../data/crests.json'
import { findTeam } from './stadiums.ts'

const IDS = CRESTS as Record<string, string>

/** sm: für Listen (bis ~56 pt), lg: für Karten in voller Auflösung */
export type CrestSize = 'sm' | 'lg'

const url = (id: string, size: CrestSize) => size === 'lg'
  ? `https://a.espncdn.com/i/teamlogos/soccer/500/${id}.png`
  : `https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/${id}.png&w=168&h=168`

/** Wappen-URL für einen Vereinsnamen in beliebiger Schreibweise, null wenn unbekannt */
export function crestFor(name: string | null | undefined, size: CrestSize = 'sm', league?: LeagueCode): string | null {
  if (!name) return null
  const id = IDS[name] ?? IDS[findTeam(name, league)?.team ?? '']
  return id ? url(id, size) : null
}

/** ESPN-Vereins-ID (dieselbe Quelle wie die Wappen) – für den Spielbericht */
export function espnTeamId(name: string, league?: LeagueCode | null): string | null {
  return IDS[name] ?? IDS[findTeam(name, league ?? undefined)?.team ?? ''] ?? null
}

/** Liga-Logo in Farbe */
const LEAGUE_LOGO: Record<LeagueCode, number> = { BL1: 10, PL: 23, PD: 15, SA: 12, FL1: 9 }
export const leagueLogo = (code: LeagueCode) => `https://a.espncdn.com/i/leaguelogos/soccer/500/${LEAGUE_LOGO[code]}.png`

/** Alle bekannten Wappen (Vereinsname → URL) */
export function allCrests(size: CrestSize = 'sm'): Map<string, string> {
  return new Map(Object.entries(IDS).map(([name, id]) => [name, url(id, size)]))
}
