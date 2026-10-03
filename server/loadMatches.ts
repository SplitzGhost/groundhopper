// Spielplan aus den Datenquellen laden – genutzt vom API-Server und vom Build-Skript
// für die statische Website (tools/build-data.ts).
//   Top 5           – football-data.org (mit Schlüssel) bzw. freie Demo-Quellen
//   fast alles sonst – ESPN (frei, ohne Schlüssel)
//   3. Liga, RL     – OpenLigaDB

import type { League, LeagueCode, Match, MatchesResponse } from '../src/shared/types.ts'
import { currentSeason, leagueByCode, leagueSeason } from '../src/shared/leagues.ts'
import { cached } from './cache.ts'
import { createFootballDataProvider } from './providers/footballData.ts'
import { demoProvider, openLigaDb } from './providers/demo.ts'
import { fetchEspnLeague } from './providers/espn.ts'
import type { LeagueResult } from './providers/types.ts'

const API_KEY = process.env.FOOTBALL_DATA_API_KEY?.trim() ?? ''
const CACHE_MINUTES = Number(process.env.CACHE_MINUTES ?? 5)
/** Gleichzeitige Abrufe bei ESPN/OpenLigaDB (ohne enges Anfragelimit) */
const PARALLEL = 6

export const provider = API_KEY ? createFootballDataProvider(API_KEY) : demoProvider
export const hasApiKey = !!API_KEY

function fetchLeague(l: League): Promise<LeagueResult> {
  const season = leagueSeason(l)
  if (l.source === 'top5') return provider.fetchLeague(l.code, season)
  if (l.source === 'openligadb') return openLigaDb(l.code, l.openLigaDb!, season)
  return fetchEspnLeague(l)
}

const cacheKey = (l: League) =>
  `${l.source === 'top5' ? provider.name : l.source}-${l.code}-${leagueSeason(l)}`

export async function loadMatches(codes: LeagueCode[]): Promise<MatchesResponse> {
  const leagues = codes.map(leagueByCode)
  const results = new Map<LeagueCode, { matches: Match[]; warnings: string[] }>()

  const load = async (l: League) => {
    try {
      const res = await cached(cacheKey(l), CACHE_MINUTES * 60_000, () => fetchLeague(l))
      const warnings = [...res.data.warnings]
      if (res.stale) warnings.push(`${l.name}: Aktualisierung fehlgeschlagen (${res.error}), zeige letzten Stand.`)
      results.set(l.code, { matches: res.data.matches, warnings })
    } catch (err) {
      results.set(l.code, { matches: [], warnings: [`${l.name}: Daten konnten nicht geladen werden (${(err as Error).message}).`] })
    }
  }

  // Top 5 nacheinander – schont das Limit von football-data.org (10 Anfragen/Minute) –,
  // alle anderen in mehreren Strängen parallel.
  const queue = leagues.filter((l) => l.source !== 'top5')
  await Promise.all([
    (async () => { for (const l of leagues.filter((x) => x.source === 'top5')) await load(l) })(),
    ...Array.from({ length: PARALLEL }, async () => {
      for (let l = queue.shift(); l; l = queue.shift()) await load(l)
    }),
  ])

  const matches: Match[] = []
  const warnings: string[] = []
  for (const l of leagues) {
    const r = results.get(l.code)!
    matches.push(...r.matches)
    warnings.push(...r.warnings)
    // Fehlende Stadien nur bei Ligen melden – in Pokalen spielen viele Amateurvereine
    if (l.kind === 'league') {
      const unknown = new Set(r.matches.filter((m) => !m.stadiumId).map((m) => m.home.name))
      if (unknown.size) warnings.push(`${l.name}: kein Stadion für ${[...unknown].join(', ')}`)
    }
  }
  matches.sort((a, b) => a.kickoff.localeCompare(b.kickoff))
  return { provider: provider.name, season: currentSeason(), updatedAt: new Date().toISOString(), matches, warnings }
}
