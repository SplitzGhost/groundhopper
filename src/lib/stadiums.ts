import type { LeagueCode, Stadium } from '../shared/types.ts'
import { createTeamMatcher } from '../shared/teamMatch.ts'
import data from '../data/stadiums.json'

export const STADIUMS = data as Stadium[]

const byId = new Map(STADIUMS.map((s) => [s.id, s]))

export const stadiumById = (id: string | null | undefined): Stadium | undefined =>
  id ? byId.get(id) : undefined

/** Stadion eines Vereins über dessen Namen (beliebige Schreibweise). */
export const findTeam = createTeamMatcher(STADIUMS)

export function stadiumsOfLeague(league: LeagueCode): Stadium[] {
  return STADIUMS.filter((s) => s.teams.some((t) => t.league === league))
}
