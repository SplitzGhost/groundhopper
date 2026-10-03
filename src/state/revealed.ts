// Welche gesammelten Karten schon aufgedeckt wurden. Neu gesammelte Karten liegen im Album
// zuerst verdeckt und werden mit einem Tipp umgedreht – wie beim Öffnen eines Päckchens.

import { loadPref, savePref } from '../lib/storage.ts'
import { createStore } from './ui.ts'

const store = createStore<Set<string>>(new Set(loadPref<string[]>('album-revealed', [])))

export const useRevealed = () => store.use()

export function reveal(cardId: string) {
  if (store.get().has(cardId)) return
  const next = new Set(store.get())
  next.add(cardId)
  store.set(next)
  savePref('album-revealed', [...next])
}
