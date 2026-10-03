import { useSyncExternalStore } from 'react'

const query = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null

/** Folgt dem Hell-/Dunkelmodus des Systems. */
export function useDarkMode(): boolean {
  return useSyncExternalStore(
    (l) => {
      query?.addEventListener('change', l)
      return () => query?.removeEventListener('change', l)
    },
    () => query?.matches ?? false,
  )
}
