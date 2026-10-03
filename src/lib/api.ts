import type { LeagueCode, MatchesResponse } from '../shared/types.ts'

export interface MatchQuery {
  leagues?: LeagueCode[]
  /** YYYY-MM-DD */
  from?: string
  /** YYYY-MM-DD */
  to?: string
}

/** Auf GitHub Pages gibt es keinen API-Server: dort liegt der Spielplan als Datei neben der App
 *  (erzeugt von tools/build-data.ts in der GitHub Action). */
const STATIC = import.meta.env.VITE_STATIC_DATA === '1'

export async function fetchMatches(query: MatchQuery = {}): Promise<MatchesResponse> {
  if (STATIC) {
    const res = await fetch(`${import.meta.env.BASE_URL}data/matches.json`, { cache: 'no-cache' })
    if (!res.ok) throw new Error(`Spiele konnten nicht geladen werden (${res.status})`)
    const data = (await res.json()) as MatchesResponse
    data.matches = data.matches.filter((m) =>
      (!query.leagues?.length || query.leagues.includes(m.league))
      && (!query.from || m.kickoff.slice(0, 10) >= query.from)
      && (!query.to || m.kickoff.slice(0, 10) <= query.to))
    return data
  }
  const params = new URLSearchParams()
  if (query.leagues?.length) params.set('leagues', query.leagues.join(','))
  if (query.from) params.set('from', query.from)
  if (query.to) params.set('to', query.to)
  const res = await fetch('/api/matches?' + params)
  if (!res.ok) throw new Error(`Spiele konnten nicht geladen werden (${res.status})`)
  return res.json() as Promise<MatchesResponse>
}
