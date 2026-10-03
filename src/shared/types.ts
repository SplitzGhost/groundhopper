// Datentypen, die Server und App gemeinsam nutzen.

export type LeagueCode = 'BL1' | 'PL' | 'PD' | 'SA' | 'FL1'

export interface League {
  code: LeagueCode
  name: string
  shortName: string
  country: string
  /** ISO-3166-Ländercode, kleingeschrieben */
  countryCode: string
  flag: string
}

// ---------- Stadien ----------

export interface StadiumTeam {
  name: string
  league: LeagueCode
  aliases: string[]
}

export interface Stadium {
  id: string
  name: string
  city: string
  country: string
  lat: number
  lon: number
  /** true = Koordinaten nur auf Stadtebene gefunden */
  approx: boolean
  teams: StadiumTeam[]
}

// ---------- Spiele ----------

export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled'

export interface TeamRef {
  id: string
  name: string
  shortName: string
  crest: string | null
}

export interface Score {
  home: number | null
  away: number | null
  halfTimeHome: number | null
  halfTimeAway: number | null
}

export interface Match {
  id: string
  league: LeagueCode
  season: number
  matchday: number | null
  /** Anstoß als ISO-Zeitstempel in UTC */
  kickoff: string
  status: MatchStatus
  home: TeamRef
  away: TeamRef
  score: Score
  /** Stadion des Heimteams laut Stadion-Datenbank, null wenn unbekannt */
  stadiumId: string | null
}

export type ProviderName = 'football-data' | 'demo'

export interface MatchesResponse {
  provider: ProviderName
  season: number
  updatedAt: string
  matches: Match[]
  warnings: string[]
}

// ---------- Nutzerdaten (lokal gespeichert) ----------

export interface CustomStadium {
  name: string
  city: string
  lat: number
  lon: number
}

export interface Visit {
  id: string
  /** Verweis auf ein Spiel aus der Datenquelle, null bei manueller Eingabe */
  matchId: string | null
  /** Spieltag als YYYY-MM-DD (Ortszeit) */
  date: string
  league: LeagueCode | null
  /** Freitext für Wettbewerbe außerhalb der Top 5 (Pokal, Testspiel …) */
  competition: string | null
  homeTeam: string
  awayTeam: string
  homeScore: number | null
  awayScore: number | null
  stadiumId: string | null
  customStadium: CustomStadium | null
  /** 1–5 Sterne */
  rating: number | null
  notes: string
  createdAt: string
  /** Anstoß als ISO-Zeitstempel, falls bekannt (für Abzeichen wie „Flutlicht“) */
  kickoff?: string | null
  homeCrest?: string | null
  awayCrest?: string | null
}

export interface UserData {
  version: 2
  visits: Visit[]
  /** Gemerkte Spiele (Match-IDs), die man besuchen möchte */
  watchlist: string[]
}
