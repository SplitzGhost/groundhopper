// Vereinsdaten für die Sammelkarten: Farben, Gründungsjahr, Spitzname, Kürzel.
// Schlüssel = Vereinsname wie in stadiums.json. Farben sind auf die Darstellung abgestimmt,
// keine offiziellen Farbwerte. Vereine ohne eigenen Eintrag (alle Ligen außer den Top 5)
// bekommen Farben und Kürzel aus stadiums.json (Quelle: ESPN).

import data from './stadiums.json'
import type { Stadium } from '../shared/types.ts'

export interface ClubInfo {
  /** Erkennungsfarbe (Sitze im Stadion, Kartenakzent) */
  primary: string
  secondary: string
  founded: number
  nickname: string
  short: string
}

const W = '#ffffff'
const B = '#111111'

type Row = [primary: string, secondary: string, founded: number, nickname: string, short: string]

const ROWS: Record<string, Row> = {
  // ---------- Bundesliga ----------
  'FC Bayern München': ['#dc052d', W, 1900, 'Die Roten', 'FCB'],
  'Borussia Dortmund': ['#fde100', B, 1909, 'Die Schwarzgelben', 'BVB'],
  'Bayer 04 Leverkusen': ['#e32221', B, 1904, 'Werkself', 'B04'],
  'RB Leipzig': ['#dd0741', '#0c2043', 2009, 'Die Roten Bullen', 'RBL'],
  'VfB Stuttgart': ['#e32219', W, 1893, 'Die Schwaben', 'VFB'],
  'Eintracht Frankfurt': ['#e1000f', B, 1899, 'Die Adler', 'SGE'],
  'SC Freiburg': ['#e2001a', B, 1904, 'Breisgau-Brasilianer', 'SCF'],
  'Borussia Mönchengladbach': ['#1a9f4a', B, 1900, 'Die Fohlen', 'BMG'],
  '1. FSV Mainz 05': ['#ed1c24', W, 1905, 'Die Nullfünfer', 'M05'],
  'FC Augsburg': ['#ba3733', '#46714d', 1907, 'Fuggerstädter', 'FCA'],
  'SV Werder Bremen': ['#1d9053', W, 1899, 'Die Grün-Weißen', 'SVW'],
  '1. FC Union Berlin': ['#eb1923', W, 1966, 'Die Eisernen', 'FCU'],
  'TSG Hoffenheim': ['#1c63b7', W, 1899, 'Die Kraichgauer', 'TSG'],
  '1. FC Köln': ['#ed1c24', W, 1948, 'Die Geißböcke', 'KOE'],
  'Hamburger SV': ['#0a3f86', '#e2001a', 1887, 'Die Rothosen', 'HSV'],
  'FC Schalke 04': ['#004d9d', W, 1904, 'Die Knappen', 'S04'],
  'SC Paderborn 07': ['#005ca9', B, 1907, 'Die Ostwestfalen', 'SCP'],
  'SV 07 Elversberg': ['#1d1d1b', W, 1907, 'Die SVE', 'SVE'],

  // ---------- Premier League ----------
  'Arsenal FC': ['#ef0107', W, 1886, 'The Gunners', 'ARS'],
  'Aston Villa FC': ['#7a1a3e', '#95bfe5', 1874, 'The Villans', 'AVL'],
  'AFC Bournemouth': ['#da291c', B, 1899, 'The Cherries', 'BOU'],
  'Brentford FC': ['#e30613', W, 1889, 'The Bees', 'BRE'],
  'Brighton & Hove Albion FC': ['#0057b8', W, 1901, 'The Seagulls', 'BHA'],
  'Chelsea FC': ['#034694', W, 1905, 'The Blues', 'CHE'],
  'Coventry City FC': ['#74b9e6', W, 1883, 'The Sky Blues', 'COV'],
  'Crystal Palace FC': ['#1b458f', '#c4122e', 1905, 'The Eagles', 'CRY'],
  'Everton FC': ['#003399', W, 1878, 'The Toffees', 'EVE'],
  'Fulham FC': [B, W, 1879, 'The Cottagers', 'FUL'],
  'Hull City AFC': ['#f5a12d', B, 1904, 'The Tigers', 'HUL'],
  'Ipswich Town FC': ['#3a64a3', W, 1878, 'The Tractor Boys', 'IPS'],
  'Leeds United FC': ['#1d428a', '#ffcd00', 1919, 'The Whites', 'LEE'],
  'Liverpool FC': ['#c8102e', W, 1892, 'The Reds', 'LIV'],
  'Manchester City FC': ['#6cabdd', '#1c2c5b', 1880, 'The Citizens', 'MCI'],
  'Manchester United FC': ['#da291c', B, 1878, 'The Red Devils', 'MUN'],
  'Newcastle United FC': ['#241f20', W, 1892, 'The Magpies', 'NEW'],
  'Nottingham Forest FC': ['#dd0000', W, 1865, 'Forest', 'NFO'],
  'Sunderland AFC': ['#eb172b', W, 1879, 'The Black Cats', 'SUN'],
  'Tottenham Hotspur FC': ['#132257', W, 1882, 'Spurs', 'TOT'],

  // ---------- La Liga ----------
  'Real Madrid CF': ['#1f3f8f', '#febe10', 1902, 'Los Blancos', 'RMA'],
  'FC Barcelona': ['#a50044', '#004d98', 1899, 'Barça', 'BAR'],
  'Club Atlético de Madrid': ['#cb3524', '#272e61', 1903, 'Los Colchoneros', 'ATM'],
  'Athletic Club': ['#ee2523', W, 1898, 'Los Leones', 'ATH'],
  'Real Sociedad de Fútbol': ['#0067b1', W, 1909, 'Txuri-Urdin', 'RSO'],
  'Real Betis Balompié': ['#0bb363', W, 1907, 'Los Verdiblancos', 'BET'],
  'Sevilla FC': ['#d81e05', W, 1890, 'Los Sevillistas', 'SEV'],
  'Valencia CF': ['#f18e00', B, 1919, 'Los Che', 'VAL'],
  'Villarreal CF': ['#ffd300', '#005187', 1923, 'El Submarino Amarillo', 'VIL'],
  'CA Osasuna': ['#d91a21', '#0a346f', 1920, 'Los Rojillos', 'OSA'],
  'RC Celta de Vigo': ['#8ac3ee', '#e5254e', 1923, 'Os Celestes', 'CEL'],
  'RC Deportivo La Coruña': ['#0050a0', W, 1906, 'Dépor', 'DEP'],
  'Deportivo Alavés': ['#0761af', W, 1921, 'El Glorioso', 'ALA'],
  'Elche CF': ['#05642c', W, 1923, 'Los Franjiverdes', 'ELC'],
  'RCD Espanyol de Barcelona': ['#1d60ad', W, 1900, 'Los Periquitos', 'ESP'],
  'Getafe CF': ['#005999', W, 1983, 'Los Azulones', 'GET'],
  'Málaga CF': ['#0f8ad2', W, 1994, 'Los Boquerones', 'MAL'],
  'Levante UD': ['#004b98', '#b4053f', 1909, 'Los Granotas', 'LEV'],
  'Real Racing Club de Santander': ['#006c3b', W, 1913, 'El Racing', 'RAC'],
  'Rayo Vallecano de Madrid': ['#e53027', W, 1924, 'Los Franjirrojos', 'RAY'],

  // ---------- Serie A ----------
  'FC Internazionale Milano': ['#0068a8', B, 1908, 'Nerazzurri', 'INT'],
  'AC Milan': ['#fb090b', B, 1899, 'Rossoneri', 'MIL'],
  'Juventus FC': [B, W, 1897, 'La Vecchia Signora', 'JUV'],
  'SSC Napoli': ['#12a0d7', W, 1926, 'Partenopei', 'NAP'],
  'AS Roma': ['#8e1f2f', '#f0bc42', 1927, 'Giallorossi', 'ROM'],
  'SS Lazio': ['#87d8f7', '#14213d', 1900, 'Biancocelesti', 'LAZ'],
  'Atalanta BC': ['#1e71b8', B, 1907, 'La Dea', 'ATA'],
  'ACF Fiorentina': ['#482e92', W, 1926, 'La Viola', 'FIO'],
  'Bologna FC 1909': ['#a21c26', '#1a2f48', 1909, 'Rossoblù', 'BOL'],
  'Torino FC': ['#8a1e03', W, 1906, 'Il Toro', 'TOR'],
  'Udinese Calcio': [B, W, 1896, 'Zebrette', 'UDI'],
  'Genoa CFC': ['#ab1c2c', '#1a2a4f', 1893, 'Il Grifone', 'GEN'],
  'Cagliari Calcio': ['#a6192e', '#002350', 1920, 'Gli Isolani', 'CAG'],
  'US Lecce': ['#ffd200', '#e30613', 1908, 'I Salentini', 'LEC'],
  'Como 1907': ['#1d3d7a', W, 1907, 'I Lariani', 'COM'],
  'Parma Calcio 1913': ['#1b3c8f', '#ffd200', 1913, 'I Crociati', 'PAR'],
  'US Sassuolo Calcio': ['#00a752', B, 1920, 'I Neroverdi', 'SAS'],
  'AC Monza': ['#e30613', W, 1912, 'I Brianzoli', 'MON'],
  'Venezia FC': ['#f47920', '#00703c', 1907, 'I Lagunari', 'VEN'],
  'Frosinone Calcio': ['#ffd200', '#0a3d8f', 1928, 'I Canarini', 'FRO'],

  // ---------- Ligue 1 ----------
  'Paris Saint-Germain FC': ['#004170', '#da291c', 1970, 'Les Parisiens', 'PSG'],
  'Paris FC': ['#1c3f94', W, 1969, 'Le PFC', 'PFC'],
  'Olympique de Marseille': ['#2faee0', W, 1899, 'Les Phocéens', 'OM'],
  'Olympique Lyonnais': ['#14387f', '#e30613', 1950, 'Les Gones', 'OL'],
  'AS Monaco FC': ['#e7182f', W, 1924, 'Les Monégasques', 'ASM'],
  'LOSC Lille': ['#e01e13', '#1b2d5b', 1944, 'Les Dogues', 'LIL'],
  'RC Lens': ['#ffe500', '#e30613', 1906, 'Les Sang et Or', 'RCL'],
  'OGC Nice': ['#e2001a', B, 1904, 'Les Aiglons', 'NIC'],
  'Stade Rennais FC 1901': ['#e13327', B, 1901, 'Les Rouge et Noir', 'REN'],
  'RC Strasbourg Alsace': ['#009fe3', W, 1906, 'Le Racing', 'RCS'],
  'Toulouse FC': ['#5b2c86', W, 1970, 'Les Violets', 'TFC'],
  'Stade Brestois 29': ['#e30613', W, 1950, 'Les Pirates', 'SB29'],
  'AJ Auxerre': ['#0a3f8f', W, 1905, "L'AJA", 'AJA'],
  'Angers SCO': [B, W, 1919, 'Le SCO', 'SCO'],
  'Le Havre AC': ['#5aa4dc', '#0d2340', 1872, 'Les Ciel et Marine', 'HAC'],
  'Le Mans FC': ['#e30613', '#ffd200', 1985, 'Les Manceaux', 'LMFC'],
  'FC Lorient': ['#f58113', B, 1926, 'Les Merlus', 'FCL'],
  'ES Troyes AC': ['#0a4ba0', W, 1986, "L'ESTAC", 'ETR'],
}

const DEFAULT: ClubInfo = {
  primary: '#0a7cff', secondary: W, founded: 0, nickname: '', short: '',
}

export const CLUBS: Record<string, ClubInfo> = Object.fromEntries(
  Object.entries(ROWS).map(([name, [primary, secondary, founded, nickname, short]]) =>
    [name, { primary, secondary, founded, nickname, short }]),
)

const GENERATED = new Map<string, ClubInfo>()
for (const s of data as Stadium[]) {
  for (const t of s.teams) {
    if (CLUBS[t.name] || (!t.colors && !t.short)) continue
    GENERATED.set(t.name, {
      ...DEFAULT,
      ...(t.colors ? { primary: t.colors[0], secondary: t.colors[1] } : {}),
      short: t.short ?? '',
    })
  }
}

export function clubInfo(name: string): ClubInfo {
  const info = CLUBS[name] ?? GENERATED.get(name)
  if (info?.short) return info
  return { ...(info ?? DEFAULT), short: name.replace(/[^A-ZÄÖÜ]/g, '').slice(0, 3) || name.slice(0, 3).toUpperCase() }
}
