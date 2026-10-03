// Kompaktes Format der statischen Spielplan-Datei (GitHub Pages): Vereine stehen einmal in einer
// Tabelle, Spiele als Arrays mit Verweis darauf. Bei rund 20 000 Spielen weltweit schrumpft die
// Datei so auf etwa ein Viertel – wichtig für den Start der App unterwegs.

import type { Match, MatchStatus, MatchesResponse, TeamRef } from './types.ts'

type TeamRow = [id: string, name: string, shortName: string, crest: string | null]
type MatchRow = [
  id: string, league: string, season: number, matchday: number | null, kickoff: string, status: MatchStatus,
  home: number, away: number, scoreHome: number | null, scoreAway: number | null,
  halfTimeHome: number | null, halfTimeAway: number | null, stadiumId: string | null,
]

export interface CompactMatches extends Omit<MatchesResponse, 'matches'> {
  format: 'compact-1'
  teams: TeamRow[]
  matches: MatchRow[]
}

export function packMatches(res: MatchesResponse): CompactMatches {
  const teams: TeamRow[] = []
  const index = new Map<string, number>()
  const ref = (t: TeamRef) => {
    const key = `${t.id}|${t.name}|${t.shortName}|${t.crest}`
    if (!index.has(key)) {
      index.set(key, teams.length)
      teams.push([t.id, t.name, t.shortName, t.crest])
    }
    return index.get(key)!
  }
  const matches = res.matches.map((m): MatchRow => [
    m.id, m.league, m.season, m.matchday, m.kickoff, m.status, ref(m.home), ref(m.away),
    m.score.home, m.score.away, m.score.halfTimeHome, m.score.halfTimeAway, m.stadiumId,
  ])
  return { ...res, format: 'compact-1', teams, matches }
}

export function unpackMatches(data: CompactMatches | MatchesResponse): MatchesResponse {
  if (!('format' in data)) return data
  const teams = data.teams.map(([id, name, shortName, crest]): TeamRef => ({ id, name, shortName, crest }))
  const matches = data.matches.map(([id, league, season, matchday, kickoff, status, h, a, sh, sa, hth, hta, stadiumId]): Match => ({
    id, league, season, matchday, kickoff, status, home: teams[h], away: teams[a],
    score: { home: sh, away: sa, halfTimeHome: hth, halfTimeAway: hta }, stadiumId,
  }))
  const { format: _format, teams: _teams, ...rest } = data
  return { ...rest, matches }
}
