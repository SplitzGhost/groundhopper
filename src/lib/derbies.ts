// Berühmte Derbys und Klassiker der Top-5-Ligen. Vereinsnamen wie in stadiums.json.

import type { LeagueCode } from '../shared/types.ts'

export interface Derby {
  id: string
  name: string
  league: LeagueCode
  teams: [string, string]
}

export const DERBIES: Derby[] = [
  { id: 'klassiker', name: 'Der Klassiker', league: 'BL1', teams: ['FC Bayern München', 'Borussia Dortmund'] },
  { id: 'revierderby', name: 'Revierderby', league: 'BL1', teams: ['Borussia Dortmund', 'FC Schalke 04'] },
  { id: 'nordderby', name: 'Nordderby', league: 'BL1', teams: ['SV Werder Bremen', 'Hamburger SV'] },
  { id: 'rheinderby', name: 'Rheinisches Derby', league: 'BL1', teams: ['1. FC Köln', 'Borussia Mönchengladbach'] },
  { id: 'suedderby', name: 'Südderby', league: 'BL1', teams: ['FC Bayern München', 'VfB Stuttgart'] },
  { id: 'nlondon', name: 'North London Derby', league: 'PL', teams: ['Arsenal FC', 'Tottenham Hotspur FC'] },
  { id: 'manchester', name: 'Manchester Derby', league: 'PL', teams: ['Manchester City FC', 'Manchester United FC'] },
  { id: 'merseyside', name: 'Merseyside Derby', league: 'PL', teams: ['Liverpool FC', 'Everton FC'] },
  { id: 'northwest', name: 'North-West Derby', league: 'PL', teams: ['Liverpool FC', 'Manchester United FC'] },
  { id: 'tynewear', name: 'Tyne-Wear Derby', league: 'PL', teams: ['Newcastle United FC', 'Sunderland AFC'] },
  { id: 'clasico', name: 'El Clásico', league: 'PD', teams: ['Real Madrid CF', 'FC Barcelona'] },
  { id: 'madrileno', name: 'Derbi madrileño', league: 'PD', teams: ['Real Madrid CF', 'Club Atlético de Madrid'] },
  { id: 'barceloni', name: 'Derbi barceloní', league: 'PD', teams: ['FC Barcelona', 'RCD Espanyol de Barcelona'] },
  { id: 'vasco', name: 'Derbi vasco', league: 'PD', teams: ['Athletic Club', 'Real Sociedad de Fútbol'] },
  { id: 'sevillano', name: 'Derbi sevillano', league: 'PD', teams: ['Real Betis Balompié', 'Sevilla FC'] },
  { id: 'madonnina', name: 'Derby della Madonnina', league: 'SA', teams: ['FC Internazionale Milano', 'AC Milan'] },
  { id: 'italia', name: "Derby d'Italia", league: 'SA', teams: ['Juventus FC', 'FC Internazionale Milano'] },
  { id: 'capitale', name: 'Derby della Capitale', league: 'SA', teams: ['AS Roma', 'SS Lazio'] },
  { id: 'mole', name: 'Derby della Mole', league: 'SA', teams: ['Juventus FC', 'Torino FC'] },
  { id: 'sole', name: 'Derby del Sole', league: 'SA', teams: ['SSC Napoli', 'AS Roma'] },
  { id: 'classique', name: 'Le Classique', league: 'FL1', teams: ['Paris Saint-Germain FC', 'Olympique de Marseille'] },
  { id: 'olympico', name: "L'Olympico", league: 'FL1', teams: ['Olympique de Marseille', 'Olympique Lyonnais'] },
  { id: 'nord', name: 'Derby du Nord', league: 'FL1', teams: ['LOSC Lille', 'RC Lens'] },
  { id: 'paris', name: 'Derby de Paris', league: 'FL1', teams: ['Paris Saint-Germain FC', 'Paris FC'] },
]

/** Derby, das zu einer Paarung (Reihenfolge egal) gehört. */
export function derbyOf(teamA: string, teamB: string): Derby | undefined {
  return DERBIES.find(({ teams: [a, b] }) => (a === teamA && b === teamB) || (a === teamB && b === teamA))
}
