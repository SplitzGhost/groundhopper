// Wappen je Verein: Top 5 aus src/data/crests.json (erzeugt mit `npm run crests`), alle übrigen über
// die ESPN-ID in stadiums.json. Gilt unabhängig von der Spielplan-Quelle, damit alle Ligen
// einheitliche Logos haben – auch im Demo-Modus.

import type { LeagueCode, TeamRef } from '../shared/types.ts'
import CRESTS from '../data/crests.json'
import { leagueByCode } from '../shared/leagues.ts'
import { STADIUMS, findTeam } from './stadiums.ts'

const IDS: Record<string, string> = { ...(CRESTS as Record<string, string>) }
for (const s of STADIUMS) for (const t of s.teams) if (t.espnId) IDS[t.name] ??= t.espnId

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

/** Wappen über die Vereins-ID der Quelle (ESPN-Spiele) – auch für Vereine außerhalb der Datenbank */
export function crestForTeam(t: TeamRef, league?: LeagueCode): string | null {
  return crestFor(t.name, 'sm', league) ?? (t.id.startsWith('espn-') ? url(t.id.slice(5), 'sm') : t.crest)
}

/** ESPN-Vereins-ID (dieselbe Quelle wie die Wappen) – für den Spielbericht */
export function espnTeamId(name: string, league?: LeagueCode | null): string | null {
  return IDS[name] ?? IDS[findTeam(name, league ?? undefined)?.team ?? ''] ?? null
}

/** Ersatzlogo: Wappenschild mit dem Kürzel des Wettbewerbs */
function badge(text: string, kind: 'league' | 'cup'): string {
  const size = text.length > 3 ? 26 : 32
  const shape = kind === 'cup'
    ? '<path d="M28 14h44v8h12c0 16-8 26-20 28-3 8-8 12-10 13v9h12v10H34V72h12v-9c-2-1-7-5-10-13-12-2-20-12-20-28h12z" fill="#0a7cff"/>'
    : '<path d="M50 6 88 18v30c0 24-17 39-38 46C29 87 12 72 12 48V18z" fill="#0a7cff"/>'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${shape}`
    + `<text x="50" y="${kind === 'cup' ? 44 : 58}" text-anchor="middle" font-family="-apple-system,Helvetica,Arial,sans-serif" `
    + `font-weight="800" font-size="${kind === 'cup' ? size * 0.72 : size}" fill="#fff">${text}</text></svg>`
  return 'data:image/svg+xml,' + encodeURIComponent(svg)
}

/** Liga-Logo in Farbe – ohne offizielles Logo ein Schild mit dem Kürzel */
export function leagueLogo(code: LeagueCode): string {
  const l = leagueByCode(code)
  return l.logo === null ? badge(l.shortName, l.kind) : `https://a.espncdn.com/i/leaguelogos/soccer/500/${l.logo}.png`
}

/** Alle bekannten Wappen (Vereinsname → URL) */
export function allCrests(size: CrestSize = 'sm'): Map<string, string> {
  return new Map(Object.entries(IDS).map(([name, id]) => [name, url(id, size)]))
}
