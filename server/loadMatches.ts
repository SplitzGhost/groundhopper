// Spielplan aus der aktiven Datenquelle laden – genutzt vom API-Server und vom Build-Skript
// für die statische Website (tools/build-data.ts).

import type { LeagueCode, Match, MatchesResponse } from '../src/shared/types.ts'
import { cached } from './cache.ts'
import { createFootballDataProvider } from './providers/footballData.ts'
import { demoProvider } from './providers/demo.ts'

const API_KEY = process.env.FOOTBALL_DATA_API_KEY?.trim() ?? ''
const CACHE_MINUTES = Number(process.env.CACHE_MINUTES ?? 5)

export const provider = API_KEY ? createFootballDataProvider(API_KEY) : demoProvider
export const hasApiKey = !!API_KEY

export async function loadMatches(leagues: LeagueCode[], season: number): Promise<MatchesResponse> {
  const matches: Match[] = []
  const warnings: string[] = []
  // Nacheinander statt parallel – schont das Limit von 10 Anfragen/Minute.
  for (const league of leagues) {
    try {
      const res = await cached(`${provider.name}-${league}-${season}`, CACHE_MINUTES * 60_000,
        () => provider.fetchLeague(league, season))
      matches.push(...res.data.matches)
      warnings.push(...res.data.warnings)
      if (res.stale) warnings.push(`${league}: Aktualisierung fehlgeschlagen (${res.error}), zeige letzten Stand.`)
    } catch (err) {
      warnings.push(`${league}: Daten konnten nicht geladen werden (${(err as Error).message}).`)
    }
  }
  const unknown = new Set(matches.filter((m) => !m.stadiumId).map((m) => m.home.name))
  if (unknown.size) warnings.push(`Kein Stadion zugeordnet für: ${[...unknown].join(', ')}`)
  matches.sort((a, b) => a.kickoff.localeCompare(b.kickoff))
  return { provider: provider.name, season, updatedAt: new Date().toISOString(), matches, warnings }
}
