// Freunde, gemeinsame Spiele, Fotos und Profilbilder.
// Anders als die Sammlung lebt das nur auf dem Server: Der Stand wird beim Start, beim Zurückkehren
// in die App und jede Minute geholt; nach jeder Aktion sofort.

import { useEffect, useMemo } from 'react'
import type { Visit } from '../shared/types.ts'
import {
  cloud, errorText, type FoundUser, type FriendProfile, type GroupMember, type PhotoInfo,
  type Relation, type SharedVisit, type SocialData, type TagRequest,
} from '../lib/cloud.ts'
import { avatarFromFile, jpegSrc, photoFromFile } from '../lib/images.ts'
import { canonicalTeam } from '../lib/album.ts'
import { buildCards, type MatchCard } from '../lib/matchCards.ts'
import { loadPref, newId, savePref } from '../lib/storage.ts'
import { getAccount, subscribeAccount } from './account.ts'
import { addVisit, getUserData } from './userData.ts'
import { createStore } from './ui.ts'
import { notify } from './toast.ts'

const tokenOf = () => {
  const a = getAccount()
  return a.mode === 'user' ? a.token : null
}
const keyOf = (username: string) => username.toLowerCase()

// ---------- Übersicht (Freunde, Anfragen, gemeinsame Spiele) ----------

export interface SocialState {
  /** 'off' = kein Konto */
  status: 'off' | 'loading' | 'ready' | 'error'
  data: SocialData | null
}

interface Cached {
  username: string
  data: SocialData
}

/** Zuletzt bekannter Stand – damit Freunde und Anfragen auch offline sofort da sind */
function cachedFor(username: string | null): SocialData | null {
  const c = loadPref<Cached | null>('social', null)
  return c && username && c.username === username ? c.data : null
}

const initialUser = () => {
  const a = getAccount()
  return a.mode === 'user' ? a.username : null
}

const store = createStore<SocialState>({ status: initialUser() ? 'loading' : 'off', data: cachedFor(initialUser()) })
export const useSocial = () => store.use()
export const getSocial = () => store.get()

/** Offene Anfragen (Freundschaft + „Warst du dabei?“) – für das Abzeichen am Tab */
export function usePendingCount() {
  const { data } = useSocial()
  return data ? data.incoming.length + data.tags.length : 0
}

let inflight: Promise<void> | null = null

export function refreshSocial(): Promise<void> {
  if (inflight) return inflight
  inflight = load().finally(() => {
    inflight = null
  })
  return inflight
}

async function load() {
  const a = getAccount()
  if (a.mode !== 'user') return
  if (!store.get().data) store.set({ status: 'loading', data: null })
  const r = await cloud.social(a.token)
  const now = getAccount()
  if (now.mode !== 'user' || now.token !== a.token) return
  if (!r.ok) {
    store.set((s) => ({ ...s, status: 'error' }))
    return
  }
  const data: SocialData = { me: r.me, friends: r.friends, incoming: r.incoming, outgoing: r.outgoing, tags: r.tags, groups: r.groups }
  store.set({ status: 'ready', data })
  savePref('social', { username: a.username, data } satisfies Cached)
  announce(data)
}

/** Neue Anfragen einmalig als Mitteilung zeigen */
function announce(data: SocialData) {
  const seen = new Set(loadPref<string[]>('social-seen', []))
  const fresh = [
    ...data.incoming.filter((x) => !seen.has('f:' + keyOf(x.username)))
      .map((x) => ({ key: 'f:' + keyOf(x.username), title: 'Freundschaftsanfrage', subtitle: `${x.username} möchte dein Freund sein` })),
    ...data.tags.filter((t) => !seen.has('t:' + t.group))
      .map((t) => ({ key: 't:' + t.group, title: `${t.from ?? 'Jemand'} hat dich markiert`, subtitle: `Warst du bei ${t.visit.homeTeam} – ${t.visit.awayTeam} dabei?` })),
  ]
  if (!fresh.length) return
  const [top, ...rest] = fresh
  notify({ kind: 'info', title: top.title, subtitle: rest.length ? `${top.subtitle} · +${rest.length} weitere` : top.subtitle, icon: 'info' })
  // Nur aktuelle Anfragen merken, damit die Liste nicht endlos wächst
  const current = [...data.incoming.map((x) => 'f:' + keyOf(x.username)), ...data.tags.map((t) => 't:' + t.group)]
  savePref('social-seen', current)
}

// Anmelden/Abmelden: Stand zurücksetzen bzw. neu laden
let lastUser = initialUser()
subscribeAccount(() => {
  const user = initialUser()
  if (user === lastUser) return
  lastUser = user
  friends.clear()
  photoLists.clear()
  if (!user) {
    store.set({ status: 'off', data: null })
    savePref('social', null)
    return
  }
  store.set({ status: 'loading', data: cachedFor(user) })
  void refreshSocial()
})

if (typeof document !== 'undefined') {
  setTimeout(() => void refreshSocial(), 1000)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void refreshSocial()
  })
  addEventListener('online', () => void refreshSocial())
  setInterval(() => {
    if (document.visibilityState === 'visible') void refreshSocial()
  }, 60_000)
}

/** Ergebnis einer Aktion: null = geklappt, sonst Fehlermeldung (wird auch als Mitteilung gezeigt) */
type ActionResult = string | null

function failed(error: Parameters<typeof errorText>[0]): ActionResult {
  const text = errorText(error)
  notify({ kind: 'info', title: 'Hat nicht geklappt', subtitle: text, icon: 'info' })
  return text
}

// ---------- Freunde ----------

export async function searchUsers(query: string): Promise<FoundUser[] | string> {
  const token = tokenOf()
  if (!token) return 'Nicht angemeldet'
  const r = await cloud.searchUsers(token, query)
  return r.ok ? r.users : errorText(r.error)
}

export async function sendFriendRequest(username: string): Promise<Relation | null> {
  const token = tokenOf()
  if (!token) return null
  const r = await cloud.friendRequest(token, username)
  if (!r.ok) {
    failed(r.error)
    return null
  }
  notify(r.relation === 'friend'
    ? { kind: 'info', title: 'Ihr seid jetzt Freunde', subtitle: username, icon: 'check' }
    : { kind: 'info', title: 'Anfrage gesendet', subtitle: `${username} muss noch bestätigen`, icon: 'check' })
  void refreshSocial()
  return r.relation
}

/** Lokal sofort anpassen, damit die Liste ohne Warten reagiert */
function patch(fn: (d: SocialData) => SocialData) {
  store.set((s) => (s.data ? { ...s, data: fn(s.data) } : s))
}

export async function respondFriend(username: string, accept: boolean): Promise<ActionResult> {
  const token = tokenOf()
  if (!token) return null
  const r = await cloud.friendRespond(token, username, accept)
  if (!r.ok) return failed(r.error)
  patch((d) => {
    const req = d.incoming.find((x) => keyOf(x.username) === keyOf(username))
    return {
      ...d,
      incoming: d.incoming.filter((x) => x !== req),
      friends: accept && req
        ? [...d.friends, { username: req.username, avatar: req.avatar, since: new Date().toISOString(), games: 0, stadiums: 0 }]
          .sort((a, b) => keyOf(a.username).localeCompare(keyOf(b.username)))
        : d.friends,
    }
  })
  if (accept) notify({ kind: 'info', title: 'Ihr seid jetzt Freunde', subtitle: username, icon: 'check' })
  void refreshSocial()
  return null
}

/** Freund entfernen oder eigene Anfrage zurückziehen */
export async function removeFriend(username: string): Promise<ActionResult> {
  const token = tokenOf()
  if (!token) return null
  const r = await cloud.friendRemove(token, username)
  if (!r.ok) return failed(r.error)
  const k = keyOf(username)
  patch((d) => ({ ...d, friends: d.friends.filter((x) => keyOf(x.username) !== k), outgoing: d.outgoing.filter((x) => keyOf(x.username) !== k) }))
  friends.delete(k)
  void refreshSocial()
  return null
}

// ---------- Sammlung eines Freundes ----------

interface FriendEntry {
  status: 'loading' | 'ready' | 'error'
  profile: FriendProfile | null
  error?: string
}

const friends = new Map<string, FriendEntry>()
const friendsStore = createStore(0)

function setFriend(key: string, entry: FriendEntry) {
  friends.set(key, entry)
  friendsStore.set((n) => n + 1)
}

export async function loadFriend(username: string) {
  const token = tokenOf()
  if (!token) return
  const k = keyOf(username)
  const before = friends.get(k)
  if (!before?.profile) setFriend(k, { status: 'loading', profile: null })
  const r = await cloud.friend(token, username)
  if (r.ok) setFriend(k, { status: 'ready', profile: { username: r.username, avatar: r.avatar, visits: r.visits, groups: r.groups } })
  else setFriend(k, { status: before?.profile ? 'ready' : 'error', profile: before?.profile ?? null, error: errorText(r.error) })
}

export function useFriend(username: string | null | undefined): FriendEntry | null {
  friendsStore.use()
  return username ? friends.get(keyOf(username)) ?? null : null
}

const cardCache = new WeakMap<Visit[], MatchCard[]>()

/** Spielkarten eines Freundes (einmal berechnet pro Stand) */
export function friendCards(profile: FriendProfile | null | undefined): MatchCard[] {
  if (!profile) return []
  let cards = cardCache.get(profile.visits)
  if (!cards) {
    cards = buildCards(profile.visits)
    cardCache.set(profile.visits, cards)
  }
  return cards
}

// ---------- Gemeinsame Spiele ----------

export type Companion = GroupMember

/** Wer bei einem eigenen Besuch mit dabei war (bzw. angefragt ist) */
export function companionsOf(data: SocialData | null, visitId: string): Companion[] {
  if (!data) return []
  const out = new Map<string, Companion>()
  for (const g of data.groups) {
    if (g.visit !== visitId) continue
    for (const m of g.members) {
      const prev = out.get(keyOf(m.username))
      if (!prev || (prev.status === 'pending' && m.status === 'accepted')) out.set(keyOf(m.username), m)
    }
  }
  return [...out.values()]
}

export function useCompanions(visitId: string): Companion[] {
  const { data } = useSocial()
  return useMemo(() => companionsOf(data, visitId), [data, visitId])
}

/** Spieldaten, die markierte Freunde bekommen */
function shareable(v: Visit): SharedVisit {
  return {
    matchId: v.matchId,
    date: v.date,
    kickoff: v.kickoff ?? null,
    league: v.league,
    competition: v.competition,
    homeTeam: v.homeTeam,
    awayTeam: v.awayTeam,
    homeCrest: v.homeCrest ?? null,
    awayCrest: v.awayCrest ?? null,
    homeScore: v.homeScore,
    awayScore: v.awayScore,
    halfTime: v.halfTime ?? null,
    stadiumId: v.stadiumId,
    customStadium: v.customStadium,
    details: v.details ?? null,
  }
}

/** Freunde bei einem eigenen Besuch markieren – sie bekommen eine „Warst du dabei?“-Anfrage. */
export async function tagFriends(visit: Visit, usernames: string[]): Promise<ActionResult> {
  const token = tokenOf()
  if (!token || !usernames.length) return null
  // Wer selbst markiert wurde, lädt weitere Freunde in dieselbe Runde ein
  const group = store.get().data?.groups.find((g) => g.visit === visit.id)?.group ?? visit.id
  const r = await cloud.tagFriends(token, group, visit.id, shareable(visit), usernames)
  if (!r.ok) return failed(r.error)
  patch((d) => {
    const friendsByKey = new Map(d.friends.map((f) => [keyOf(f.username), f]))
    const added: GroupMember[] = usernames.map((u) => ({ username: friendsByKey.get(keyOf(u))?.username ?? u, avatar: friendsByKey.get(keyOf(u))?.avatar ?? null, status: 'pending' }))
    const existing = d.groups.find((g) => g.group === group)
    const groups = existing
      ? d.groups.map((g) => (g === existing ? { ...g, members: [...g.members, ...added.filter((a) => !g.members.some((m) => keyOf(m.username) === keyOf(a.username)))] } : g))
      : [...d.groups, { group, visit: visit.id, members: added }]
    return { ...d, groups }
  })
  notify({
    kind: 'info',
    title: usernames.length === 1 ? 'Anfrage gesendet' : `${usernames.length} Anfragen gesendet`,
    subtitle: 'Mit „Ja“ bekommen sie die Karte',
    icon: 'check',
  })
  void refreshSocial()
  return null
}

/** Derselbe Besuch schon in der eigenen Sammlung? (gleiches Spiel bzw. gleiche Paarung am selben Tag) */
function sameVisit(v: SharedVisit): Visit | undefined {
  const home = canonicalTeam(v.homeTeam, v.league)
  const away = canonicalTeam(v.awayTeam, v.league)
  return getUserData().visits.find((x) => (v.matchId && x.matchId === v.matchId)
    || (x.date === v.date && canonicalTeam(x.homeTeam, x.league) === home && canonicalTeam(x.awayTeam, x.league) === away))
}

/** „Ja, war dabei“: Karte kommt in die eigene Sammlung. „Nein“: Anfrage verschwindet. */
export async function respondTag(tag: TagRequest, accept: boolean): Promise<ActionResult> {
  const token = tokenOf()
  if (!token) return null
  const existing = accept ? sameVisit(tag.visit) : undefined
  const visitId = accept ? existing?.id ?? newId() : null
  const r = await cloud.tagRespond(token, tag.group, accept, visitId)
  if (!r.ok) return failed(r.error)
  patch((d) => ({ ...d, tags: d.tags.filter((t) => t.group !== tag.group) }))
  if (accept && visitId) {
    if (existing) {
      notify({ kind: 'info', title: 'Eingetragen', subtitle: `Die Karte hattest du schon – ${tag.from ?? 'dein Freund'} steht jetzt mit drauf`, icon: 'check' })
    } else {
      const v = tag.visit
      addVisit({
        matchId: v.matchId ?? null,
        date: v.date,
        kickoff: v.kickoff ?? null,
        league: v.league ?? null,
        competition: v.competition ?? null,
        homeTeam: v.homeTeam,
        awayTeam: v.awayTeam,
        homeCrest: v.homeCrest ?? null,
        awayCrest: v.awayCrest ?? null,
        homeScore: v.homeScore ?? null,
        awayScore: v.awayScore ?? null,
        halfTime: v.halfTime ?? null,
        stadiumId: v.stadiumId ?? null,
        customStadium: v.customStadium ?? null,
        details: v.details ?? null,
        rating: null,
        notes: '',
      }, visitId)
    }
  }
  void refreshSocial()
  return null
}

// ---------- Fotos ----------

export const MAX_PHOTOS = 6

interface PhotoList {
  status: 'loading' | 'ready' | 'error'
  photos: PhotoInfo[]
}

const photoLists = new Map<string, PhotoList>()
const photosStore = createStore(0)
const listKey = (owner: string | null, visitId: string) => `${owner ? keyOf(owner) : ''}|${visitId}`

function setPhotos(key: string, list: PhotoList) {
  photoLists.set(key, list)
  photosStore.set((n) => n + 1)
}

async function loadPhotos(owner: string | null, visitId: string) {
  const token = tokenOf()
  if (!token) return
  const key = listKey(owner, visitId)
  const before = photoLists.get(key)
  if (!before) setPhotos(key, { status: 'loading', photos: [] })
  const r = await cloud.photos(token, owner, visitId)
  setPhotos(key, r.ok ? { status: 'ready', photos: r.photos } : { status: before ? before.status : 'error', photos: before?.photos ?? [] })
}

/** Fotos einer Karte (`owner` null = eigene Karte); lädt beim ersten Anzeigen nach */
export function usePhotos(owner: string | null, visitId: string): PhotoList {
  photosStore.use()
  const signedIn = getAccount().mode === 'user'
  useEffect(() => {
    if (signedIn) void loadPhotos(owner, visitId)
  }, [owner, visitId, signedIn])
  return photoLists.get(listKey(owner, visitId)) ?? { status: signedIn ? 'loading' : 'ready', photos: [] }
}

export async function addPhoto(visitId: string, file: File): Promise<ActionResult> {
  const token = tokenOf()
  if (!token) return null
  let image: string
  let thumb: string
  try {
    ;({ image, thumb } = await photoFromFile(file))
  } catch {
    notify({ kind: 'info', title: 'Foto nicht lesbar', subtitle: 'Bitte ein anderes Bild wählen', icon: 'info' })
    return 'Foto nicht lesbar'
  }
  const r = await cloud.addPhoto(token, visitId, thumb, image)
  if (!r.ok) {
    if (r.error === 'limit') {
      notify({ kind: 'info', title: 'Schon 6 Fotos', subtitle: 'Mehr passen nicht zu einem Spiel', icon: 'info' })
      return 'limit'
    }
    return failed(r.error)
  }
  fullPhotos.set(r.id, jpegSrc(image))
  const acc = getAccount()
  const me = acc.mode === 'user' ? acc.username : ''
  const key = listKey(null, visitId)
  const list = photoLists.get(key)?.photos ?? []
  setPhotos(key, { status: 'ready', photos: [...list, { id: r.id, username: me, mine: true, thumb, at: new Date().toISOString() }] })
  return null
}

export async function deletePhoto(photo: PhotoInfo): Promise<ActionResult> {
  const token = tokenOf()
  if (!token) return null
  const r = await cloud.deletePhoto(token, photo.id)
  if (!r.ok) return failed(r.error)
  for (const [key, list] of photoLists) {
    if (list.photos.some((p) => p.id === photo.id)) setPhotos(key, { ...list, photos: list.photos.filter((p) => p.id !== photo.id) })
  }
  fullPhotos.delete(photo.id)
  return null
}

/** Fotos in voller Größe – die letzten bleiben im Speicher */
const fullPhotos = new Map<string, string>()

export async function fullPhoto(id: string): Promise<string | null> {
  const hit = fullPhotos.get(id)
  if (hit) return hit
  const token = tokenOf()
  if (!token) return null
  const r = await cloud.photo(token, id)
  if (!r.ok) return null
  const src = jpegSrc(r.image)
  fullPhotos.set(id, src)
  if (fullPhotos.size > 24) fullPhotos.delete(fullPhotos.keys().next().value!)
  return src
}

// ---------- Profilbilder ----------

/** Versionsnummer eines Profilbilds aus dem bekannten Stand (eigenes, Freunde, Mitreisende) */
export function avatarVersion(data: SocialData | null, username: string): number | null {
  if (!data) return null
  const k = username.toLowerCase()
  const same = (u: { username: string }) => u.username.toLowerCase() === k
  if (same(data.me)) return data.me.avatar
  return data.friends.find(same)?.avatar
    ?? data.groups.flatMap((g) => g.members).find(same)?.avatar
    ?? data.incoming.find(same)?.avatar
    ?? data.outgoing.find(same)?.avatar
    ?? null
}

interface AvatarEntry {
  v: number
  src: string
}

const avatars = new Map<string, AvatarEntry>(Object.entries(loadPref<Record<string, AvatarEntry>>('avatars', {})))
const avatarStore = createStore(0)
const wanted = new Map<string, number>()
let avatarTimer: ReturnType<typeof setTimeout> | undefined

function saveAvatars() {
  // Höchstens 80 Bilder auf dem Gerät behalten (je ≈ 20 KB)
  const entries = [...avatars].slice(-80)
  savePref('avatars', Object.fromEntries(entries))
}

/** Gesammelt nachladen: Viele Avatare auf einmal ergeben eine einzige Anfrage */
function queueAvatar(username: string, v: number) {
  if (wanted.get(username) === v) return
  wanted.set(username, v)
  clearTimeout(avatarTimer)
  avatarTimer = setTimeout(async () => {
    const token = tokenOf()
    const names = [...wanted.keys()]
    if (!token || !names.length) return
    const r = await cloud.avatars(token, names)
    if (!r.ok) {
      // Beim nächsten Anzeigen erneut versuchen
      wanted.clear()
      return
    }
    for (const a of r.avatars) {
      avatars.delete(keyOf(a.username))
      avatars.set(keyOf(a.username), { v: a.v, src: jpegSrc(a.image) })
    }
    saveAvatars()
    avatarStore.set((n) => n + 1)
  }, 60)
}

/** Profilbild als data-URL, sobald geladen. `v` = Version laut Server (null = kein Bild). */
export function useAvatar(username: string | null | undefined, v: number | null | undefined): string | null {
  avatarStore.use()
  const key = username ? keyOf(username) : ''
  const hit = key ? avatars.get(key) : undefined
  useEffect(() => {
    if (username && v != null && hit?.v !== v) queueAvatar(username, v)
  }, [username, key, v, hit?.v])
  if (!username || v == null) return null
  // Älteres Bild zeigen, bis das neue da ist
  return hit?.src ?? null
}

export async function setAvatar(file: File | null): Promise<ActionResult> {
  const a = getAccount()
  if (a.mode !== 'user') return null
  let image: string | null = null
  if (file) {
    try {
      image = await avatarFromFile(file)
    } catch {
      notify({ kind: 'info', title: 'Bild nicht lesbar', subtitle: 'Bitte ein anderes Bild wählen', icon: 'info' })
      return 'Bild nicht lesbar'
    }
  }
  const r = await cloud.setAvatar(a.token, image)
  if (!r.ok) return failed(r.error)
  const key = keyOf(a.username)
  avatars.delete(key)
  if (image && r.v != null) avatars.set(key, { v: r.v, src: jpegSrc(image) })
  saveAvatars()
  avatarStore.set((n) => n + 1)
  patch((d) => ({ ...d, me: { ...d.me, avatar: r.v } }))
  notify({ kind: 'info', title: image ? 'Profilbild gespeichert' : 'Profilbild entfernt', subtitle: image ? 'Deine Freunde sehen es jetzt' : undefined, icon: 'check' })
  return null
}
