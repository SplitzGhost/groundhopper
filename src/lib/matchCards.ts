// Sammelkarten: Jedes besuchte Spiel wird zu einer Karte – mit beiden Wappen, Endstand und
// Extras für besondere Spiele (Derby, Torfestival, Comeback …). Dazu Sortierung und Seiten im Ordner.

import type { LeagueCode, MatchEvent, Stadium, Visit } from '../shared/types.ts'
import { LEAGUES, leagueByCode } from '../shared/leagues.ts'
import { clubInfo } from '../data/clubs.ts'
import { canonicalTeam } from './album.ts'
import { derbyOf, type Derby } from './derbies.ts'
import { stadiumById } from './stadiums.ts'
import { keyToDate } from './dates.ts'

export type ExtraId = 'derby' | 'newGround' | 'goalfest' | 'nil' | 'floodlight' | 'comeback' | 'late' | 'hattrick' | 'red'

export interface Extra {
  id: ExtraId
  label: string
}

export interface MatchCard {
  /** = Besuchs-ID */
  id: string
  visit: Visit
  /** Laufende Nummer nach Datum, ab 1 */
  number: number
  home: string
  away: string
  league: LeagueCode | null
  competition: string
  stadium: Stadium | undefined
  /** Stadionname (auch für eigene Stadien) */
  ground: string | null
  colors: { home: string; away: string }
  derby: Derby | undefined
  extras: Extra[]
}

// ---------- Extras ----------

const goalsOf = (events: MatchEvent[]) => events.filter((e) => e.kind !== 'red')

/** Spielstand nach jedem Tor */
function runningScores(events: MatchEvent[]): [number, number][] {
  let h = 0
  let a = 0
  return goalsOf(events).map((e) => {
    if (e.side === 'home') h++
    else a++
    return [h, a]
  })
}

function extrasOf(v: Visit, firstAtGround: boolean, derby: Derby | undefined): Extra[] {
  const out: Extra[] = []
  if (derby) out.push({ id: 'derby', label: derby.name })
  if (firstAtGround) out.push({ id: 'newGround', label: 'Neues Stadion' })
  const hs = v.homeScore
  const as = v.awayScore
  const scored = hs !== null && as !== null
  if (scored && hs + as >= 6) out.push({ id: 'goalfest', label: 'Torfestival' })
  if (scored && hs + as === 0) out.push({ id: 'nil', label: 'Nullnummer' })

  const events = v.details?.found ? v.details.events : []
  const winner = !scored || hs === as ? null : hs > as ? 'home' : 'away'
  if (winner) {
    const running = runningScores(events)
    const trailed = running.some(([h, a]) => (winner === 'home' ? h < a : a < h))
    const htTurned = v.halfTime && (winner === 'home' ? v.halfTime[0] < v.halfTime[1] : v.halfTime[1] < v.halfTime[0])
    if (trailed || htTurned) out.push({ id: 'comeback', label: 'Comeback' })
    const goals = goalsOf(events)
    const last = goals.at(-1)
    const before = running.at(-2) ?? [0, 0]
    if (last && last.side === winner && last.t >= 85 * 60 && before[0] === before[1]) {
      out.push({ id: 'late', label: 'Last-Minute-Sieg' })
    }
  }
  const tally = new Map<string, number>()
  for (const e of events) if (e.kind === 'goal' || e.kind === 'penalty') tally.set(e.player, (tally.get(e.player) ?? 0) + 1)
  const hattrick = [...tally].find(([, n]) => n >= 3)
  if (hattrick) out.push({ id: 'hattrick', label: `Hattrick ${hattrick[0].split(' ').at(-1)}` })
  if (events.some((e) => e.kind === 'red')) out.push({ id: 'red', label: 'Rote Karte' })
  if (v.kickoff) {
    const d = new Date(v.kickoff)
    if (d.getHours() + d.getMinutes() / 60 >= 20.5) out.push({ id: 'floodlight', label: 'Flutlicht' })
  }
  return out
}

// ---------- Karten bauen ----------

const chronological = (a: Visit, b: Visit) =>
  a.date.localeCompare(b.date) || (a.kickoff ?? '').localeCompare(b.kickoff ?? '') || a.createdAt.localeCompare(b.createdAt)

/** Alle Karten in zeitlicher Reihenfolge (Nr. 1 = erstes Spiel). */
export function buildCards(visits: Visit[]): MatchCard[] {
  const seenGrounds = new Set<string>()
  return [...visits].sort(chronological).map((v, i) => {
    const home = canonicalTeam(v.homeTeam, v.league)
    const away = canonicalTeam(v.awayTeam, v.league)
    const stadium = stadiumById(v.stadiumId)
    const groundKey = v.stadiumId ?? (v.customStadium ? `${v.customStadium.name}|${v.customStadium.city}` : null)
    const firstAtGround = !!groundKey && !seenGrounds.has(groundKey)
    if (groundKey) seenGrounds.add(groundKey)
    const derby = derbyOf(home, away)
    return {
      id: v.id,
      visit: v,
      number: i + 1,
      home,
      away,
      league: v.league,
      competition: v.league ? leagueByCode(v.league).name : v.competition ?? 'Freundschaftsspiel',
      stadium,
      ground: stadium?.name ?? v.customStadium?.name ?? null,
      colors: { home: clubInfo(home).primary, away: clubInfo(away).primary },
      derby,
      extras: extrasOf(v, firstAtGround, derby),
    }
  })
}

export const cardNo = (n: number) => '#' + String(n).padStart(3, '0')

/** Kurzname für enge Stellen: „Leverkusen“ statt „Bayer 04 Leverkusen“, „Köln“ statt „1. FC Köln“ */
export function shortClub(name: string): string {
  const short = name
    // Zahlen wie „04“, „1.“, „1901“ weglassen
    .replace(/(^|\s)\d+\.?(?=\s|$)/g, ' ')
    .trim()
    .replace(/\s+(FC|CF|AFC|SC|BC|CFC)$/, '')
    .replace(/^(FC|AC|AS|SS|SSC|US|RC|RCD|CA|OGC|AJ|ES|SV|TSG|VfB|VfL|FSV|SC|LOSC|Bayer|Borussia)\s+/, '')
    .replace(/\s+/g, ' ')
    .trim()
  return short || name
}

// ---------- Sortierung & Seiten ----------

export type BinderSort = 'newest' | 'oldest' | 'alpha' | 'league'

export const SORTS: { id: BinderSort; label: string }[] = [
  { id: 'newest', label: 'Neueste zuerst' },
  { id: 'oldest', label: 'Älteste zuerst' },
  { id: 'alpha', label: 'Alphabetisch' },
  { id: 'league', label: 'Nach Liga' },
]

export const PER_PAGE = 4

export interface BinderPage {
  cards: MatchCard[]
  /** Überschrift oben auf der Seite */
  title: string
  league: LeagueCode | null
}

const monthFmt = new Intl.DateTimeFormat('de-DE', { month: 'short', year: 'numeric' })
const monthOf = (c: MatchCard) => monthFmt.format(keyToDate(c.visit.date))

function rangeTitle(a: string, b: string) {
  return a === b ? a : `${a} – ${b}`
}

const leagueRank = (c: MatchCard) => {
  const i = c.league ? LEAGUES.findIndex((l) => l.code === c.league) : -1
  return i < 0 ? LEAGUES.length : i
}

export function sortCards(cards: MatchCard[], sort: BinderSort): MatchCard[] {
  const list = [...cards]
  switch (sort) {
    case 'newest': return list.reverse()
    case 'oldest': return list
    case 'alpha': return list.sort((a, b) => shortClub(a.home).localeCompare(shortClub(b.home), 'de') || b.number - a.number)
    case 'league': return list.sort((a, b) => leagueRank(a) - leagueRank(b) || a.competition.localeCompare(b.competition) || b.number - a.number)
  }
}

/** Seiten mit je vier Karten. Nach Liga sortiert beginnt jede Liga auf einer neuen Seite. */
export function pagesOf(cards: MatchCard[], sort: BinderSort): BinderPage[] {
  const sorted = sortCards(cards, sort)
  const groups: MatchCard[][] = []
  if (sort === 'league') {
    for (const c of sorted) {
      const g = groups.at(-1)
      if (g && g[0].competition === c.competition) g.push(c)
      else groups.push([c])
    }
  } else groups.push(sorted)

  return groups.flatMap((g) => {
    const out: BinderPage[] = []
    for (let i = 0; i < g.length; i += PER_PAGE) {
      const slice = g.slice(i, i + PER_PAGE)
      const first = slice[0]
      const last = slice.at(-1)!
      let title: string
      if (sort === 'league') title = first.competition
      else if (sort === 'alpha') title = rangeTitle(shortClub(first.home)[0].toUpperCase(), shortClub(last.home)[0].toUpperCase())
      else title = rangeTitle(monthOf(first), monthOf(last))
      out.push({ cards: slice, title, league: sort === 'league' ? first.league : null })
    }
    return out
  })
}

/** Karten, an denen ein Verein beteiligt war */
export const cardsOfClub = (cards: MatchCard[], club: string) => cards.filter((c) => c.home === club || c.away === club)
