// Ordnet Vereinsnamen aus beliebigen Datenquellen einem Stadion zu.
// Jede Quelle schreibt Vereine anders ("FC Arsenal", "Arsenal FC", "Arsenal"),
// daher werden Namen normalisiert und zusätzlich über Aliasnamen abgeglichen.

import type { LeagueCode, Stadium } from './types.ts'
import { leagueByCode } from './leagues.ts'

const STOP_WORDS = new Set([
  'fc', 'cf', 'afc', 'ac', 'acf', 'as', 'ss', 'ssc', 'us', 'sc', 'cd', 'ud', 'rc', 'rcd', 'ca',
  'club', 'calcio', 'cfc', 'bc', 'de', 'of', 'the', 'and', 'tsg', 'sv', 'vfb', 'vfl', 'fsv',
  'ogc', 'losc', 'sco', 'aj', 'es', 'balompie', 'futbol', 'real', 'racing',
])

export function normalizeTeamName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP_WORDS.has(w) && !/^\d+$/.test(w))
    .join(' ')
}

interface IndexEntry {
  key: string
  stadiumId: string
  team: string
  league: LeagueCode
}

export interface TeamMatch {
  stadiumId: string
  team: string
}

function find(pool: IndexEntry[], key: string, partial: boolean): IndexEntry | undefined {
  const hit = pool.find((e) => e.key === key)
  if (hit || !partial || key.length < 4) return hit
  // Teilübereinstimmung, z. B. "brighton hove albion" ↔ "brighton"; längster Treffer gewinnt.
  return pool
    .filter((e) => e.key.length >= 4 && (key.includes(e.key) || e.key.includes(key)))
    .sort((a, b) => b.key.length - a.key.length)[0]
}

/**
 * Sucht zuerst in der angegebenen Liga (auch Teilübereinstimmungen), dann exakt unter allen Vereinen
 * desselben Landes (Pokale, Auf-/Absteiger), zuletzt exakt weltweit. Teilübereinstimmungen nur
 * innerhalb einer Liga – sonst landet im Pokal „Chester“ bei „Manchester City“.
 */
export function createTeamMatcher(stadiums: Stadium[]) {
  const entries: IndexEntry[] = []
  const byLeague = new Map<LeagueCode, IndexEntry[]>()
  const byCountry = new Map<string, IndexEntry[]>()
  const add = <K>(map: Map<K, IndexEntry[]>, k: K, e: IndexEntry) => {
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(e)
  }
  for (const s of stadiums) {
    for (const t of s.teams) {
      for (const n of [t.name, ...t.aliases]) {
        const key = normalizeTeamName(n)
        // "Real Madrid" und "Real Sociedad" verlieren "real" – der Rest bleibt eindeutig.
        if (!key) continue
        const e = { key, stadiumId: s.id, team: t.name, league: t.league }
        entries.push(e)
        add(byLeague, t.league, e)
        add(byCountry, leagueByCode(t.league).countryCode, e)
      }
    }
  }
  const cache = new Map<string, TeamMatch | null>()

  /** `exact`: keine Teilübereinstimmungen (für Pokale, wo kleine Vereine leicht falsch landen) */
  return function match(name: string, league?: LeagueCode, exact = false): TeamMatch | null {
    const cacheKey = (league ?? '') + '|' + exact + '|' + name
    if (cache.has(cacheKey)) return cache.get(cacheKey)!

    const key = normalizeTeamName(name)
    let hit: IndexEntry | undefined
    if (league) {
      hit = find(byLeague.get(league) ?? [], key, !exact)
        ?? find(byCountry.get(leagueByCode(league).countryCode) ?? [], key, false)
    }
    hit ??= find(entries, key, !league && !exact)
    const result = hit ? { stadiumId: hit.stadiumId, team: hit.team } : null
    cache.set(cacheKey, result)
    return result
  }
}
