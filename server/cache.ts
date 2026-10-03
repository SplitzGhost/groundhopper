// Einfacher Zwischenspeicher im Arbeitsspeicher und auf der Festplatte (.cache/).
// Schont die Anfrage-Limits der Datenquellen und liefert bei Ausfällen den letzten Stand.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const DIR = new URL('../.cache/', import.meta.url)
mkdirSync(DIR, { recursive: true })

interface Entry<T> { at: number; data: T }
const memory = new Map<string, Entry<unknown>>()

function readDisk<T>(key: string): Entry<T> | null {
  try {
    return JSON.parse(readFileSync(new URL(key + '.json', DIR), 'utf8')) as Entry<T>
  } catch {
    return null
  }
}

export interface CacheResult<T> {
  data: T
  /** true, wenn das Laden fehlschlug und ein älterer Stand geliefert wird */
  stale: boolean
  error?: string
}

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<CacheResult<T>> {
  const entry = (memory.get(key) as Entry<T> | undefined) ?? readDisk<T>(key)
  if (entry && Date.now() - entry.at < ttlMs) return { data: entry.data, stale: false }
  try {
    const data = await load()
    const fresh = { at: Date.now(), data }
    memory.set(key, fresh)
    writeFileSync(new URL(key + '.json', DIR), JSON.stringify(fresh))
    return { data, stale: false }
  } catch (err) {
    if (!entry) throw err
    return { data: entry.data, stale: true, error: (err as Error).message }
  }
}
