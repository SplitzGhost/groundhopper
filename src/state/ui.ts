// Oberflächenzustand: aktiver Tab, offene Sheets, Sammelalbum, Spieltag, Kartenfilter und Karten-Fokus.

import { useSyncExternalStore } from 'react'
import type { LeagueCode } from '../shared/types.ts'
import type { ListId } from '../lib/lists.ts'
import type { BinderSort } from '../lib/matchCards.ts'
import { LEAGUE_CODES } from '../shared/leagues.ts'
import { loadPref, savePref } from '../lib/storage.ts'

export function createStore<T>(initial: T) {
  let value = initial
  const listeners = new Set<() => void>()
  const subscribe = (l: () => void) => {
    listeners.add(l)
    return () => listeners.delete(l)
  }
  return {
    get: () => value,
    set(next: T | ((prev: T) => T)) {
      value = typeof next === 'function' ? (next as (p: T) => T)(value) : next
      listeners.forEach((l) => l())
    },
    use: () => useSyncExternalStore(subscribe, () => value),
  }
}

// ---------- Tabs ----------

export type Tab = 'map' | 'games' | 'album'
export const tabStore = createStore<Tab>('map')

// ---------- Sheets ----------

export type SheetSpec =
  | { kind: 'stadium'; id: string }
  | { kind: 'match'; id: string }
  | { kind: 'visit'; id: string }
  | { kind: 'filter' }
  | { kind: 'search' }
  | { kind: 'profile' }
  | { kind: 'add' }
  | { kind: 'club'; name: string }
  | { kind: 'league'; code: LeagueCode }
  | { kind: 'derby'; id: string }
  | { kind: 'calendar' }

export interface OpenSheet {
  key: number
  spec: SheetSpec
}

let sheetSeq = 0
export const sheetStore = createStore<OpenSheet[]>([])

/** `replace`: vorher alle Sheets schließen (z. B. beim Tippen auf einen anderen Pin) */
export function openSheet(spec: SheetSpec, replace = false) {
  sheetStore.set((s) => [...(replace ? [] : s), { key: ++sheetSeq, spec }])
}
export function closeSheet(key?: number) {
  sheetStore.set((s) => (key === undefined ? s.slice(0, -1) : s.filter((x) => x.key !== key)))
}
export function closeAllSheets() {
  sheetStore.set([])
}

// ---------- Sammelalbum ----------

/** Sammelkarten-Ordner aufgeschlagen? */
export const binderStore = createStore(false)
export const openBinder = () => binderStore.set(true)
export const closeBinder = () => binderStore.set(false)

export const binderSortStore = createStore<BinderSort>(loadPref<BinderSort>('binder-sort', 'newest'))
export function setBinderSort(sort: BinderSort) {
  binderSortStore.set(sort)
  savePref('binder-sort', sort)
}

/** Aufgeschlagene Liste (Vereine eines Landes, Stadien, Ligen …) */
export const listStore = createStore<ListId | null>(null)
export const openList = (id: ListId) => listStore.set(id)
export const closeList = () => listStore.set(null)

/** Vergrößert angezeigte Spielkarte (Besuchs-ID); `memory` öffnet gleich die Erinnerung */
export const cardViewStore = createStore<{ visitId: string; memory?: boolean } | null>(null)
export function openCard(visitId: string, memory = false) {
  cardViewStore.set({ visitId, memory })
}
export function closeCard() {
  cardViewStore.set(null)
}

/** Karte, deren Platz im Ordner während des Flugs leer bleibt */
export const flyingCardStore = createStore<string | null>(null)

/** Frisch verdiente Karte: kommt angeflogen, sobald alle Sheets geschlossen sind */
export const pendingCardStore = createStore<string | null>(null)

// ---------- Spielplan ----------

/** Angezeigter Tag im Spiele-Tab (YYYY-MM-DD) */
export const gamesDayStore = createStore<string | null>(null)

// ---------- Kartenfilter ----------

/** 'all' = alle Stadien, sonst ein Tag als YYYY-MM-DD */
export type DayFilter = 'all' | string

export interface MapFilter {
  leagues: LeagueCode[]
  day: DayFilter
  /** Nur gemerkte Spiele zeigen */
  watchlist: boolean
  onlyUnvisited: boolean
}

const savedFilter = loadPref<Pick<MapFilter, 'leagues' | 'onlyUnvisited'>>('mapfilter', {
  leagues: LEAGUE_CODES, onlyUnvisited: false,
})

export const mapFilterStore = createStore<MapFilter>({ ...savedFilter, day: 'all', watchlist: false })

export function setMapFilter(patch: Partial<MapFilter>) {
  mapFilterStore.set((f) => {
    const next = { ...f, ...patch }
    savePref('mapfilter', { leagues: next.leagues, onlyUnvisited: next.onlyUnvisited })
    return next
  })
}

// ---------- Karten-Fokus (z. B. aus der Suche heraus) ----------

export interface MapFocus {
  seq: number
  lat: number
  lon: number
  zoom: number
  stadiumId?: string
}

let focusSeq = 0
export const mapFocusStore = createStore<MapFocus | null>(null)

export function focusMap(lat: number, lon: number, zoom = 13, stadiumId?: string) {
  tabStore.set('map')
  mapFocusStore.set({ seq: ++focusSeq, lat, lon, zoom, stadiumId })
}
