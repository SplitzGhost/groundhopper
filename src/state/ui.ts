// Oberflächenzustand: aktiver Tab, offene Sheets, Kartenfilter und Karten-Fokus.

import { useSyncExternalStore } from 'react'
import type { LeagueCode } from '../shared/types.ts'
import { LEAGUE_CODES } from '../shared/leagues.ts'
import { loadPref, savePref } from '../lib/storage.ts'

function createStore<T>(initial: T) {
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
  | { kind: 'album'; section: string }

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
