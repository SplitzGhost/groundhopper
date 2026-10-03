// Hauptquelle: football-data.org (v4). Der Gratis-Plan enthält alle Top-5-Ligen,
// erlaubt aber nur 10 Anfragen pro Minute – deshalb wird serverseitig zwischengespeichert.

import type { LeagueCode, Match, MatchStatus, TeamRef } from '../../src/shared/types.ts'
import { matchTeam } from '../stadiums.ts'
import { fetchJson, type Provider } from './types.ts'

const BASE = 'https://api.football-data.org/v4'

interface FdTeam { id: number | null; name: string | null; shortName: string | null; crest: string | null }
interface FdMatch {
  id: number
  utcDate: string
  status: string
  matchday: number | null
  homeTeam: FdTeam
  awayTeam: FdTeam
  score: {
    fullTime: { home: number | null; away: number | null }
    halfTime: { home: number | null; away: number | null }
  }
}

const STATUS: Record<string, MatchStatus> = {
  SCHEDULED: 'scheduled', TIMED: 'scheduled',
  IN_PLAY: 'live', PAUSED: 'live', SUSPENDED: 'live',
  FINISHED: 'finished', AWARDED: 'finished',
  POSTPONED: 'postponed', CANCELLED: 'cancelled',
}

const team = (t: FdTeam): TeamRef => ({
  id: 'fd-' + (t.id ?? 'tbd'),
  name: t.name ?? 'Unbekannt',
  shortName: t.shortName ?? t.name ?? 'Unbekannt',
  crest: t.crest,
})

export function createFootballDataProvider(apiKey: string): Provider {
  return {
    name: 'football-data',
    async fetchLeague(league: LeagueCode, season: number) {
      const json = await fetchJson<{ matches: FdMatch[] }>(
        `${BASE}/competitions/${league}/matches?season=${season}`,
        { headers: { 'X-Auth-Token': apiKey } },
      )
      const matches: Match[] = json.matches.map((m) => ({
        id: 'fd-' + m.id,
        league,
        season,
        matchday: m.matchday,
        kickoff: m.utcDate,
        status: STATUS[m.status] ?? 'scheduled',
        home: team(m.homeTeam),
        away: team(m.awayTeam),
        score: {
          home: m.score.fullTime.home,
          away: m.score.fullTime.away,
          halfTimeHome: m.score.halfTime.home,
          halfTimeAway: m.score.halfTime.away,
        },
        stadiumId: m.homeTeam.name ? matchTeam(m.homeTeam.name, league)?.stadiumId ?? null : null,
      }))
      return { matches, warnings: [] }
    },
  }
}
