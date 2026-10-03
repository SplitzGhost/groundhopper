// Auswertungen der Besuche: gesammelte Stadien, Fortschritt pro Liga, Kennzahlen.

import type { LeagueCode, Visit } from '../shared/types.ts'
import { LEAGUES } from '../shared/leagues.ts'
import { STADIUMS, stadiumsOfLeague } from './stadiums.ts'

export interface StadiumProgress {
  stadiumId: string
  visits: number
  firstVisit: string
  lastVisit: string
}

/** Besuchte Stadien aus der Datenbank, mit Anzahl und erstem/letztem Besuch. */
export function visitedStadiums(visits: Visit[]): Map<string, StadiumProgress> {
  const map = new Map<string, StadiumProgress>()
  for (const v of visits) {
    if (!v.stadiumId) continue
    const p = map.get(v.stadiumId)
    if (!p) map.set(v.stadiumId, { stadiumId: v.stadiumId, visits: 1, firstVisit: v.date, lastVisit: v.date })
    else {
      p.visits++
      if (v.date < p.firstVisit) p.firstVisit = v.date
      if (v.date > p.lastVisit) p.lastVisit = v.date
    }
  }
  return map
}

export interface LeagueProgress {
  league: LeagueCode
  visited: number
  total: number
}

export function leagueProgress(visits: Visit[]): LeagueProgress[] {
  const visited = visitedStadiums(visits)
  return LEAGUES.map((l) => {
    const all = stadiumsOfLeague(l.code)
    return { league: l.code, visited: all.filter((s) => visited.has(s.id)).length, total: all.length }
  })
}

export interface Stats {
  games: number
  stadiums: number
  /** Eigene Stadien außerhalb der Datenbank (z. B. Amateurplätze) */
  customGrounds: number
  totalStadiums: number
  goals: number
  goalsPerGame: number
  countries: number
}

export function computeStats(visits: Visit[]): Stats {
  const visited = visitedStadiums(visits)
  const scored = visits.filter((v) => v.homeScore !== null && v.awayScore !== null)
  const goals = scored.reduce((sum, v) => sum + v.homeScore! + v.awayScore!, 0)
  const customGrounds = new Set(visits.filter((v) => v.customStadium)
    .map((v) => `${v.customStadium!.name}|${v.customStadium!.city}`)).size
  const countries = new Set([
    ...STADIUMS.filter((s) => visited.has(s.id)).map((s) => s.country),
  ]).size
  return {
    games: visits.length,
    stadiums: visited.size,
    customGrounds,
    totalStadiums: STADIUMS.length,
    goals,
    goalsPerGame: scored.length ? goals / scored.length : 0,
    countries,
  }
}
