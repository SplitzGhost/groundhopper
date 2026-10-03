import { readFileSync } from 'node:fs'
import type { LeagueCode, Stadium } from '../src/shared/types.ts'
import { createTeamMatcher, type TeamMatch } from '../src/shared/teamMatch.ts'

function loadStadiums(): Stadium[] {
  try {
    return JSON.parse(readFileSync(new URL('../src/data/stadiums.json', import.meta.url), 'utf8')) as Stadium[]
  } catch {
    console.warn('src/data/stadiums.json fehlt – bitte `npm run stadiums` ausführen.')
    return []
  }
}

export const stadiums = loadStadiums()
export const matchTeam = createTeamMatcher(stadiums)

const byEspnTeam = new Map<string, TeamMatch>()
const byEspnVenue = new Map<string, string>()
for (const s of stadiums) {
  for (const v of s.espnVenues ?? []) byEspnVenue.set(v, s.id)
  for (const t of s.teams) if (t.espnId) byEspnTeam.set(t.espnId, { stadiumId: s.id, team: t.name })
}

interface EspnTeamLike { id: string; displayName: string; shortDisplayName?: string }

/** Verein aus der Datenbank zu einem ESPN-Verein – über die ID, sonst (nur exakt) über den Namen. */
export function espnTeam(t: EspnTeamLike, league: LeagueCode): TeamMatch | null {
  return byEspnTeam.get(t.id) ?? matchTeam(t.displayName, league, true)
    ?? (t.shortDisplayName ? matchTeam(t.shortDisplayName, league, true) : null)
}

/** Stadion eines ESPN-Spiels: bekannter Spielort, sonst das Heimstadion – auf neutralem Platz nur der Spielort. */
export function espnStadiumId(home: EspnTeamLike, league: LeagueCode, venueId: string | undefined, neutral: boolean): string | null {
  const venue = venueId ? byEspnVenue.get(venueId) : undefined
  if (neutral) return venue ?? null
  return venue ?? espnTeam(home, league)?.stadiumId ?? null
}
