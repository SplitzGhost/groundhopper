// Konto und Synchronisierung.
// Die Sammlung lebt weiterhin lokal (die App funktioniert offline). Mit Konto wird jede Änderung kurz danach
// hochgeladen, und beim Öffnen der App holt sie sich, was ein anderes Gerät inzwischen geändert hat.
// Haben zwei Geräte gleichzeitig etwas geändert, meldet der Server einen Konflikt – dann wird zusammengeführt.

import { cloud, cloudEnabled, errorText, mergeCloudData, parseCloudData, type CloudData, type CloudError } from '../lib/cloud.ts'
import { loadPref, savePref } from '../lib/storage.ts'
import { getUserData, replaceUserData, subscribeUserData } from './userData.ts'
import { getRevealed, replaceRevealed, subscribeRevealed } from './revealed.ts'
import { getHopper, replaceHopper, subscribeHopper } from './hopper.ts'
import { closeAllSheets, closeBinder, closeCard, closeList, createStore, tabStore } from './ui.ts'
import { notify } from './toast.ts'

export interface UserAccount {
  mode: 'user'
  username: string
  token: string
  /** Server-Stand, auf dem die lokale Sammlung aufbaut */
  rev: number
  /** Lokale Änderungen, die noch nicht hochgeladen sind */
  dirty: boolean
  /** Gelöschte Besuche (siehe CloudData.removed) */
  removed: string[]
}

export type Account =
  | { mode: 'none' } // noch nichts gewählt → Anmeldebildschirm
  | { mode: 'guest' }
  | UserAccount

const KEY = 'account'
const accountStore = createStore<Account>(cloudEnabled ? loadPref<Account>(KEY, { mode: 'none' }) : { mode: 'guest' })

export const useAccount = () => accountStore.use()
export const getAccount = () => accountStore.get()
export const subscribeAccount = accountStore.subscribe

function setAccount(a: Account) {
  accountStore.set(a)
  savePref(KEY, a)
}

function patchUser(patch: Partial<UserAccount>) {
  const a = accountStore.get()
  if (a.mode === 'user') setAccount({ ...a, ...patch })
}

/** Anmeldebildschirm als Gast nachträglich öffnen (aus dem Profil) */
export const authOpenStore = createStore(false)

// ---------- Status für die Oberfläche ----------

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error'
export const syncStatusStore = createStore<SyncStatus>('idle')
const setStatus = (s: SyncStatus) => syncStatusStore.set(s)

// ---------- Lokaler Stand ↔ Server-Paket ----------

function localData(): CloudData {
  const a = accountStore.get()
  const d = getUserData()
  return {
    version: 1,
    visits: d.visits,
    watchlist: d.watchlist,
    revealed: [...getRevealed()],
    removed: a.mode === 'user' ? a.removed : [],
    hopper: getHopper(),
  }
}

const visitIds = () => new Set(getUserData().visits.map((v) => v.id))

let applying = false
let lastIds = visitIds()
/** Zählt lokale Änderungen – so merkt ein laufender Upload, ob währenddessen noch etwas dazukam. */
let changeSeq = 0

/** Server-Stand übernehmen, ohne ihn als eigene Änderung zu werten. */
function applyLocal(data: CloudData) {
  applying = true
  try {
    replaceUserData({ version: 2, visits: data.visits, watchlist: data.watchlist }, { silent: true })
    replaceRevealed(data.revealed)
    replaceHopper(data.hopper)
  } finally {
    applying = false
  }
  lastIds = visitIds()
  patchUser({ removed: data.removed })
}

function onLocalChange() {
  const ids = visitIds()
  if (!applying) {
    changeSeq++
    const a = accountStore.get()
    if (a.mode === 'user') {
      let removed = a.removed
      const gone = [...lastIds].filter((id) => !ids.has(id))
      if (gone.length) removed = [...new Set([...removed, ...gone])]
      // Wieder aufgetauchte Besuche (z. B. Backup-Import) gelten nicht mehr als gelöscht
      if (removed.some((id) => ids.has(id))) removed = removed.filter((id) => !ids.has(id))
      setAccount({ ...a, removed, dirty: true })
      schedule()
    }
  }
  lastIds = ids
}

subscribeUserData(onLocalChange)
subscribeRevealed(onLocalChange)
subscribeHopper(onLocalChange)

// ---------- Abgleich ----------

let timer: ReturnType<typeof setTimeout> | undefined
let inflight: Promise<void> | null = null
let again = false

function schedule(delay = 1200) {
  clearTimeout(timer)
  timer = setTimeout(() => void sync(), delay)
}

/** Gleicht mit dem Server ab. Mehrfache Aufrufe während eines Abgleichs werden zu einem weiteren Durchlauf. */
export function sync(): Promise<void> {
  if (accountStore.get().mode !== 'user') return Promise.resolve()
  if (inflight) {
    again = true
    return inflight
  }
  clearTimeout(timer)
  inflight = run().finally(() => {
    inflight = null
    if (again) {
      again = false
      void sync()
    }
  })
  return inflight
}

async function run() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const a = accountStore.get()
    if (a.mode !== 'user') return
    setStatus('syncing')
    const seq = changeSeq
    const stillSame = () => {
      const now = accountStore.get()
      return now.mode === 'user' && now.token === a.token
    }

    if (!a.dirty) {
      // Nichts Eigenes zu senden – nur nachsehen, ob ein anderes Gerät etwas geändert hat
      const r = await cloud.pull(a.token)
      if (!stillSame()) return
      if (!r.ok) return fail(r.error)
      if (changeSeq !== seq) continue // währenddessen lokal geändert → jetzt hochladen
      if (r.rev !== a.rev) {
        applyLocal(parseCloudData(r.data))
        patchUser({ rev: r.rev })
      }
      return setStatus('idle')
    }

    const r = await cloud.push(a.token, localData(), a.rev)
    if (!stillSame()) return
    if (r.ok) {
      patchUser({ rev: r.rev, dirty: changeSeq !== seq })
      if (changeSeq !== seq) continue
      return setStatus('idle')
    }
    if (r.error === 'conflict') {
      // Anderes Gerät war schneller: beide Stände zusammenführen und erneut senden
      applyLocal(mergeCloudData(localData(), parseCloudData(r.data)))
      patchUser({ rev: r.rev ?? a.rev, dirty: true })
      continue
    }
    return fail(r.error)
  }
  setStatus('error')
}

function fail(error: CloudError) {
  if (error === 'invalid_session') {
    // Konto wurde auf einem anderen Gerät gelöscht
    clearLocal()
    setAccount({ mode: 'none' })
    notify({ kind: 'info', title: 'Abgemeldet', subtitle: 'Bitte melde dich erneut an', icon: 'info' })
    return
  }
  setStatus(error === 'offline' ? 'offline' : 'error')
}

// Beim Start, beim Zurückkehren in die App und wenn das Netz wiederkommt abgleichen
if (cloudEnabled) {
  setTimeout(() => void sync(), 800)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void sync()
  })
  addEventListener('online', () => void sync())
  setInterval(() => {
    if (document.visibilityState === 'visible') void sync()
  }, 120_000)
}

// ---------- Aktionen ----------

/** Anmelden oder Konto erstellen. Gibt bei Erfolg null zurück, sonst eine Fehlermeldung. */
export async function signIn(kind: 'login' | 'register', username: string, password: string): Promise<string | null> {
  const r = kind === 'login' ? await cloud.login(username.trim(), password) : await cloud.register(username.trim(), password)
  if (!r.ok) return errorText(r.error, r.retry_after)

  // Was schon auf dem Gerät liegt (z. B. als Gast gesammelt), wandert ins Konto
  const local = localData()
  const server = parseCloudData(r.data)
  const hasLocal = local.visits.length > 0 || local.watchlist.length > 0 || local.revealed.length > 0 || !!local.hopper
  const merged = hasLocal ? mergeCloudData(local, server) : server

  setAccount({ mode: 'user', username: r.username, token: r.token, rev: r.rev, dirty: false, removed: merged.removed })
  applyLocal(merged)
  authOpenStore.set(false)
  if (hasLocal) {
    patchUser({ dirty: true })
    void sync()
  } else {
    setStatus('idle')
  }

  const n = merged.visits.length
  notify({
    kind: 'info',
    title: kind === 'login' ? `Hallo ${r.username}` : 'Konto erstellt',
    subtitle: n ? `${n} ${n === 1 ? 'Spiel' : 'Spiele'} in deiner Sammlung` : 'Deine Sammlung ist jetzt gesichert',
    icon: 'check',
  })
  return null
}

export function continueAsGuest() {
  setAccount({ mode: 'guest' })
  authOpenStore.set(false)
}

/** Lokale Sammlung leeren (ohne sie als Löschung zum Server zu schicken) */
function clearLocal() {
  closeAllSheets()
  closeBinder()
  closeList()
  closeCard()
  tabStore.set('map')
  applyLocal({ version: 1, visits: [], watchlist: [], revealed: [], removed: [], hopper: null })
}

/**
 * Abmelden: erst offene Änderungen hochladen, dann die Sammlung vom Gerät entfernen.
 * `'unsynced'`: Hochladen ging nicht – mit `force` trotzdem abmelden.
 */
export async function signOut(force = false): Promise<'done' | 'unsynced'> {
  const a = accountStore.get()
  if (a.mode !== 'user') return 'done'
  if (a.dirty) await sync()
  const now = accountStore.get()
  if (now.mode === 'user' && now.dirty && !force) return 'unsynced'
  void cloud.logout(a.token)
  clearLocal()
  setAccount({ mode: 'none' })
  setStatus('idle')
  return 'done'
}

/** Sammlung leeren, Konto bleibt bestehen. Mit Konto auch auf allen anderen Geräten. */
export async function resetCollection() {
  const a = accountStore.get()
  // Erst den neuesten Stand holen, damit wirklich alles als gelöscht gilt
  if (a.mode === 'user') await sync()
  closeAllSheets()
  closeBinder()
  closeList()
  closeCard()
  replaceUserData({ version: 2, visits: [], watchlist: [] }, { silent: true })
  replaceRevealed([])
  if (accountStore.get().mode === 'user') await sync()
}

/** Konto endgültig löschen. Gibt bei Erfolg null zurück, sonst eine Fehlermeldung. */
export async function deleteAccount(password: string): Promise<string | null> {
  const a = accountStore.get()
  if (a.mode !== 'user') return null
  const r = await cloud.deleteAccount(a.token, password)
  if (!r.ok) return r.error === 'wrong_credentials' ? 'Das Passwort stimmt nicht.' : errorText(r.error)
  clearLocal()
  setAccount({ mode: 'none' })
  setStatus('idle')
  return null
}
