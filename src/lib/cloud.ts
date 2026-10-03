// Verbindung zum Konto-Server (Supabase). Die App ruft nur die Funktionen gh_* aus supabase/setup.sql auf –
// Passwörter prüft und speichert ausschließlich der Server.
// Projekt-URL und öffentlicher Schlüssel stehen bewusst im Code: Sie sind nicht geheim und landen ohnehin in der App.

import type { Visit } from '../shared/types.ts'

// Supabase-Projekt (Einstellungen → API). Zum Testen per VITE_SUPABASE_URL / VITE_SUPABASE_KEY überschreibbar.
const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_KEY: string = import.meta.env.VITE_SUPABASE_KEY ?? ''

/** Ohne eingetragenes Supabase-Projekt läuft die App wie bisher rein lokal. */
export const cloudEnabled = !!(SUPABASE_URL && SUPABASE_KEY)

/** Was pro Konto auf dem Server liegt */
export interface CloudData {
  version: 1
  visits: Visit[]
  watchlist: string[]
  /** Aufgedeckte Sammelkarten */
  revealed: string[]
  /** IDs gelöschter Besuche – damit ein anderes Gerät sie beim Zusammenführen nicht zurückholt */
  removed: string[]
}

export type CloudError =
  | 'invalid_username'
  | 'invalid_password'
  | 'username_taken'
  | 'wrong_credentials'
  | 'locked'
  | 'invalid_session'
  | 'invalid_data'
  | 'conflict'
  | 'offline'
  | 'server'

export type Result<T> = ({ ok: true } & T) | { ok: false; error: CloudError; retry_after?: number; rev?: number; data?: unknown }

export interface Session {
  token: string
  username: string
  rev: number
  data: unknown
}

async function rpc<T>(fn: string, body: Record<string, unknown>): Promise<Result<T>> {
  if (!cloudEnabled) return { ok: false, error: 'server' }
  if (!navigator.onLine) return { ok: false, error: 'offline' }
  const headers: Record<string, string> = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }
  // Ältere „anon“-Schlüssel sind JWTs und gehören zusätzlich in den Authorization-Header.
  if (SUPABASE_KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${SUPABASE_KEY}`
  let res: Response
  try {
    res = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
  } catch {
    return { ok: false, error: 'offline' }
  }
  if (!res.ok) {
    console.error('Konto-Server antwortet mit', res.status, await res.text().catch(() => ''))
    return { ok: false, error: 'server' }
  }
  return (await res.json()) as Result<T>
}

export const cloud = {
  register: (username: string, password: string) =>
    rpc<Session>('gh_register', { p_username: username, p_password: password }),
  login: (username: string, password: string) =>
    rpc<Session>('gh_login', { p_username: username, p_password: password }),
  logout: (token: string) => rpc<object>('gh_logout', { p_token: token }),
  pull: (token: string) => rpc<{ username: string; rev: number; data: unknown }>('gh_pull', { p_token: token }),
  push: (token: string, data: CloudData, baseRev: number) =>
    rpc<{ rev: number }>('gh_push', { p_token: token, p_data: data, p_base_rev: baseRev }),
  deleteAccount: (token: string, password: string) =>
    rpc<object>('gh_delete_account', { p_token: token, p_password: password }),
}

/** Verständliche Meldung für die Oberfläche */
export function errorText(error: CloudError, retryAfter?: number): string {
  switch (error) {
    case 'invalid_username': return 'Benutzername: 3–20 Zeichen, nur Buchstaben, Zahlen, Punkt, - und _'
    case 'invalid_password': return 'Das Passwort braucht mindestens 6 Zeichen.'
    case 'username_taken': return 'Dieser Benutzername ist schon vergeben.'
    case 'wrong_credentials': return 'Benutzername oder Passwort stimmt nicht.'
    case 'locked': return `Zu viele Versuche. Bitte in ${Math.max(1, Math.ceil((retryAfter ?? 600) / 60))} Minuten erneut probieren.`
    case 'offline': return 'Keine Internetverbindung.'
    case 'invalid_session': return 'Deine Anmeldung ist abgelaufen.'
    default: return 'Der Server ist gerade nicht erreichbar. Bitte später erneut versuchen.'
  }
}

/** Liest beliebige Server-Daten defensiv ein (leeres Konto = {}). */
export function parseCloudData(raw: unknown): CloudData {
  const d = (raw ?? {}) as Partial<CloudData>
  const strings = (x: unknown) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : [])
  return {
    version: 1,
    visits: Array.isArray(d.visits) ? d.visits.filter((v) => v && typeof v.id === 'string') : [],
    watchlist: strings(d.watchlist),
    revealed: strings(d.revealed),
    removed: strings(d.removed),
  }
}

/**
 * Führt zwei Stände zusammen (bei der ersten Anmeldung und wenn zwei Geräte gleichzeitig etwas geändert haben).
 * Besuche: alle aus beiden Ständen, außer gelöschten. Gleiche ID → `mine` gewinnt.
 * Dasselbe Spiel zweimal abgehakt (verschiedene IDs) → nur einmal behalten, Bewertung und Notizen ergänzen.
 */
export function mergeCloudData(mine: CloudData, theirs: CloudData): CloudData {
  const removed = [...new Set([...theirs.removed, ...mine.removed])]
  const gone = new Set(removed)
  const byId = new Map<string, Visit>()
  for (const v of [...theirs.visits, ...mine.visits]) if (!gone.has(v.id)) byId.set(v.id, v)

  const byMatch = new Map<string, Visit>()
  const visits: Visit[] = []
  const dropped: string[] = []
  for (const v of [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const twin = v.matchId ? byMatch.get(v.matchId) : undefined
    if (!twin) {
      const copy = { ...v }
      if (v.matchId) byMatch.set(v.matchId, copy)
      visits.push(copy)
      continue
    }
    // Älteren Eintrag behalten, Lücken aus dem doppelten füllen
    twin.rating ??= v.rating
    if (!twin.notes && v.notes) twin.notes = v.notes
    twin.details ??= v.details
    dropped.push(v.id)
  }

  return {
    version: 1,
    visits,
    watchlist: [...new Set([...theirs.watchlist, ...mine.watchlist])].filter((id) => !byMatch.has(id)),
    revealed: [...new Set([...theirs.revealed, ...mine.revealed])],
    removed: [...removed, ...dropped],
  }
}
