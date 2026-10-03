// Sammellisten zum Vervollständigen: Vereine und Stadien je Land, Ligen, Derbys, Erfolge.

import type { LeagueCode, Stadium } from '../shared/types.ts'
import { LEAGUES, leagueByCode } from '../shared/leagues.ts'
import { STADIUMS, stadiumsOfLeague } from './stadiums.ts'
import { DERBIES } from './derbies.ts'
import { ACHIEVEMENTS, type Collection } from './album.ts'
import { shortClub } from './matchCards.ts'

export type ListId = `clubs:${LeagueCode}` | `stadiums:${LeagueCode}` | 'leagues' | 'derbies' | 'achievements'

export interface ClubEntry {
  name: string
  league: LeagueCode
  stadium: Stadium
}

/** Vereine einer Liga, alphabetisch nach Kurzname (Köln unter K, nicht unter 1.) */
export function clubsOfLeague(code: LeagueCode): ClubEntry[] {
  return STADIUMS.flatMap((s) => s.teams.filter((t) => t.league === code).map((t) => ({ name: t.name, league: code, stadium: s })))
    .sort((a, b) => shortClub(a.name).localeCompare(shortClub(b.name), 'de'))
}

/** Stadien einer Liga, alphabetisch */
export const groundsOfLeague = (code: LeagueCode) =>
  [...stadiumsOfLeague(code)].sort((a, b) => a.name.localeCompare(b.name, 'de'))

export interface ListInfo {
  id: ListId
  title: string
  /** Kleiner Zusatz, z. B. das Land */
  subtitle: string
  got: number
  total: number
}

export function listInfo(id: ListId, c: Collection): ListInfo {
  if (id === 'leagues') {
    const got = LEAGUES.filter((l) => c.visits.some((v) => v.league === l.code)).length
    return { id, title: 'Ligen', subtitle: 'Top 5 Europas', got, total: LEAGUES.length }
  }
  if (id === 'derbies') return { id, title: 'Derbys', subtitle: 'Die großen Duelle', got: c.derbies.size, total: DERBIES.length }
  if (id === 'achievements') {
    return { id, title: 'Erfolge', subtitle: 'Meilensteine', got: c.achievements.filter((a) => a.done).length, total: ACHIEVEMENTS.length }
  }
  const [kind, code] = id.split(':') as ['clubs' | 'stadiums', LeagueCode]
  const league = leagueByCode(code)
  if (kind === 'clubs') {
    const all = clubsOfLeague(code)
    return { id, title: league.country, subtitle: `Vereine · ${league.name}`, got: all.filter((x) => c.clubs.has(x.name)).length, total: all.length }
  }
  const all = groundsOfLeague(code)
  return { id, title: league.country, subtitle: `Stadien · ${league.name}`, got: all.filter((s) => c.stadiums.has(s.id)).length, total: all.length }
}

export const CLUB_LISTS: ListId[] = LEAGUES.map((l) => `clubs:${l.code}` as const)
export const STADIUM_LISTS: ListId[] = LEAGUES.map((l) => `stadiums:${l.code}` as const)

export const leagueOfList = (id: ListId): LeagueCode | null =>
  id.includes(':') ? (id.split(':')[1] as LeagueCode) : null
