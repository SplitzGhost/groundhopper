// Vereinsdaten für die Sammelkarten: Farben, Trikotmuster, Gründungsjahr, Spitzname, Kürzel.
// Schlüssel = Vereinsname wie in stadiums.json. Farben sind auf die Darstellung abgestimmt,
// keine offiziellen Farbwerte.

export type KitPattern = 'solid' | 'stripes' | 'sleeves' | 'band' | 'vband' | 'sash' | 'halves' | 'diagonal' | 'cross'

export interface ClubInfo {
  /** Erkennungsfarbe (Sitze im Stadion, Kartenakzent) */
  primary: string
  secondary: string
  /** Trikot: Grundfarbe, Musterfarbe, Muster */
  kit: [body: string, detail: string, pattern: KitPattern]
  founded: number
  nickname: string
  short: string
}

const W = '#ffffff'
const B = '#111111'

type Row = [primary: string, secondary: string, founded: number, nickname: string, short: string, kit?: ClubInfo['kit']]

const ROWS: Record<string, Row> = {
  // ---------- Bundesliga ----------
  'FC Bayern München': ['#dc052d', W, 1900, 'Die Roten', 'FCB'],
  'Borussia Dortmund': ['#fde100', B, 1909, 'Die Schwarzgelben', 'BVB'],
  'Bayer 04 Leverkusen': ['#e32221', B, 1904, 'Werkself', 'B04', [B, '#e32221', 'solid']],
  'RB Leipzig': ['#dd0741', '#0c2043', 2009, 'Die Roten Bullen', 'RBL', [W, '#dd0741', 'solid']],
  'VfB Stuttgart': ['#e32219', W, 1893, 'Die Schwaben', 'VFB', [W, '#e32219', 'band']],
  'Eintracht Frankfurt': ['#e1000f', B, 1899, 'Die Adler', 'SGE', [B, '#e1000f', 'solid']],
  'SC Freiburg': ['#e2001a', B, 1904, 'Breisgau-Brasilianer', 'SCF'],
  'Borussia Mönchengladbach': ['#1a9f4a', B, 1900, 'Die Fohlen', 'BMG', [W, B, 'band']],
  '1. FSV Mainz 05': ['#ed1c24', W, 1905, 'Die Nullfünfer', 'M05'],
  'FC Augsburg': ['#ba3733', '#46714d', 1907, 'Fuggerstädter', 'FCA', [W, '#ba3733', 'band']],
  'SV Werder Bremen': ['#1d9053', W, 1899, 'Die Grün-Weißen', 'SVW'],
  '1. FC Union Berlin': ['#eb1923', W, 1966, 'Die Eisernen', 'FCU'],
  'TSG Hoffenheim': ['#1c63b7', W, 1899, 'Die Kraichgauer', 'TSG'],
  '1. FC Köln': ['#ed1c24', W, 1948, 'Die Geißböcke', 'KOE', [W, '#ed1c24', 'band']],
  'Hamburger SV': ['#0a3f86', '#e2001a', 1887, 'Die Rothosen', 'HSV', [W, '#0a3f86', 'solid']],
  'FC Schalke 04': ['#004d9d', W, 1904, 'Die Knappen', 'S04'],
  'SC Paderborn 07': ['#005ca9', B, 1907, 'Die Ostwestfalen', 'SCP'],
  'SV 07 Elversberg': ['#1d1d1b', W, 1907, 'Die SVE', 'SVE', [B, W, 'band']],

  // ---------- Premier League ----------
  'Arsenal FC': ['#ef0107', W, 1886, 'The Gunners', 'ARS', ['#ef0107', W, 'sleeves']],
  'Aston Villa FC': ['#7a1a3e', '#95bfe5', 1874, 'The Villans', 'AVL', ['#7a1a3e', '#95bfe5', 'sleeves']],
  'AFC Bournemouth': ['#da291c', B, 1899, 'The Cherries', 'BOU', ['#da291c', B, 'stripes']],
  'Brentford FC': ['#e30613', W, 1889, 'The Bees', 'BRE', ['#e30613', W, 'stripes']],
  'Brighton & Hove Albion FC': ['#0057b8', W, 1901, 'The Seagulls', 'BHA', ['#0057b8', W, 'stripes']],
  'Chelsea FC': ['#034694', W, 1905, 'The Blues', 'CHE'],
  'Coventry City FC': ['#74b9e6', W, 1883, 'The Sky Blues', 'COV'],
  'Crystal Palace FC': ['#1b458f', '#c4122e', 1905, 'The Eagles', 'CRY', ['#1b458f', '#c4122e', 'stripes']],
  'Everton FC': ['#003399', W, 1878, 'The Toffees', 'EVE'],
  'Fulham FC': [B, W, 1879, 'The Cottagers', 'FUL', [W, B, 'solid']],
  'Hull City AFC': ['#f5a12d', B, 1904, 'The Tigers', 'HUL', ['#f5a12d', B, 'stripes']],
  'Ipswich Town FC': ['#3a64a3', W, 1878, 'The Tractor Boys', 'IPS'],
  'Leeds United FC': ['#1d428a', '#ffcd00', 1919, 'The Whites', 'LEE', [W, '#1d428a', 'solid']],
  'Liverpool FC': ['#c8102e', W, 1892, 'The Reds', 'LIV'],
  'Manchester City FC': ['#6cabdd', '#1c2c5b', 1880, 'The Citizens', 'MCI'],
  'Manchester United FC': ['#da291c', B, 1878, 'The Red Devils', 'MUN'],
  'Newcastle United FC': ['#241f20', W, 1892, 'The Magpies', 'NEW', [B, W, 'stripes']],
  'Nottingham Forest FC': ['#dd0000', W, 1865, 'Forest', 'NFO'],
  'Sunderland AFC': ['#eb172b', W, 1879, 'The Black Cats', 'SUN', ['#eb172b', W, 'stripes']],
  'Tottenham Hotspur FC': ['#132257', W, 1882, 'Spurs', 'TOT', [W, '#132257', 'solid']],

  // ---------- La Liga ----------
  'Real Madrid CF': ['#1f3f8f', '#febe10', 1902, 'Los Blancos', 'RMA', [W, '#febe10', 'solid']],
  'FC Barcelona': ['#a50044', '#004d98', 1899, 'Barça', 'BAR', ['#004d98', '#a50044', 'stripes']],
  'Club Atlético de Madrid': ['#cb3524', '#272e61', 1903, 'Los Colchoneros', 'ATM', ['#cb3524', W, 'stripes']],
  'Athletic Club': ['#ee2523', W, 1898, 'Los Leones', 'ATH', ['#ee2523', W, 'stripes']],
  'Real Sociedad de Fútbol': ['#0067b1', W, 1909, 'Txuri-Urdin', 'RSO', ['#0067b1', W, 'stripes']],
  'Real Betis Balompié': ['#0bb363', W, 1907, 'Los Verdiblancos', 'BET', ['#0bb363', W, 'stripes']],
  'Sevilla FC': ['#d81e05', W, 1890, 'Los Sevillistas', 'SEV', [W, '#d81e05', 'solid']],
  'Valencia CF': ['#f18e00', B, 1919, 'Los Che', 'VAL', [W, B, 'solid']],
  'Villarreal CF': ['#ffd300', '#005187', 1923, 'El Submarino Amarillo', 'VIL'],
  'CA Osasuna': ['#d91a21', '#0a346f', 1920, 'Los Rojillos', 'OSA'],
  'RC Celta de Vigo': ['#8ac3ee', '#e5254e', 1923, 'Os Celestes', 'CEL'],
  'RC Deportivo La Coruña': ['#0050a0', W, 1906, 'Dépor', 'DEP', ['#0050a0', W, 'stripes']],
  'Deportivo Alavés': ['#0761af', W, 1921, 'El Glorioso', 'ALA', ['#0761af', W, 'stripes']],
  'Elche CF': ['#05642c', W, 1923, 'Los Franjiverdes', 'ELC', [W, '#05642c', 'band']],
  'RCD Espanyol de Barcelona': ['#1d60ad', W, 1900, 'Los Periquitos', 'ESP', ['#1d60ad', W, 'stripes']],
  'Getafe CF': ['#005999', W, 1983, 'Los Azulones', 'GET'],
  'Málaga CF': ['#0f8ad2', W, 1994, 'Los Boquerones', 'MAL', ['#0f8ad2', W, 'stripes']],
  'Levante UD': ['#004b98', '#b4053f', 1909, 'Los Granotas', 'LEV', ['#b4053f', '#004b98', 'stripes']],
  'Real Racing Club de Santander': ['#006c3b', W, 1913, 'El Racing', 'RAC', [W, '#006c3b', 'solid']],
  'Rayo Vallecano de Madrid': ['#e53027', W, 1924, 'Los Franjirrojos', 'RAY', [W, '#e53027', 'sash']],

  // ---------- Serie A ----------
  'FC Internazionale Milano': ['#0068a8', B, 1908, 'Nerazzurri', 'INT', ['#0068a8', B, 'stripes']],
  'AC Milan': ['#fb090b', B, 1899, 'Rossoneri', 'MIL', ['#fb090b', B, 'stripes']],
  'Juventus FC': [B, W, 1897, 'La Vecchia Signora', 'JUV', [W, B, 'stripes']],
  'SSC Napoli': ['#12a0d7', W, 1926, 'Partenopei', 'NAP'],
  'AS Roma': ['#8e1f2f', '#f0bc42', 1927, 'Giallorossi', 'ROM'],
  'SS Lazio': ['#87d8f7', '#14213d', 1900, 'Biancocelesti', 'LAZ'],
  'Atalanta BC': ['#1e71b8', B, 1907, 'La Dea', 'ATA', ['#1e71b8', B, 'stripes']],
  'ACF Fiorentina': ['#482e92', W, 1926, 'La Viola', 'FIO'],
  'Bologna FC 1909': ['#a21c26', '#1a2f48', 1909, 'Rossoblù', 'BOL', ['#a21c26', '#1a2f48', 'stripes']],
  'Torino FC': ['#8a1e03', W, 1906, 'Il Toro', 'TOR'],
  'Udinese Calcio': [B, W, 1896, 'Zebrette', 'UDI', [W, B, 'stripes']],
  'Genoa CFC': ['#ab1c2c', '#1a2a4f', 1893, 'Il Grifone', 'GEN', ['#ab1c2c', '#1a2a4f', 'halves']],
  'Cagliari Calcio': ['#a6192e', '#002350', 1920, 'Gli Isolani', 'CAG', ['#a6192e', '#002350', 'halves']],
  'US Lecce': ['#ffd200', '#e30613', 1908, 'I Salentini', 'LEC', ['#ffd200', '#e30613', 'stripes']],
  'Como 1907': ['#1d3d7a', W, 1907, 'I Lariani', 'COM'],
  'Parma Calcio 1913': ['#1b3c8f', '#ffd200', 1913, 'I Crociati', 'PAR', [W, B, 'cross']],
  'US Sassuolo Calcio': ['#00a752', B, 1920, 'I Neroverdi', 'SAS', ['#00a752', B, 'stripes']],
  'AC Monza': ['#e30613', W, 1912, 'I Brianzoli', 'MON', ['#e30613', W, 'band']],
  'Venezia FC': ['#f47920', '#00703c', 1907, 'I Lagunari', 'VEN', [B, '#f47920', 'band']],
  'Frosinone Calcio': ['#ffd200', '#0a3d8f', 1928, 'I Canarini', 'FRO'],

  // ---------- Ligue 1 ----------
  'Paris Saint-Germain FC': ['#004170', '#da291c', 1970, 'Les Parisiens', 'PSG', ['#004170', '#da291c', 'vband']],
  'Paris FC': ['#1c3f94', W, 1969, 'Le PFC', 'PFC'],
  'Olympique de Marseille': ['#2faee0', W, 1899, 'Les Phocéens', 'OM', [W, '#2faee0', 'solid']],
  'Olympique Lyonnais': ['#14387f', '#e30613', 1950, 'Les Gones', 'OL', [W, '#e30613', 'band']],
  'AS Monaco FC': ['#e7182f', W, 1924, 'Les Monégasques', 'ASM', ['#e7182f', W, 'diagonal']],
  'LOSC Lille': ['#e01e13', '#1b2d5b', 1944, 'Les Dogues', 'LIL'],
  'RC Lens': ['#ffe500', '#e30613', 1906, 'Les Sang et Or', 'RCL', ['#ffe500', '#e30613', 'sleeves']],
  'OGC Nice': ['#e2001a', B, 1904, 'Les Aiglons', 'NIC', ['#e2001a', B, 'stripes']],
  'Stade Rennais FC 1901': ['#e13327', B, 1901, 'Les Rouge et Noir', 'REN'],
  'RC Strasbourg Alsace': ['#009fe3', W, 1906, 'Le Racing', 'RCS'],
  'Toulouse FC': ['#5b2c86', W, 1970, 'Les Violets', 'TFC'],
  'Stade Brestois 29': ['#e30613', W, 1950, 'Les Pirates', 'SB29'],
  'AJ Auxerre': ['#0a3f8f', W, 1905, "L'AJA", 'AJA', [W, '#0a3f8f', 'solid']],
  'Angers SCO': [B, W, 1919, 'Le SCO', 'SCO', [B, W, 'stripes']],
  'Le Havre AC': ['#5aa4dc', '#0d2340', 1872, 'Les Ciel et Marine', 'HAC', ['#5aa4dc', '#0d2340', 'halves']],
  'Le Mans FC': ['#e30613', '#ffd200', 1985, 'Les Manceaux', 'LMFC'],
  'FC Lorient': ['#f58113', B, 1926, 'Les Merlus', 'FCL'],
  'ES Troyes AC': ['#0a4ba0', W, 1986, "L'ESTAC", 'ETR'],
}

const DEFAULT: ClubInfo = {
  primary: '#0a7cff', secondary: W, kit: ['#0a7cff', W, 'solid'], founded: 0, nickname: '', short: '',
}

export const CLUBS: Record<string, ClubInfo> = Object.fromEntries(
  Object.entries(ROWS).map(([name, [primary, secondary, founded, nickname, short, kit]]) =>
    [name, { primary, secondary, founded, nickname, short, kit: kit ?? [primary, secondary, 'solid'] }]),
)

export function clubInfo(name: string): ClubInfo {
  return CLUBS[name] ?? { ...DEFAULT, short: name.replace(/[^A-ZÄÖÜ]/g, '').slice(0, 3) || name.slice(0, 3).toUpperCase() }
}
