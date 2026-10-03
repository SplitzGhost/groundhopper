// Sammelalbum: was aus den Besuchen alles „abgehakt“ ist – Stadien, Vereine, Länder,
// Ligen, Derbys und Erfolge – plus Punkte und Level.

import type { LeagueCode, Visit } from '../shared/types.ts'
import { DOMESTIC_LEAGUES, leagueByCode } from '../shared/leagues.ts'
import { COUNTRY_NAMES } from '../shared/countries.ts'
import { STADIUMS, findTeam, stadiumById, stadiumsOfLeague } from './stadiums.ts'
import { DERBIES, derbyOf } from './derbies.ts'
import { addDays } from './dates.ts'
import type { ToastIcon } from '../state/toast.ts'

// ---------- Länder ----------

export const COUNTRIES: Record<string, { name: string }> = Object.fromEntries(
  Object.entries(COUNTRY_NAMES).map(([code, name]) => [code, { name }]),
)

// ---------- Grundauswertung ----------

/** Vereinsname so, wie er in der Stadion-Datenbank steht (oder unverändert). */
export const canonicalTeam = (name: string, league?: LeagueCode | null) =>
  findTeam(name, league ?? undefined)?.team ?? findTeam(name)?.team ?? name

export interface Collection {
  visits: Visit[]
  stadiums: Map<string, Visit[]>
  clubs: Map<string, Visit[]>
  derbies: Map<string, Visit[]>
  countries: Map<string, number>
  completeLeagues: Set<LeagueCode>
  achievements: AchievementState[]
  points: number
}

export function collect(visits: Visit[]): Collection {
  const stadiums = new Map<string, Visit[]>()
  const clubs = new Map<string, Visit[]>()
  const derbies = new Map<string, Visit[]>()
  const push = <K>(map: Map<K, Visit[]>, key: K, v: Visit) => {
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(v)
  }

  for (const v of visits) {
    if (v.stadiumId && stadiumById(v.stadiumId)) push(stadiums, v.stadiumId, v)
    const home = canonicalTeam(v.homeTeam, v.league)
    const away = canonicalTeam(v.awayTeam, v.league)
    push(clubs, home, v)
    push(clubs, away, v)
    const derby = derbyOf(home, away)
    if (derby) push(derbies, derby.id, v)
  }

  const countries = new Map<string, number>()
  for (const id of stadiums.keys()) {
    const c = stadiumById(id)!.country
    countries.set(c, (countries.get(c) ?? 0) + 1)
  }

  const completeLeagues = new Set<LeagueCode>()
  for (const l of DOMESTIC_LEAGUES) {
    const all = stadiumsOfLeague(l.code)
    if (all.length && all.every((s) => stadiums.has(s.id))) completeLeagues.add(l.code)
  }

  const partial = { visits, stadiums, clubs, derbies, countries, completeLeagues }
  const achievements = ACHIEVEMENTS.map((a) => {
    const progress = Math.min(a.target, a.progress(partial))
    return { def: a, progress, done: progress >= a.target }
  })

  const knownClubs = [...clubs.keys()].filter((c) => TEAM_NAMES.has(c)).length
  const points = visits.length * 2 + stadiums.size * 10 + knownClubs * 3 + derbies.size * 15
    + countries.size * 20 + completeLeagues.size * 60 + achievements.filter((a) => a.done).length * 10

  return { ...partial, achievements, points }
}

export const TEAM_NAMES = new Set(STADIUMS.flatMap((s) => s.teams.map((t) => t.name)))

export const ALL_TEAMS = STADIUMS.flatMap((s) => s.teams.map((t) => ({ ...t, stadiumId: s.id })))

// ---------- Level ----------

const LEVELS = [
  { min: 0, name: 'Neuling' },
  { min: 80, name: 'Stadiongänger' },
  { min: 250, name: 'Auswärtsfahrer' },
  { min: 550, name: 'Groundhopper' },
  { min: 1000, name: 'Allesfahrer' },
  { min: 1700, name: 'Stadionsammler' },
  { min: 2800, name: 'Legende' },
]

export function levelOf(points: number) {
  let i = LEVELS.findLastIndex((l) => points >= l.min)
  if (i < 0) i = 0
  const next = LEVELS[i + 1]
  const current = LEVELS[i]
  return {
    level: i + 1,
    name: current.name,
    next: next?.name ?? null,
    /** Fortschritt zum nächsten Level, 0–1 */
    progress: next ? (points - current.min) / (next.min - current.min) : 1,
    toNext: next ? next.min - points : 0,
  }
}

// ---------- Erfolge ----------

type Partial_ = Omit<Collection, 'achievements' | 'points'> & { visits: Visit[] }

export interface Achievement {
  id: string
  title: string
  description: string
  target: number
  progress: (c: Partial_) => number
}

export interface AchievementState {
  def: Achievement
  progress: number
  done: boolean
}

const totalGoals = (v: Visit) =>
  v.homeScore !== null && v.awayScore !== null ? v.homeScore + v.awayScore : -1

function maxGamesInWindow(visits: Visit[], days: number): number {
  const dates = visits.map((v) => v.date).sort()
  let best = 0
  for (let i = 0; i < dates.length; i++) {
    const end = addDays(dates[i], days - 1)
    let n = 0
    for (let j = i; j < dates.length && dates[j] <= end; j++) n++
    best = Math.max(best, n)
  }
  return best
}

const localHour = (iso: string) => {
  const d = new Date(iso)
  return d.getHours() + d.getMinutes() / 60
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first', title: 'Anpfiff', description: 'Dein erstes Spiel im Stadion', target: 1, progress: (c) => c.visits.length },
  { id: 'ten', title: 'Zehnerkarte', description: '10 Spiele besucht', target: 10, progress: (c) => c.visits.length },
  { id: 'fifty', title: 'Halbes Hundert', description: '50 Spiele besucht', target: 50, progress: (c) => c.visits.length },
  { id: 'grounds10', title: 'Groundhopper', description: '10 verschiedene Stadien', target: 10, progress: (c) => c.stadiums.size },
  {
    id: 'regular', title: 'Stammgast', description: '5-mal im selben Stadion', target: 5,
    progress: (c) => Math.max(0, ...[...c.stadiums.values()].map((v) => v.length)),
  },
  { id: 'goals', title: 'Torfestival', description: 'Ein Spiel mit 6 oder mehr Toren', target: 1, progress: (c) => (c.visits.some((v) => totalGoals(v) >= 6) ? 1 : 0) },
  { id: 'nil', title: 'Nullnummer', description: 'Ein 0:0 live erlebt', target: 1, progress: (c) => (c.visits.some((v) => totalGoals(v) === 0) ? 1 : 0) },
  { id: 'double', title: 'Doppelschicht', description: 'Zwei Spiele an einem Tag', target: 2, progress: (c) => maxGamesInWindow(c.visits, 1) },
  { id: 'tour', title: 'Wochenend-Tour', description: '3 Spiele innerhalb von 3 Tagen', target: 3, progress: (c) => maxGamesInWindow(c.visits, 3) },
  {
    id: 'floodlight', title: 'Flutlicht', description: 'Anstoß um 20:30 Uhr oder später', target: 1,
    progress: (c) => (c.visits.some((v) => v.kickoff && localHour(v.kickoff) >= 20.5) ? 1 : 0),
  },
  { id: 'derby', title: 'Derbyfieber', description: 'Dein erstes Derby', target: 1, progress: (c) => c.derbies.size },
  { id: 'europe', title: 'Europareise', description: 'Stadien in 3 Ländern', target: 3, progress: (c) => c.countries.size },
  { id: 'world', title: 'Weltenbummler', description: 'Stadien in 10 Ländern', target: 10, progress: (c) => c.countries.size },
  { id: 'grounds50', title: 'Stadionsammler', description: '50 verschiedene Stadien', target: 50, progress: (c) => c.stadiums.size },
  {
    id: 'cup', title: 'Pokalabend', description: 'Ein Pokal- oder Europapokalspiel', target: 1,
    progress: (c) => (c.visits.some((v) => v.league && leagueByCode(v.league).kind === 'cup') ? 1 : 0),
  },
  {
    id: 'europecup', title: 'Europapokal', description: 'Champions, Europa oder Conference League', target: 1,
    progress: (c) => (c.visits.some((v) => v.league && leagueByCode(v.league).countryCode === 'uefa') ? 1 : 0),
  },
  { id: 'complete', title: 'Komplettist', description: 'Alle Stadien einer Liga', target: 1, progress: (c) => c.completeLeagues.size },
]

// ---------- Neu Freigeschaltetes erkennen ----------

export interface Unlock {
  title: string
  subtitle: string
  icon: ToastIcon
}

export function diffUnlocks(before: Visit[], after: Visit[]): Unlock[] {
  if (after.length <= before.length) return []
  const a = collect(before)
  const b = collect(after)
  const out: Unlock[] = []
  for (const s of b.achievements) {
    if (s.done && !a.achievements.find((x) => x.def.id === s.def.id)?.done) {
      out.push({ title: s.def.title, subtitle: 'Erfolg freigeschaltet', icon: 'trophy' })
    }
  }
  for (const l of b.completeLeagues) {
    if (!a.completeLeagues.has(l)) out.push({ title: leagueByCode(l).name, subtitle: 'Liga komplett!', icon: 'trophy' })
  }
  for (const id of b.derbies.keys()) {
    if (!a.derbies.has(id)) out.push({ title: DERBIES.find((d) => d.id === id)!.name, subtitle: 'Neues Derby erlebt', icon: 'derby' })
  }
  for (const c of b.countries.keys()) {
    if (!a.countries.has(c)) out.push({ title: COUNTRIES[c]?.name ?? c, subtitle: 'Neues Land', icon: 'country' })
  }
  for (const id of b.stadiums.keys()) {
    if (!a.stadiums.has(id)) out.push({ title: stadiumById(id)!.name, subtitle: 'Neues Stadion abgehakt', icon: 'stadium' })
  }
  for (const club of b.clubs.keys()) {
    if (!a.clubs.has(club) && TEAM_NAMES.has(club)) out.push({ title: club, subtitle: 'Neuer Verein live gesehen', icon: 'club' })
  }
  if (!out.length) out.push({ title: 'Spiel eingetragen', subtitle: `Neue Spielkarte · Nr. ${after.length}`, icon: 'check' })
  return out
}
