import type { LeagueCode, Match, ProviderName } from '../../src/shared/types.ts'

export interface LeagueResult {
  matches: Match[]
  warnings: string[]
}

export interface Provider {
  name: ProviderName
  fetchLeague(league: LeagueCode, season: number): Promise<LeagueResult>
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} bei ${new URL(url).host}`)
  return (await res.json()) as T
}

export async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} bei ${new URL(url).host}`)
  return res.text()
}
