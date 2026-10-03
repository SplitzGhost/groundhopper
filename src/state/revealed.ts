// Welche gesammelten Karten schon aufgedeckt wurden. Neue Spielkarten liegen im Ordner
// zuerst verdeckt und werden mit einem Tipp umgedreht – wie beim Öffnen eines Päckchens.

import { loadPref, savePref } from '../lib/storage.ts'
import { createStore } from './ui.ts'

const store = createStore<Set<string>>(new Set(loadPref<string[]>('cards-revealed', [])))

export const useRevealed = () => store.use()

export function reveal(cardId: string) {
  if (store.get().has(cardId)) return
  const next = new Set(store.get())
  next.add(cardId)
  store.set(next)
  savePref('cards-revealed', [...next])
}
