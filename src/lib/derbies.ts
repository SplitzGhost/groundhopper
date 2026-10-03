// Berühmte Derbys und Klassiker – Top 5 und weitere Ligen weltweit. Vereinsnamen wie in stadiums.json.

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

  // ---------- Weitere Ligen (Vereinsnamen wie von ESPN) ----------
  { id: 'hamburg', name: 'Hamburger Stadtderby', league: 'BL1', teams: ['Hamburger SV', 'St. Pauli'] },
  { id: 'steelcity', name: 'Steel City Derby', league: 'eng.2', teams: ['Sheffield United', 'Sheffield Wednesday'] },
  { id: 'blackcountry', name: 'Black Country Derby', league: 'eng.2', teams: ['Wolverhampton Wanderers', 'West Bromwich Albion'] },
  { id: 'southwales', name: 'South Wales Derby', league: 'eng.2', teams: ['Cardiff City', 'Swansea City'] },
  { id: 'southcoast', name: 'South Coast Derby', league: 'eng.2', teams: ['Southampton', 'Portsmouth'] },
  { id: 'oldfirm', name: 'Old Firm', league: 'sco.1', teams: ['Celtic', 'Rangers'] },
  { id: 'edinburgh', name: 'Edinburgh Derby', league: 'sco.1', teams: ['Heart of Midlothian', 'Hibernian'] },
  { id: 'klassieker', name: 'De Klassieker', league: 'ned.1', teams: ['Ajax Amsterdam', 'Feyenoord Rotterdam'] },
  { id: 'topper', name: 'De Topper', league: 'ned.1', teams: ['Ajax Amsterdam', 'PSV Eindhoven'] },
  { id: 'classico-pt', name: 'O Clássico', league: 'por.1', teams: ['Benfica', 'FC Porto'] },
  { id: 'lisboa', name: 'Derby de Lisboa', league: 'por.1', teams: ['Benfica', 'Sporting CP'] },
  { id: 'topper-be', name: 'Topper', league: 'bel.1', teams: ['Club Brugge', 'Anderlecht'] },
  { id: 'wien', name: 'Wiener Derby', league: 'aut.1', teams: ['Rapid Vienna', 'Austria Vienna'] },
  { id: 'intercontinental', name: 'Kıtalararası Derbi', league: 'tur.1', teams: ['Galatasaray', 'Fenerbahce'] },
  { id: 'eternal', name: 'Derby der ewigen Feinde', league: 'gre.1', teams: ['Olympiacos', 'Panathinaikos'] },
  { id: 'newfirm', name: 'New Firm', league: 'den.1', teams: ['F.C. København', 'Brøndby IF'] },
  { id: 'stockholm', name: 'Tvillingderbyt', league: 'swe.1', teams: ['AIK', 'Djurgården'] },
  { id: 'moskau', name: 'Moskauer Derby', league: 'rus.1', teams: ['Spartak Moscow', 'CSKA Moscow'] },
  { id: 'eltrafico', name: 'El Tráfico', league: 'usa.1', teams: ['LA Galaxy', 'LAFC'] },
  { id: 'cascadia', name: 'Cascadia Cup', league: 'usa.1', teams: ['Seattle Sounders FC', 'Portland Timbers'] },
  { id: 'clasico-mx', name: 'Clásico Nacional', league: 'mex.1', teams: ['América', 'Guadalajara'] },
  { id: 'regio', name: 'Clásico Regiomontano', league: 'mex.1', teams: ['Tigres UANL', 'Monterrey'] },
  { id: 'superclasico', name: 'Superclásico', league: 'arg.1', teams: ['Boca Juniors', 'River Plate'] },
  { id: 'avellaneda', name: 'Clásico de Avellaneda', league: 'arg.1', teams: ['Racing Club', 'Independiente'] },
  { id: 'flaflu', name: 'Fla-Flu', league: 'bra.1', teams: ['Flamengo', 'Fluminense'] },
  { id: 'paulista', name: 'Derby Paulista', league: 'bra.1', teams: ['Corinthians', 'Palmeiras'] },
  { id: 'grenal', name: 'Gre-Nal', league: 'bra.1', teams: ['Grêmio', 'Internacional'] },
  { id: 'uruguayo', name: 'Clásico del fútbol uruguayo', league: 'uru.1', teams: ['Peñarol', 'Nacional'] },
  { id: 'chile', name: 'Superclásico', league: 'chi.1', teams: ['Colo Colo', 'Universidad de Chile'] },
  { id: 'peru', name: 'Clásico del fútbol peruano', league: 'per.1', teams: ['Alianza Lima', 'Universitario'] },
  { id: 'paraguay', name: 'Superclásico', league: 'par.1', teams: ['Club Olimpia', 'Cerro Porteño'] },
  { id: 'astillero', name: 'Clásico del Astillero', league: 'ecu.1', teams: ['Barcelona SC', 'Emelec'] },
  { id: 'riyadh', name: 'Riad-Derby', league: 'ksa.1', teams: ['Al Hilal', 'Al Nassr'] },
  { id: 'soweto', name: 'Soweto Derby', league: 'rsa.1', teams: ['Kaizer Chiefs', 'Orlando Pirates'] },
]

/** Derby, das zu einer Paarung (Reihenfolge egal) gehört. */
export function derbyOf(teamA: string, teamB: string): Derby | undefined {
  return DERBIES.find(({ teams: [a, b] }) => (a === teamA && b === teamB) || (a === teamB && b === teamA))
}
