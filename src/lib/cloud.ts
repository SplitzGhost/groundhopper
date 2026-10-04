// Verbindung zum Konto-Server (Supabase). Die App ruft nur die Funktionen gh_* aus supabase/setup.sql auf –
// Passwörter prüft und speichert ausschließlich der Server.
// Projekt-URL und öffentlicher Schlüssel stehen bewusst im Code: Sie sind nicht geheim und landen ohnehin in der App.

import type { Visit } from '../shared/types.ts'
import { parseHopper, type Hopper } from './hopper/look.ts'

// Supabase-Projekt (Einstellungen → API). Zum Testen per VITE_SUPABASE_URL / VITE_SUPABASE_KEY überschreibbar.
const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? 'https://mdrtltdminlbfvtgmhto.supabase.co'
const SUPABASE_KEY: string = import.meta.env.VITE_SUPABASE_KEY ?? 'sb_publishable_U5UVO1oNjh3ZXl5q--LvDQ_1x9cRidu'

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
  /** Eigener Hopper (Aussehen, angezogenes Trikot); null = noch keiner angelegt */
  hopper: Hopper | null
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
  | 'not_found'
  | 'not_friends'
  | 'not_member'
  | 'limit'
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

  // ---------- Freunde ----------
  social: (token: string) => rpc<SocialData>('gh_social', { p_token: token }),
  searchUsers: (token: string, query: string) =>
    rpc<{ users: FoundUser[] }>('gh_search_users', { p_token: token, p_query: query }),
  friendRequest: (token: string, username: string) =>
    rpc<{ relation: Relation }>('gh_friend_request', { p_token: token, p_username: username }),
  friendRespond: (token: string, username: string, accept: boolean) =>
    rpc<object>('gh_friend_respond', { p_token: token, p_username: username, p_accept: accept }),
  friendRemove: (token: string, username: string) =>
    rpc<object>('gh_friend_remove', { p_token: token, p_username: username }),
  friend: (token: string, username: string) =>
    rpc<FriendProfile>('gh_friend', { p_token: token, p_username: username }),

  // ---------- Gemeinsame Spiele ----------
  tagFriends: (token: string, group: string, visitId: string, visit: SharedVisit, usernames: string[]) =>
    rpc<{ sent: number }>('gh_tag_friends', { p_token: token, p_group: group, p_visit_id: visitId, p_visit: visit, p_usernames: usernames }),
  tagRespond: (token: string, group: string, accept: boolean, visitId: string | null) =>
    rpc<object>('gh_tag_respond', { p_token: token, p_group: group, p_accept: accept, p_visit_id: visitId }),

  // ---------- Fotos & Profilbilder ----------
  addPhoto: (token: string, visitId: string, thumb: string, image: string) =>
    rpc<{ id: string }>('gh_add_photo', { p_token: token, p_visit_id: visitId, p_thumb: thumb, p_image: image }),
  photos: (token: string, username: string | null, visitId: string) =>
    rpc<{ photos: PhotoInfo[] }>('gh_photos', { p_token: token, p_username: username, p_visit_id: visitId }),
  photo: (token: string, id: string) => rpc<{ image: string }>('gh_photo', { p_token: token, p_id: id }),
  deletePhoto: (token: string, id: string) => rpc<object>('gh_delete_photo', { p_token: token, p_id: id }),
  setAvatar: (token: string, image: string | null) =>
    rpc<{ v: number | null }>('gh_set_avatar', { p_token: token, p_image: image }),
  avatars: (token: string, usernames: string[]) =>
    rpc<{ avatars: { username: string; v: number; image: string }[] }>('gh_avatars', { p_token: token, p_usernames: usernames }),
}

// ---------- Freunde: Datentypen der Server-Antworten ----------

/** `avatar`: Version des Profilbilds, null = keins */
export interface SocialUser {
  username: string
  avatar: number | null
  /** Hopper roh vom Server (erst nach dem Datenbank-Update vorhanden) – mit parseHopper lesen */
  hopper?: unknown
}

export interface FriendInfo extends SocialUser {
  since: string | null
  games: number
  stadiums: number
}

export interface PendingRequest extends SocialUser {
  at: string
}

/** Spieldaten, die beim Markieren mitgeschickt werden (ohne Bewertung und Notizen) */
export type SharedVisit = Omit<Visit, 'id' | 'createdAt' | 'rating' | 'notes'>

/** „Warst du dabei?“ – ein Freund hat einen bei einem Spiel markiert */
export interface TagRequest {
  group: string
  /** null, falls das Konto inzwischen gelöscht ist */
  from: string | null
  avatar: number | null
  visit: SharedVisit
  at: string
}

export interface GroupMember extends SocialUser {
  status: 'pending' | 'accepted'
}

/** Gemeinsam besuchtes Spiel: `visit` ist der eigene Besuch, `members` die anderen */
export interface MatchGroup {
  group: string
  visit: string
  members: GroupMember[]
}

export interface SocialData {
  me: SocialUser
  friends: FriendInfo[]
  incoming: PendingRequest[]
  outgoing: PendingRequest[]
  tags: TagRequest[]
  groups: MatchGroup[]
}

export type Relation = 'none' | 'friend' | 'outgoing' | 'incoming'

export interface FoundUser extends SocialUser {
  relation: Relation
}

export interface FriendProfile extends SocialUser {
  /** Ohne Notizen */
  visits: Visit[]
  groups: { visit: string; members: GroupMember[] }[]
}

export interface PhotoInfo {
  id: string
  username: string
  mine: boolean
  /** Vorschaubild als Base64-JPEG */
  thumb: string
  at: string
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
    case 'not_found': return 'Nicht gefunden – vielleicht wurde es gerade gelöscht.'
    case 'not_friends': return 'Ihr seid nicht mehr befreundet.'
    case 'not_member': return 'Du bist bei diesem Spiel nicht als dabei eingetragen.'
    case 'limit': return 'Das Limit ist erreicht.'
    case 'invalid_data': return 'Das hat nicht geklappt – die Daten sind ungültig.'
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
    hopper: parseHopper(d.hopper),
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
    // Hopper: der zuletzt geänderte gewinnt
    hopper: !mine.hopper ? theirs.hopper : !theirs.hopper ? mine.hopper
      : mine.hopper.updatedAt >= theirs.hopper.updatedAt ? mine.hopper : theirs.hopper,
  }
}
