// Lädt den kompletten Spielplan der Saison einmal und hält ihn für alle Ansichten bereit.

import { useSyncExternalStore } from 'react'
import type { Match, MatchesResponse, ProviderName } from '../shared/types.ts'
import { fetchMatches } from '../lib/api.ts'
import { localDateKey } from '../lib/dates.ts'

export interface MatchesState {
  status: 'loading' | 'ready' | 'error'
  matches: Match[]
  byId: Map<string, Match>
  /** Spiele je Tag (YYYY-MM-DD, Ortszeit) */
  byDay: Map<string, Match[]>
  /** Spiele je Stadion, nach Anstoß sortiert */
  byStadium: Map<string, Match[]>
  /** Wappen-URL je Vereinsname */
  crests: Map<string, string>
  provider: ProviderName | null
  warnings: string[]
  error: string | null
}

let state: MatchesState = {
  status: 'loading', matches: [], byId: new Map(), byDay: new Map(), byStadium: new Map(),
  crests: new Map(), provider: null, warnings: [], error: null,
}
const listeners = new Set<() => void>()
let started = false

function index(res: MatchesResponse): MatchesState {
  const byId = new Map<string, Match>()
  const byDay = new Map<string, Match[]>()
  const byStadium = new Map<string, Match[]>()
  const crests = new Map<string, string>()
  for (const m of res.matches) {
    byId.set(m.id, m)
    const day = localDateKey(m.kickoff)
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day)!.push(m)
    if (m.stadiumId) {
      if (!byStadium.has(m.stadiumId)) byStadium.set(m.stadiumId, [])
      byStadium.get(m.stadiumId)!.push(m)
    }
    if (m.home.crest) crests.set(m.home.name, m.home.crest)
    if (m.away.crest) crests.set(m.away.name, m.away.crest)
  }
  return {
    status: 'ready', matches: res.matches, byId, byDay, byStadium, crests,
    provider: res.provider, warnings: res.warnings, error: null,
  }
}

export function loadMatches() {
  started = true
  state = { ...state, status: 'loading', error: null }
  listeners.forEach((l) => l())
  fetchMatches().then(
    (res) => { state = index(res) },
    (err: Error) => { state = { ...state, status: 'error', error: err.message } },
  ).finally(() => listeners.forEach((l) => l()))
}

export function useMatches(): MatchesState {
  if (!started) loadMatches()
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}
