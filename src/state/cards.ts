// Spielkarten aus den Besuchen – einmal berechnet und von allen Ansichten geteilt.

import type { Visit } from '../shared/types.ts'
import { buildCards, type MatchCard } from '../lib/matchCards.ts'
import { useUserData } from './userData.ts'

let cacheFor: Visit[] | null = null
let cache: MatchCard[] = []

export function cardsOf(visits: Visit[]): MatchCard[] {
  if (visits !== cacheFor) {
    cacheFor = visits
    cache = buildCards(visits)
  }
  return cache
}

export function useCards(): MatchCard[] {
  return cardsOf(useUserData().visits)
}
