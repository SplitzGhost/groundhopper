// Globaler Speicher für Besuche und Merkliste – jede Änderung wird sofort lokal gesichert.

import { useSyncExternalStore } from 'react'
import type { Match, UserData, Visit } from '../shared/types.ts'
import { createVisit, loadUserData, saveUserData } from '../lib/storage.ts'
import { localDateKey } from '../lib/dates.ts'
import { diffUnlocks, type Unlock } from '../lib/album.ts'
import { fetchReport, needsReport } from '../lib/matchDetails.ts'
import { notify } from './toast.ts'
import { openSheet, pendingCardStore, sheetStore } from './ui.ts'

let state: UserData = loadUserData()
const listeners = new Set<() => void>()

function set(next: UserData, silent = false) {
  const unlocks = silent ? [] : diffUnlocks(state.visits, next.visits)
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
export const subscribeUserData = subscribe

/** `silent`: ohne „Neu gesammelt“-Mitteilungen (z. B. beim Laden der Sammlung vom Konto) */
export function replaceUserData(data: UserData, { silent = false } = {}) {
  if (pendingCardStore.get() && !data.visits.some((v) => v.id === pendingCardStore.get())) pendingCardStore.set(null)
  set(data, silent)
  void refreshReports()
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
    halfTime: m.score.halfTimeHome !== null && m.score.halfTimeAway !== null ? [m.score.halfTimeHome, m.score.halfTimeAway] : null,
    stadiumId: m.stadiumId,
    customStadium: null,
    rating: null,
    notes: '',
  }
}

export const visitOfMatch = (data: UserData, matchId: string) =>
  data.visits.find((v) => v.matchId === matchId)

/** Neuer Besuch: Karte vormerken (fliegt nach dem Schließen der Sheets ein) und Spielbericht laden. */
function welcome(visit: Visit) {
  pendingCardStore.set(visit.id)
  void ensureReport(visit.id)
}

/** `id`: feste Besuchs-ID (z. B. wenn der Server sie schon kennt) */
export function addVisit(fields: Omit<Visit, 'id' | 'createdAt'>, id?: string): Visit {
  const visit = createVisit(fields, id)
  set({ ...state, visits: [...state.visits, visit], watchlist: state.watchlist.filter((w) => w !== fields.matchId) })
  welcome(visit)
  return visit
}

/** Haken setzen/entfernen: „Ich war bei diesem Spiel“. Beim Setzen öffnet sich gleich Bewertung & Notizen. */
export function toggleMatchVisit(m: Match) {
  const existing = visitOfMatch(state, m.id)
  if (existing) {
    removeVisit(existing.id)
    return
  }
  // Wer da war, muss das Spiel nicht mehr auf der Merkliste haben.
  const visit = createVisit(visitFromMatch(m))
  set({ ...state, visits: [...state.visits, visit], watchlist: state.watchlist.filter((id) => id !== m.id) })
  welcome(visit)
  const top = sheetStore.get().at(-1)?.spec
  if (!(top?.kind === 'match' && top.id === m.id)) openSheet({ kind: 'match', id: m.id })
}

export function updateVisit(id: string, patch: Partial<Visit>) {
  set({ ...state, visits: state.visits.map((v) => (v.id === id ? { ...v, ...patch } : v)) })
}

export function removeVisit(id: string) {
  if (pendingCardStore.get() === id) pendingCardStore.set(null)
  set({ ...state, visits: state.visits.filter((v) => v.id !== id) })
}

// ---------- Spielbericht ----------

const loading = new Set<string>()

/** Lädt Tore, Zuschauer usw. für einen Besuch nach, falls nötig. */
export async function ensureReport(visitId: string) {
  const v = state.visits.find((x) => x.id === visitId)
  if (!v || loading.has(visitId) || !needsReport(v)) return
  loading.add(visitId)
  try {
    const { details, score } = await fetchReport(v)
    const current = state.visits.find((x) => x.id === visitId)
    if (!current) return
    const patch: Partial<Visit> = { details }
    if (score && (current.homeScore === null || current.awayScore === null)) {
      patch.homeScore = score[0]
      patch.awayScore = score[1]
    }
    updateVisit(visitId, patch)
  } catch {
    // Offline o. Ä. – beim nächsten Öffnen der Karte erneut versuchen
  } finally {
    loading.delete(visitId)
  }
}

/** Fehlende Spielberichte nacheinander im Hintergrund laden (schont die Quelle). */
export async function refreshReports() {
  for (const v of state.visits.filter((x) => needsReport(x)).slice(0, 12)) await ensureReport(v.id)
}

// ---------- Merkliste ----------

export function toggleWatch(matchId: string) {
  const on = state.watchlist.includes(matchId)
  set({ ...state, watchlist: on ? state.watchlist.filter((id) => id !== matchId) : [...state.watchlist, matchId] })
  if (!on) notify({ kind: 'info', title: 'Gemerkt', subtitle: 'Auf der Karte unter ★ zu finden', icon: 'star' })
}
