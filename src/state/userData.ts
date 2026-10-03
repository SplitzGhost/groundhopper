// Globaler Speicher für Besuche und Merkliste – jede Änderung wird sofort lokal gesichert.

import { useSyncExternalStore } from 'react'
import type { Match, UserData, Visit } from '../shared/types.ts'
import { createVisit, loadUserData, saveUserData } from '../lib/storage.ts'
import { localDateKey } from '../lib/dates.ts'
import { diffUnlocks, type Unlock } from '../lib/album.ts'
import { notify } from './toast.ts'

let state: UserData = loadUserData()
const listeners = new Set<() => void>()

function set(next: UserData) {
  const unlocks = diffUnlocks(state.visits, next.visits)
  state = next
  saveUserData(state)
  listeners.forEach((l) => l())
  announce(unlocks)
}

function announce(unlocks: Unlock[]) {
  if (!unlocks.length) return
  // Wichtigstes zuerst: Erfolg > Derby > Stadion > Verein
  const [top, ...rest] = unlocks
  notify({
    kind: 'unlock',
    title: top.title,
    subtitle: rest.length ? `${top.subtitle} · +${rest.length} weitere` : top.subtitle,
    icon: top.icon,
  })
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useUserData(): UserData {
  return useSyncExternalStore(subscribe, () => state)
}

export const getUserData = () => state

export function replaceUserData(data: UserData) {
  set(data)
}

// ---------- Besuche ----------

export function visitFromMatch(m: Match): Omit<Visit, 'id' | 'createdAt'> {
  return {
    matchId: m.id,
    date: localDateKey(m.kickoff),
    kickoff: m.kickoff,
    league: m.league,
    competition: null,
    homeTeam: m.home.name,
    awayTeam: m.away.name,
    homeCrest: m.home.crest,
    awayCrest: m.away.crest,
    homeScore: m.score.home,
    awayScore: m.score.away,
    stadiumId: m.stadiumId,
    customStadium: null,
    rating: null,
    notes: '',
  }
}

export const visitOfMatch = (data: UserData, matchId: string) =>
  data.visits.find((v) => v.matchId === matchId)

export function addVisit(fields: Omit<Visit, 'id' | 'createdAt'>) {
  set({ ...state, visits: [...state.visits, createVisit(fields)] })
}

/** Haken setzen/entfernen: „Ich war bei diesem Spiel“. */
export function toggleMatchVisit(m: Match) {
  const existing = visitOfMatch(state, m.id)
  if (existing) removeVisit(existing.id)
  else {
    // Wer da war, muss das Spiel nicht mehr auf der Merkliste haben.
    const visit = createVisit(visitFromMatch(m))
    set({ ...state, visits: [...state.visits, visit], watchlist: state.watchlist.filter((id) => id !== m.id) })
  }
}

export function updateVisit(id: string, patch: Partial<Visit>) {
  set({ ...state, visits: state.visits.map((v) => (v.id === id ? { ...v, ...patch } : v)) })
}

export function removeVisit(id: string) {
  set({ ...state, visits: state.visits.filter((v) => v.id !== id) })
}

// ---------- Merkliste ----------

export function toggleWatch(matchId: string) {
  const on = state.watchlist.includes(matchId)
  set({ ...state, watchlist: on ? state.watchlist.filter((id) => id !== matchId) : [...state.watchlist, matchId] })
  if (!on) notify({ kind: 'info', title: 'Gemerkt', subtitle: 'Auf der Karte unter ★ zu finden', icon: 'star' })
}
