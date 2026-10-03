// Standort des Geräts – einmal erfragt, für Karte und Entfernungen geteilt.

import { useSyncExternalStore } from 'react'
import { getCurrentPosition, type LatLon } from '../lib/geo.ts'

export interface LocationState {
  status: 'idle' | 'locating' | 'ok' | 'denied'
  position: LatLon | null
  error: string | null
}

let state: LocationState = { status: 'idle', position: null, error: null }
const listeners = new Set<() => void>()
const emit = (next: LocationState) => {
  state = next
  listeners.forEach((l) => l())
}

export function locate(): Promise<LatLon | null> {
  emit({ ...state, status: 'locating' })
  return getCurrentPosition().then(
    (position) => {
      emit({ status: 'ok', position, error: null })
      return position
    },
    (err: Error) => {
      emit({ status: 'denied', position: state.position, error: err.message })
      return null
    },
  )
}

export function useLocation(): LocationState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}
