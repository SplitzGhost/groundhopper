// Sammellisten zum Vervollständigen: Vereine und Stadien je Land (unterteilt nach Ligen),
// Wettbewerbe, Derbys, Erfolge.

import type { League, LeagueCode, Stadium } from '../shared/types.ts'
import { DOMESTIC_LEAGUES, LEAGUES } from '../shared/leagues.ts'
import { countryName } from '../shared/countries.ts'
import { STADIUMS, stadiumsOfLeague } from './stadiums.ts'
import { DERBIES } from './derbies.ts'
import { ACHIEVEMENTS, type Collection } from './album.ts'
import { shortClub } from './matchCards.ts'

/** Länderlisten tragen den Länder-/Verbandscode, z. B. `clubs:de` */
export type ListId = `clubs:${string}` | `stadiums:${string}` | 'leagues' | 'derbies' | 'achievements'

export interface ClubEntry {
  name: string
  league: LeagueCode
  stadium: Stadium
}

/** Die Stadion-Datenbank ändert sich zur Laufzeit nicht – Listen nur einmal berechnen */
function memo<T>(fn: (key: string) => T): (key: string) => T {
  const cache = new Map<string, T>()
  return (key) => {
    if (!cache.has(key)) cache.set(key, fn(key))
    return cache.get(key)!
  }
}

/** Vereine einer Liga, alphabetisch nach Kurzname (Köln unter K, nicht unter 1.) */
export const clubsOfLeague = memo((code: LeagueCode): ClubEntry[] =>
  STADIUMS.flatMap((s) => s.teams.filter((t) => t.league === code).map((t) => ({ name: t.name, league: code, stadium: s })))
    .sort((a, b) => shortClub(a.name).localeCompare(shortClub(b.name), 'de')))

/** Stadien einer Liga, alphabetisch */
export const groundsOfLeague = memo((code: LeagueCode) =>
  [...stadiumsOfLeague(code)].sort((a, b) => a.name.localeCompare(b.name, 'de')))

/** Ligen eines Landes, höchste zuerst */
export const leaguesOfCountry = (cc: string): League[] => DOMESTIC_LEAGUES.filter((l) => l.countryCode === cc)

export interface ListSection<T> {
  league: League
  items: T[]
}

/** Vereine eines Landes, je Liga ein Abschnitt */
export const clubSections = memo((cc: string): ListSection<ClubEntry>[] =>
  leaguesOfCountry(cc).map((league) => ({ league, items: clubsOfLeague(league.code) })).filter((s) => s.items.length))

/** Stadien eines Landes, je Liga ein Abschnitt – geteilte Stadien stehen bei der höheren Liga */
export const groundSections = memo((cc: string): ListSection<Stadium>[] => {
  const seen = new Set<string>()
  return leaguesOfCountry(cc).map((league) => {
    const items = groundsOfLeague(league.code).filter((s) => !seen.has(s.id))
    items.forEach((s) => seen.add(s.id))
    return { league, items }
  }).filter((s) => s.items.length)
})

const countClubs = (cc: string) => clubSections(cc).flatMap((s) => s.items)
const countGrounds = (cc: string) => groundSections(cc).flatMap((s) => s.items)

export interface ListInfo {
  id: ListId
  title: string
  /** Kleiner Zusatz, z. B. die Ligen */
  subtitle: string
  got: number
  total: number
}

export function listInfo(id: ListId, c: Collection): ListInfo {
  if (id === 'leagues') {
    const got = LEAGUES.filter((l) => c.visits.some((v) => v.league === l.code)).length
    return { id, title: 'Wettbewerbe', subtitle: 'Ligen und Pokale weltweit', got, total: LEAGUES.length }
  }
  if (id === 'derbies') return { id, title: 'Derbys', subtitle: 'Die großen Duelle', got: c.derbies.size, total: DERBIES.length }
  if (id === 'achievements') {
    return { id, title: 'Erfolge', subtitle: 'Meilensteine', got: c.achievements.filter((a) => a.done).length, total: ACHIEVEMENTS.length }
  }
  const [kind, cc] = id.split(':') as ['clubs' | 'stadiums', string]
  const leagues = leaguesOfCountry(cc)
  const sub = leagues.length === 1 ? leagues[0].name : `${leagues.length} Ligen`
  if (kind === 'clubs') {
    const all = countClubs(cc)
    return { id, title: countryName(cc), subtitle: `Vereine · ${sub}`, got: all.filter((x) => c.clubs.has(x.name)).length, total: all.length }
  }
  const all = countGrounds(cc)
  return { id, title: countryName(cc), subtitle: `Stadien · ${sub}`, got: all.filter((s) => c.stadiums.has(s.id)).length, total: all.length }
}

/** Länder mit eigenen Ligen, in Katalogreihenfolge */
export const LIST_COUNTRIES = [...new Set(DOMESTIC_LEAGUES.map((l) => l.countryCode))]

export const CLUB_LISTS: ListId[] = LIST_COUNTRIES.map((cc) => `clubs:${cc}` as const)
export const STADIUM_LISTS: ListId[] = LIST_COUNTRIES.map((cc) => `stadiums:${cc}` as const)

/** Länder-/Verbandscode einer Länderliste */
export const countryOfList = (id: ListId): string | null =>
  id.includes(':') ? id.split(':')[1] : null
