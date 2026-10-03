// Sammelkarten: Katalog aller Karten (Stadien, Vereine, Derbys, Erfolge), Nummerierung,
// Seltenheit, Seitenaufteilung im Album – und was davon schon gesammelt ist.

import type { LeagueCode, Stadium, Visit } from '../shared/types.ts'
import { LEAGUES } from '../shared/leagues.ts'
import { STADIUMS, stadiumById, stadiumsOfLeague } from './stadiums.ts'
import { DERBIES, type Derby } from './derbies.ts'
import { ACHIEVEMENTS, type Achievement, type Collection } from './album.ts'
import { rarityOf, stadiumSpec, type Rarity } from '../data/stadiumInfo.ts'
import { clubInfo } from '../data/clubs.ts'

export type AlbumId = 'stadiums' | 'clubs' | 'derbies' | 'achievements'

interface CardBase {
  /** Eindeutig über alle Alben, z. B. "stadium:allianz-arena-munchen" */
  id: string
  album: AlbumId
  /** Laufende Nummer im Album, ab 1 */
  number: number
  rarity: Rarity
  league: LeagueCode | null
  title: string
  subtitle: string
}

export interface StadiumCard extends CardBase { kind: 'stadium'; stadium: Stadium }
export interface ClubCard extends CardBase { kind: 'club'; club: string; stadium: Stadium }
export interface DerbyCard extends CardBase { kind: 'derby'; derby: Derby }
export interface AchievementCard extends CardBase { kind: 'achievement'; achievement: Achievement }
export type Card = StadiumCard | ClubCard | DerbyCard | AchievementCard

export interface AlbumDef {
  id: AlbumId
  title: string
  /** Einband-Farbe */
  color: string
  colorDeep: string
}

export const ALBUMS: AlbumDef[] = [
  { id: 'stadiums', title: 'Stadien', color: '#1f8bff', colorDeep: '#0049b8' },
  { id: 'clubs', title: 'Vereine', color: '#30b0c7', colorDeep: '#0f6a8a' },
  { id: 'derbies', title: 'Derbys', color: '#ff6a3d', colorDeep: '#c2330f' },
  { id: 'achievements', title: 'Erfolge', color: '#f5b400', colorDeep: '#b87400' },
]

export const albumById = (id: AlbumId) => ALBUMS.find((a) => a.id === id)!

const shortClub = (name: string) => name.replace(/\s+(FC|CF|AFC|SC|BC|CFC)$/, '').replace(/^(FC|AC|AS|SS|SSC|US|RC|RCD|CA|OGC|AJ|ES|SV|TSG|VfB|LOSC)\s+/, '')
export { shortClub }

// ---------- Katalog ----------

const LEGENDARY_DERBIES = new Set(['klassiker', 'revierderby', 'clasico', 'madonnina', 'northwest', 'classique', 'capitale'])
const ACH_RARITY: Record<string, Rarity> = {
  first: 'common', ten: 'rare', fifty: 'epic', grounds10: 'rare', regular: 'epic', goals: 'epic', nil: 'rare',
  double: 'rare', tour: 'epic', floodlight: 'common', derby: 'rare', europe: 'epic', complete: 'legendary',
}

function number<T extends Omit<Card, 'number'>>(list: T[]): (T & { number: number })[] {
  return list.map((c, i) => ({ ...c, number: i + 1 }))
}

const STADIUM_CARDS: StadiumCard[] = number(LEAGUES.flatMap((l) =>
  stadiumsOfLeague(l.code)
    // Geteilte Stadien (San Siro, Olimpico) nur einmal – bei der Liga ihres ersten Vereins
    .filter((s) => s.teams[0].league === l.code)
    .map((s): Omit<StadiumCard, 'number'> => ({
      kind: 'stadium', id: `stadium:${s.id}`, album: 'stadiums', rarity: rarityOf(stadiumSpec(s.id).capacity),
      league: l.code, title: s.name, subtitle: s.city, stadium: s,
    }))))

const CLUB_CARDS: ClubCard[] = number(LEAGUES.flatMap((l) =>
  STADIUMS.flatMap((s) => s.teams.filter((t) => t.league === l.code).map((t): Omit<ClubCard, 'number'> => ({
    kind: 'club', id: `club:${t.name}`, album: 'clubs', rarity: rarityOf(stadiumSpec(s.id).capacity),
    league: l.code, title: shortClub(t.name), subtitle: s.city, club: t.name, stadium: s,
  })))))

const DERBY_CARDS: DerbyCard[] = number(LEAGUES.flatMap((l) =>
  DERBIES.filter((d) => d.league === l.code).map((d): Omit<DerbyCard, 'number'> => ({
    kind: 'derby', id: `derby:${d.id}`, album: 'derbies', rarity: LEGENDARY_DERBIES.has(d.id) ? 'legendary' : 'epic',
    league: d.league, title: d.name, subtitle: d.teams.map(shortClub).join(' – '), derby: d,
  }))))

const ACH_CARDS: AchievementCard[] = number(ACHIEVEMENTS.map((a): Omit<AchievementCard, 'number'> => ({
  kind: 'achievement', id: `ach:${a.id}`, album: 'achievements', rarity: ACH_RARITY[a.id] ?? 'rare',
  league: null, title: a.title, subtitle: a.description, achievement: a,
})))

const CATALOGUE: Record<AlbumId, Card[]> = {
  stadiums: STADIUM_CARDS,
  clubs: CLUB_CARDS,
  derbies: DERBY_CARDS,
  achievements: ACH_CARDS,
}

export const cardsOf = (album: AlbumId): Card[] => CATALOGUE[album]
export const ALL_CARDS: Card[] = Object.values(CATALOGUE).flat()
const byId = new Map(ALL_CARDS.map((c) => [c.id, c]))
export const cardById = (id: string) => byId.get(id)

export const stadiumCardFor = (stadiumId: string) =>
  STADIUM_CARDS.find((c) => c.stadium.id === stadiumId)

// ---------- Darstellung ----------

export const cardNo = (n: number) => '#' + String(n).padStart(3, '0')

/** Farben, die eine Karte prägen (Rahmenakzent, Hintergrund) */
export function cardColors(card: Card): [string, string] {
  switch (card.kind) {
    case 'stadium': {
      const c = clubInfo(card.stadium.teams[0].name)
      return [c.primary, c.secondary]
    }
    case 'club': {
      const c = clubInfo(card.club)
      return [c.primary, c.secondary]
    }
    case 'derby':
      return [clubInfo(card.derby.teams[0]).primary, clubInfo(card.derby.teams[1]).primary]
    case 'achievement':
      return ['#f5b400', '#ff8a00']
  }
}

// ---------- Seiten im Album ----------

export const PER_PAGE = 9

export interface AlbumPage {
  /** Überschrift der Seite (Liga oder „Erfolge“) */
  title: string
  league: LeagueCode | null
  cards: Card[]
  /** Seite x von y innerhalb der Liga */
  part: number
  parts: number
}

export function pagesOf(album: AlbumId): AlbumPage[] {
  const cards = cardsOf(album)
  const groups = album === 'achievements'
    ? [{ title: 'Erfolge', league: null as LeagueCode | null, cards }]
    : LEAGUES.map((l) => ({ title: l.name, league: l.code as LeagueCode | null, cards: cards.filter((c) => c.league === l.code) }))
  return groups.filter((g) => g.cards.length).flatMap((g) => {
    const parts = Math.ceil(g.cards.length / PER_PAGE)
    return Array.from({ length: parts }, (_, i) => ({
      title: g.title, league: g.league, cards: g.cards.slice(i * PER_PAGE, (i + 1) * PER_PAGE), part: i + 1, parts,
    }))
  })
}

// ---------- Sammelstand ----------

export interface CardState {
  got: boolean
  /** Besuche/Spiele, die zur Karte zählen */
  visits: Visit[]
  /** Fortschritt bei Erfolgen */
  progress?: number
  target?: number
}

export function cardState(card: Card, c: Collection): CardState {
  switch (card.kind) {
    case 'stadium': {
      const v = c.stadiums.get(card.stadium.id) ?? []
      return { got: v.length > 0, visits: v }
    }
    case 'club': {
      const v = c.clubs.get(card.club) ?? []
      return { got: v.length > 0, visits: v }
    }
    case 'derby': {
      const v = c.derbies.get(card.derby.id) ?? []
      return { got: v.length > 0, visits: v }
    }
    case 'achievement': {
      const a = c.achievements.find((x) => x.def.id === card.achievement.id)
      return { got: !!a?.done, visits: [], progress: a?.progress ?? 0, target: card.achievement.target }
    }
  }
}

export function albumProgress(album: AlbumId, c: Collection) {
  const cards = cardsOf(album)
  const got = cards.filter((card) => cardState(card, c).got)
  return { got: got.length, total: cards.length, gotCards: got }
}

/** Zuletzt gesammelte Karten (nach erstem Besuch), neueste zuerst */
export function recentCards(c: Collection, limit = 10): Card[] {
  const firstVisit = (card: Card) => {
    const st = cardState(card, c)
    return st.visits.reduce((min, v) => (v.date < min ? v.date : min), '9999')
  }
  return ALL_CARDS
    .filter((card) => card.kind !== 'achievement' && cardState(card, c).got)
    .map((card) => [card, firstVisit(card)] as const)
    .sort((a, b) => b[1].localeCompare(a[1]))
    .slice(0, limit)
    .map(([card]) => card)
}

export const stadiumOfCard = (card: Card): Stadium | undefined =>
  card.kind === 'stadium' || card.kind === 'club' ? card.stadium : card.kind === 'derby' ? stadiumById(STADIUMS.find((s) => s.teams.some((t) => t.name === card.derby.teams[0]))?.id) : undefined
