import type { League, LeagueCode } from './types.ts'

export const LEAGUES: League[] = [
  { code: 'BL1', name: 'Bundesliga', shortName: 'BL', country: 'Deutschland', countryCode: 'de', flag: '🇩🇪' },
  { code: 'PL', name: 'Premier League', shortName: 'PL', country: 'England', countryCode: 'gb', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { code: 'PD', name: 'La Liga', shortName: 'LL', country: 'Spanien', countryCode: 'es', flag: '🇪🇸' },
  { code: 'SA', name: 'Serie A', shortName: 'SA', country: 'Italien', countryCode: 'it', flag: '🇮🇹' },
  { code: 'FL1', name: 'Ligue 1', shortName: 'L1', country: 'Frankreich', countryCode: 'fr', flag: '🇫🇷' },
]

export const LEAGUE_CODES = LEAGUES.map((l) => l.code)

export const leagueByCode = (code: LeagueCode): League =>
  LEAGUES.find((l) => l.code === code)!

/** Saison-Startjahr: ab Juli zählt die neue Saison (2026 = Saison 2026/27). */
export function currentSeason(now = new Date()): number {
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1
}
