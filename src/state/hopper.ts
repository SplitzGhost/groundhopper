// Der eigene Hopper: Aussehen und angezogenes Trikot. Lokal gespeichert und mit dem Konto synchronisiert.
// Welche Trikots man besitzt, ergibt sich aus der Sammlung: je besuchtem Spiel das Heimtrikot der Saison.

import { loadPref, savePref } from '../lib/storage.ts'
import { createStore } from './ui.ts'
import { parseHopper, type Hopper, type HopperLook, type KitId } from '../lib/hopper/look.ts'
import { kitId, seasonOf } from '../lib/hopper/kit.ts'
import { canonicalTeam } from '../lib/album.ts'
import type { Visit } from '../shared/types.ts'
import { useUserData } from './userData.ts'

const KEY = 'hopper'
const store = createStore<Hopper | null>(parseHopper(loadPref<unknown>(KEY, null)))

export const useHopper = () => store.use()
export const getHopper = () => store.get()
export const subscribeHopper = store.subscribe

function save(h: Hopper | null) {
  store.set(h)
  savePref(KEY, h)
}

/** Ganzen Stand ersetzen (Synchronisierung, Abmelden) */
export function replaceHopper(h: Hopper | null) {
  const cur = store.get()
  if (JSON.stringify(cur) === JSON.stringify(h)) return
  save(h)
}

export function setLook(look: HopperLook) {
  save({ look, kit: store.get()?.kit ?? null, updatedAt: new Date().toISOString() })
}

export function wearKit(kit: KitId) {
  const h = store.get()
  if (!h || h.kit === kit) return
  save({ ...h, kit, updatedAt: new Date().toISOString() })
}

// ---------- Kleiderschrank ----------

export interface WardrobeKit {
  id: string
  club: string
  season: number
  /** Erstes Spiel, bei dem es das Trikot gab */
  firstVisit: Visit
  /** Wie oft man bei diesem Verein in dieser Saison zu Gast war */
  count: number
}

/** Ein Heimtrikot je Verein und Saison, neueste zuerst */
export function wardrobeOf(visits: Visit[]): WardrobeKit[] {
  const map = new Map<string, WardrobeKit>()
  for (const v of [...visits].sort((a, b) => a.date.localeCompare(b.date))) {
    const club = canonicalTeam(v.homeTeam, v.league)
    const season = seasonOf(v.date)
    const id = kitId(club, season)
    const hit = map.get(id)
    if (hit) hit.count++
    else map.set(id, { id, club, season, firstVisit: v, count: 1 })
  }
  return [...map.values()].sort((a, b) => b.firstVisit.date.localeCompare(a.firstVisit.date))
}

const wardrobeCache = new WeakMap<Visit[], WardrobeKit[]>()

/** Eigener Kleiderschrank – einmal je Stand der Sammlung berechnet, auch wenn viele Karten fragen */
export function useWardrobe(): WardrobeKit[] {
  const { visits } = useUserData()
  let w = wardrobeCache.get(visits)
  if (!w) {
    w = wardrobeOf(visits)
    wardrobeCache.set(visits, w)
  }
  return w
}

/** Getragenes Trikot nur, wenn es (noch) im Schrank liegt – sonst Basis-Trikot */
export function wornKit(h: Hopper | null, wardrobe: WardrobeKit[]): KitId {
  return h?.kit && wardrobe.some((k) => k.id === h.kit) ? h.kit : null
}
