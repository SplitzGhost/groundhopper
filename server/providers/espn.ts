// ESPN (frei zugänglich, ohne Schlüssel) – Spielplan, Anstoßzeiten und Endstände für fast alle
// Wettbewerbe außerhalb der Top 5: zweite Ligen, Europa, Amerika, Asien, Afrika und Pokale.
// Ein Abruf pro Kalenderjahr liefert alle Spiele; die Saison steht an jedem Spiel dabei.

import type { League, Match, MatchStatus, TeamRef } from '../../src/shared/types.ts'
import { leagueSeason } from '../../src/shared/leagues.ts'
import { espnStadiumId, espnTeam } from '../stadiums.ts'
import { fetchJson, type LeagueResult } from './types.ts'

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer'

export interface EspnTeam {
  id: string
  displayName: string
  shortDisplayName?: string
  name?: string
  location?: string
  abbreviation?: string
  color?: string
  alternateColor?: string
}

export interface EspnVenue {
  id?: string
  fullName?: string
  address?: { city?: string; country?: string }
}

export interface EspnEvent {
  id: string
  date: string
  season?: { year: number }
  status: { type: { name: string; state: 'pre' | 'in' | 'post'; completed: boolean } }
  competitions: {
    neutralSite?: boolean
    venue?: EspnVenue
    competitors: { homeAway: 'home' | 'away'; score?: string; team: EspnTeam }[]
  }[]
}

/** Alle Spiele eines Wettbewerbs in einer Saison (Herbst–Frühjahr = zwei Kalenderjahre). */
export async function fetchEspnSeason(slug: string, season: number, calendar = false): Promise<EspnEvent[]> {
  const years = calendar ? [season] : [season, season + 1]
  const out: EspnEvent[] = []
  for (const y of years) {
    const json = await fetchJson<{ events?: EspnEvent[] }>(`${BASE}/${slug}/scoreboard?dates=${y}&limit=1000`)
    out.push(...(json.events ?? []).filter((e) => (e.season?.year ?? season) === season))
  }
  return out
}

function status(e: EspnEvent): MatchStatus {
  const { name, state, completed } = e.status.type
  if (/POSTPONED|DELAYED/.test(name)) return 'postponed'
  if (/CANCELED|CANCELLED|ABANDONED|FORFEIT/.test(name) && !completed) return 'cancelled'
  if (state === 'in') return 'live'
  if (state === 'post') return 'finished'
  return 'scheduled'
}

export async function fetchEspnLeague(league: League): Promise<LeagueResult> {
  const season = leagueSeason(league)
  const events = await fetchEspnSeason(league.espn!, season, league.calendar)
  const matches: Match[] = []
  for (const e of events) {
    const comp = e.competitions[0]
    const home = comp?.competitors.find((c) => c.homeAway === 'home')
    const away = comp?.competitors.find((c) => c.homeAway === 'away')
    if (!home || !away) continue
    const st = status(e)
    const started = st === 'live' || st === 'finished'
    const team = (t: EspnTeam): TeamRef => ({
      id: 'espn-' + t.id,
      name: espnTeam(t, league.code)?.team ?? t.displayName,
      shortName: t.shortDisplayName || t.displayName,
      // Wappen ergänzt die App aus der ESPN-ID – spart Platz in der Spielplan-Datei
      crest: null,
    })
    const score = (s?: string) => (started && s !== undefined && s !== '' ? Number(s) : null)
    matches.push({
      id: 'espn-' + e.id,
      league: league.code,
      season,
      matchday: null,
      kickoff: e.date.length === 17 ? e.date.replace('Z', ':00Z') : e.date,
      status: st,
      home: team(home.team),
      away: team(away.team),
      score: { home: score(home.score), away: score(away.score), halfTimeHome: null, halfTimeAway: null },
      stadiumId: espnStadiumId(home.team, league.code, comp.venue?.id, !!comp.neutralSite),
    })
  }
  return { matches, warnings: [] }
}
