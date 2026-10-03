// Datentypen, die Server und App gemeinsam nutzen.

/** Top 5: 'BL1', 'PL', 'PD', 'SA', 'FL1'; ESPN-Wettbewerbe mit ihrem Kürzel (z. B. 'ger.2'),
 *  OpenLigaDB-Ligen mit deren Kürzel (z. B. 'bl3'). */
export type LeagueCode = string

export type LeagueSource = 'top5' | 'espn' | 'openligadb'

export interface League {
  code: LeagueCode
  name: string
  shortName: string
  /** Land bzw. Verband auf Deutsch */
  country: string
  /** Länder-/Verbandscode, siehe shared/countries.ts */
  countryCode: string
  /** 'league' = Ligabetrieb mit festen Vereinen, 'cup' = Pokal/Europapokal */
  kind: 'league' | 'cup'
  /** Spielklasse (1 = höchste), nur bei Ligen */
  tier?: number
  /** Saison = Kalenderjahr (z. B. MLS, Brasilien) statt Herbst bis Frühjahr */
  calendar?: boolean
  source: LeagueSource
  /** ESPN-Kürzel – für Spielplan und Spielbericht */
  espn?: string
  /** Kürzel bei OpenLigaDB */
  openLigaDb?: string
  /** ESPN-Logo-ID, null = kein Logo */
  logo: number | null
}

// ---------- Stadien ----------

export interface StadiumTeam {
  name: string
  league: LeagueCode
  aliases: string[]
  /** Vereins-ID bei ESPN (Wappen, Spielberichte, Zuordnung von Pokalspielen) */
  espnId?: string
  /** Vereinsfarben [Haupt, Zweit] – für Vereine ohne eigenen Eintrag in data/clubs.ts */
  colors?: [string, string]
  /** Kürzel, z. B. „AJA“ */
  short?: string
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
  /** Stadion-IDs bei ESPN – ordnet Spiele auf neutralem Platz (Endspiele) zu */
  espnVenues?: string[]
  /** Plätze laut OpenStreetMap bzw. Wikidata, falls bekannt */
  capacity?: number
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
  /** Halbzeitstand [Heim, Gast], falls bekannt */
  halfTime?: [number, number] | null
  /** Spielbericht (Tore, Zuschauer) – wird nach dem Abhaken nachgeladen */
  details?: MatchDetails | null
}

export type MatchEventKind = 'goal' | 'penalty' | 'own' | 'red'

export interface MatchEvent {
  /** Anzeige wie „45'+2'“ */
  minute: string
  /** Spielsekunde zum Sortieren */
  t: number
  /** Team, dem das Ereignis zählt (bei Eigentoren das begünstigte) */
  side: 'home' | 'away'
  kind: MatchEventKind
  player: string
}

export interface MatchDetails {
  /** false = Spiel in der Quelle nicht gefunden */
  found: boolean
  /** Endstand steht fest */
  final: boolean
  attendance: number | null
  referee: string | null
  venue: string | null
  events: MatchEvent[]
  fetchedAt: string
}

export interface UserData {
  version: 2
  visits: Visit[]
  /** Gemerkte Spiele (Match-IDs), die man besuchen möchte */
  watchlist: string[]
}
