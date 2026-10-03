// Ordnet Vereinsnamen aus beliebigen Datenquellen einem Stadion zu.
// Jede Quelle schreibt Vereine anders ("FC Arsenal", "Arsenal FC", "Arsenal"),
// daher werden Namen normalisiert und zusätzlich über Aliasnamen abgeglichen.

import type { LeagueCode, Stadium } from './types.ts'

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

export function createTeamMatcher(stadiums: Stadium[]) {
  const entries: IndexEntry[] = []
  for (const s of stadiums) {
    for (const t of s.teams) {
      for (const n of [t.name, ...t.aliases]) {
        const key = normalizeTeamName(n)
        // "Real Madrid" und "Real Sociedad" verlieren "real" – der Rest bleibt eindeutig.
        if (key) entries.push({ key, stadiumId: s.id, team: t.name, league: t.league })
      }
    }
  }
  const cache = new Map<string, TeamMatch | null>()

  return function match(name: string, league?: LeagueCode): TeamMatch | null {
    const cacheKey = (league ?? '') + '|' + name
    if (cache.has(cacheKey)) return cache.get(cacheKey)!

    const key = normalizeTeamName(name)
    const pool = league ? entries.filter((e) => e.league === league) : entries
    let hit = pool.find((e) => e.key === key)
    if (!hit && key.length >= 4) {
      // Teilübereinstimmung, z. B. "brighton hove albion" ↔ "brighton"; längster Treffer gewinnt.
      hit = pool
        .filter((e) => e.key.length >= 4 && (key.includes(e.key) || e.key.includes(key)))
        .sort((a, b) => b.key.length - a.key.length)[0]
    }
    const result = hit ? { stadiumId: hit.stadiumId, team: hit.team } : null
    cache.set(cacheKey, result)
    return result
  }
}
