// Speichert besuchte Spiele und Merkliste lokal im Browser (localStorage).
// Export/Import als JSON-Datei dient als Backup und zum Umzug auf ein anderes Gerät.

import type { UserData, Visit } from '../shared/types.ts'

const KEY = 'groundhopper:userdata'
const EMPTY: UserData = { version: 2, visits: [], watchlist: [] }

export function loadUserData(): UserData {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return structuredClone(EMPTY)
    return migrate(JSON.parse(raw))
  } catch {
    return structuredClone(EMPTY)
  }
}

export function saveUserData(data: UserData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch (err) {
    console.error('Speichern fehlgeschlagen', err)
  }
}

/** Hebt ältere Formate auf den aktuellen Stand. */
function migrate(data: unknown): UserData {
  const d = data as { version?: number; visits?: unknown; watchlist?: unknown }
  if (d && Array.isArray(d.visits)) {
    if (d.version === 2 && Array.isArray(d.watchlist)) return d as UserData
    if (d.version === 1) return { version: 2, visits: d.visits as Visit[], watchlist: [] }
  }
  throw new Error('Unbekanntes Datenformat')
}

export const newId = () => crypto.randomUUID()

export function createVisit(fields: Omit<Visit, 'id' | 'createdAt'>): Visit {
  return { ...fields, id: newId(), createdAt: new Date().toISOString() }
}

export function exportUserData(data: UserData): Blob {
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
}

export async function importUserData(file: File): Promise<UserData> {
  return migrate(JSON.parse(await file.text()))
}

// ---------- Kleine Einstellungen (Filter usw.) ----------

export function loadPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem('groundhopper:' + key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function savePref(key: string, value: unknown): void {
  try {
    localStorage.setItem('groundhopper:' + key, JSON.stringify(value))
  } catch {
    // Privater Modus o. Ä. – Einstellung gilt dann nur für diese Sitzung.
  }
}
