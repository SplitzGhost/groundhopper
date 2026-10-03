// Alle Wettbewerbe der App. Die Reihenfolge ist zugleich die Anzeigereihenfolge (Filter, Spielplan,
// Sammellisten): Top 5, dann je Land die Ligen und Pokale, dann Europapokale und der Rest der Welt.
//
// Quellen: Top 5 über football-data.org bzw. die Demo-Quellen, fast alles andere über die freie
// ESPN-Schnittstelle, 3. Liga und Regionalligen über OpenLigaDB.

import type { League, LeagueCode } from './types.ts'
import { countryName } from './countries.ts'

type Opts = Partial<Pick<League, 'tier' | 'calendar'>>

const top5 = (code: string, name: string, shortName: string, countryCode: string, espn: string, logo: number): League =>
  ({ code, name, shortName, country: countryName(countryCode), countryCode, kind: 'league', tier: 1, source: 'top5', espn, logo })

const league = (espn: string, name: string, shortName: string, countryCode: string, logo: number | null, opts: Opts = {}): League =>
  ({ code: espn, name, shortName, country: countryName(countryCode), countryCode, kind: 'league', tier: 1, source: 'espn', espn, logo, ...opts })

const cup = (espn: string, name: string, shortName: string, countryCode: string, logo: number | null, opts: Opts = {}): League =>
  ({ code: espn, name, shortName, country: countryName(countryCode), countryCode, kind: 'cup', source: 'espn', espn, logo, ...opts })

const oldb = (code: string, name: string, shortName: string, tier: number): League =>
  ({ code, name, shortName, country: 'Deutschland', countryCode: 'de', kind: 'league', tier, source: 'openligadb', openLigaDb: code, logo: null })

const CAL = { calendar: true }

export const LEAGUES: League[] = [
  // ---------- Top 5 ----------
  top5('BL1', 'Bundesliga', 'BL', 'de', 'ger.1', 10),
  top5('PL', 'Premier League', 'PL', 'gb', 'eng.1', 23),
  top5('PD', 'La Liga', 'LL', 'es', 'esp.1', 15),
  top5('SA', 'Serie A', 'SA', 'it', 'ita.1', 12),
  top5('FL1', 'Ligue 1', 'L1', 'fr', 'fra.1', 9),

  // ---------- Deutschland ----------
  league('ger.2', '2. Bundesliga', '2.BL', 'de', 97, { tier: 2 }),
  oldb('bl3', '3. Liga', '3.L', 3),
  oldb('rln', 'Regionalliga Nord', 'RLN', 4),
  oldb('rlno', 'Regionalliga Nordost', 'RLNO', 4),
  cup('ger.dfb_pokal', 'DFB-Pokal', 'DFB', 'de', 2061),
  cup('ger.super_cup', 'Supercup', 'DSC', 'de', null),

  // ---------- England ----------
  league('eng.2', 'Championship', 'EFL', 'gb', 24, { tier: 2 }),
  league('eng.3', 'League One', 'LG1', 'gb', 25, { tier: 3 }),
  league('eng.4', 'League Two', 'LG2', 'gb', 26, { tier: 4 }),
  league('eng.5', 'National League', 'NL', 'gb', null, { tier: 5 }),
  cup('eng.fa', 'FA Cup', 'FA', 'gb', 40),
  cup('eng.league_cup', 'EFL Cup', 'LC', 'gb', 41),
  cup('eng.trophy', 'EFL Trophy', 'EFT', 'gb', 42),
  cup('eng.charity', 'Community Shield', 'CS', 'gb', null),

  // ---------- Spanien, Italien, Frankreich ----------
  league('esp.2', 'LaLiga 2', 'LL2', 'es', 107, { tier: 2 }),
  cup('esp.copa_del_rey', 'Copa del Rey', 'CdR', 'es', 80),
  cup('esp.super_cup', 'Supercopa', 'SCE', 'es', 431),
  league('ita.2', 'Serie B', 'SB', 'it', 99, { tier: 2 }),
  cup('ita.coppa_italia', 'Coppa Italia', 'CI', 'it', 2192),
  cup('ita.super_cup', 'Supercoppa', 'SCI', 'it', null),
  league('fra.2', 'Ligue 2', 'L2', 'fr', 96, { tier: 2 }),
  cup('fra.coupe_de_france', 'Coupe de France', 'CdF', 'fr', 182),
  cup('fra.super_cup', 'Trophée des Champions', 'TdC', 'fr', null),

  // ---------- Europapokale ----------
  cup('uefa.champions', 'Champions League', 'CL', 'uefa', 2),
  cup('uefa.europa', 'Europa League', 'EL', 'uefa', 2310),
  cup('uefa.europa.conf', 'Conference League', 'ECL', 'uefa', 20296),
  cup('uefa.champions_qual', 'Champions-League-Quali', 'CLQ', 'uefa', 2),
  cup('uefa.europa_qual', 'Europa-League-Quali', 'ELQ', 'uefa', 2310),
  cup('uefa.europa.conf_qual', 'Conference-League-Quali', 'ECLQ', 'uefa', 20296),
  cup('uefa.super_cup', 'UEFA Super Cup', 'USC', 'uefa', 1272),

  // ---------- Übriges Europa ----------
  league('ned.1', 'Eredivisie', 'ERE', 'nl', 11),
  league('ned.2', 'Eerste Divisie', 'KKD', 'nl', 105, { tier: 2 }),
  cup('ned.cup', 'KNVB Beker', 'KNVB', 'nl', 2196),
  cup('ned.supercup', 'Johan Cruijff Schaal', 'JCS', 'nl', null),
  league('por.1', 'Liga Portugal', 'LPT', 'pt', 14),
  cup('por.taca.portugal', 'Taça de Portugal', 'TdP', 'pt', null),
  league('sco.1', 'Scottish Premiership', 'SPL', 'gb-sct', 45),
  league('sco.2', 'Scottish Championship', 'SCH', 'gb-sct', null, { tier: 2 }),
  cup('sco.tennents', 'Scottish Cup', 'SC', 'gb-sct', null),
  cup('sco.cis', 'Scottish League Cup', 'SLC', 'gb-sct', null),
  cup('sco.challenge', 'Challenge Cup', 'SCC', 'gb-sct', null),
  league('bel.1', 'Pro League', 'JPL', 'be', 6),
  league('aut.1', 'Österreichische Bundesliga', 'ÖBL', 'at', 5),
  league('tur.1', 'Süper Lig', 'SÜL', 'tr', 18),
  league('gre.1', 'Super League', 'SLG', 'gr', 98),
  league('den.1', 'Superliga', 'DSL', 'dk', null),
  league('nor.1', 'Eliteserien', 'ELS', 'no', null, CAL),
  league('swe.1', 'Allsvenskan', 'ALL', 'se', 16, CAL),
  league('rus.1', 'Premjer-Liga', 'RPL', 'ru', 106),

  // ---------- Nord- und Mittelamerika ----------
  league('usa.1', 'Major League Soccer', 'MLS', 'us', 19, CAL),
  league('usa.usl.1', 'USL Championship', 'USL', 'us', 2292, { tier: 2, ...CAL }),
  league('usa.usl.l1', 'USL League One', 'USL1', 'us', 2452, { tier: 3, ...CAL }),
  cup('usa.open', 'US Open Cup', 'USOC', 'us', 69, CAL),
  league('mex.1', 'Liga MX', 'LMX', 'mx', 22),
  league('mex.2', 'Liga de Expansión MX', 'LEX', 'mx', 2306, { tier: 2 }),
  league('hon.1', 'Liga Nacional', 'LNH', 'hn', 2247),
  league('crc.1', 'Primera División', 'PDC', 'cr', 2245),
  league('gua.1', 'Liga Nacional', 'LNG', 'gt', 2248),
  league('slv.1', 'Primera División', 'PDS', 'sv', 2244),
  cup('concacaf.champions', 'Concacaf Champions Cup', 'CCC', 'concacaf', 2298, CAL),
  cup('concacaf.leagues.cup', 'Leagues Cup', 'LGC', 'concacaf', 2410, CAL),

  // ---------- Südamerika ----------
  league('bra.1', 'Brasileirão Série A', 'BRA', 'br', 85, CAL),
  league('bra.2', 'Brasileirão Série B', 'BRB', 'br', 2299, { tier: 2, ...CAL }),
  cup('bra.copa_do_brazil', 'Copa do Brasil', 'CdB', 'br', 528, CAL),
  league('arg.1', 'Liga Profesional', 'LPF', 'ar', 1, CAL),
  league('arg.2', 'Primera Nacional', 'PNA', 'ar', 2294, { tier: 2, ...CAL }),
  league('arg.3', 'Primera B', 'PBM', 'ar', 2308, { tier: 3, ...CAL }),
  cup('arg.copa', 'Copa Argentina', 'CdA', 'ar', 2320, CAL),
  league('chi.1', 'Primera División', 'PDCh', 'cl', 86, CAL),
  cup('chi.copa_chi', 'Copa Chile', 'CCh', 'cl', 2331, CAL),
  league('uru.1', 'Liga AUF', 'AUF', 'uy', 1592, CAL),
  league('col.1', 'Primera A', 'PAC', 'co', 1543, CAL),
  cup('col.copa', 'Copa Colombia', 'CCo', 'co', 2332, CAL),
  league('per.1', 'Liga 1', 'L1P', 'pe', 1813, CAL),
  league('par.1', 'Primera División', 'PDP', 'py', 1892, CAL),
  league('ecu.1', 'LigaPro', 'LPE', 'ec', 1944, CAL),
  league('ven.1', 'Liga FUTVE', 'FTV', 've', 1947, CAL),
  league('bol.1', 'División Profesional', 'DPB', 'bo', 1949, CAL),
  cup('conmebol.libertadores', 'Copa Libertadores', 'LIB', 'conmebol', 58, CAL),
  cup('conmebol.sudamericana', 'Copa Sudamericana', 'SUD', 'conmebol', 1208, CAL),

  // ---------- Asien, Ozeanien, Afrika ----------
  league('jpn.1', 'J1 League', 'J1', 'jp', 2199, CAL),
  league('chn.1', 'Super League', 'CSL', 'cn', 2350, CAL),
  league('ksa.1', 'Saudi Pro League', 'SAU', 'sa', 2488),
  cup('ksa.kings.cup', "King's Cup", 'KC', 'sa', null),
  league('ind.1', 'Indian Super League', 'ISL', 'in', 2334),
  cup('afc.champions', 'AFC Champions League Elite', 'ACL', 'afc', 2200),
  cup('afc.cup', 'AFC Champions League Two', 'ACL2', 'afc', 2243),
  league('aus.1', 'A-League', 'ALM', 'au', 1308),
  league('rsa.1', 'Premiership', 'PSL', 'za', null),
  cup('caf.champions', 'CAF Champions League', 'CAF', 'caf', 2391),
  cup('caf.confed', 'CAF Confederation Cup', 'CCF', 'caf', null),
  cup('fifa.intercontinental_cup', 'FIFA Intercontinental Cup', 'FIC', 'fifa', null),
]

export const LEAGUE_CODES = LEAGUES.map((l) => l.code)

const byCode = new Map(LEAGUES.map((l) => [l.code, l]))

/** Wettbewerb zu einem Kürzel – unbekannte (z. B. aus alten Sicherungen) bekommen einen Platzhalter. */
export const leagueByCode = (code: LeagueCode): League => byCode.get(code) ?? {
  code, name: code, shortName: code.slice(0, 4).toUpperCase(), country: '', countryCode: '', kind: 'league', source: 'espn', logo: null,
}

export const isKnownLeague = (code: string | null | undefined) => !!code && byCode.has(code)

/** Ligen mit festen Vereinen (ohne Pokale) */
export const DOMESTIC_LEAGUES = LEAGUES.filter((l) => l.kind === 'league')

/** Land/Verband → seine Wettbewerbe, in Katalogreihenfolge (Top-5-Länder vorne) */
export interface LeagueGroup {
  countryCode: string
  country: string
  leagues: League[]
}

function groupLeagues(list: League[]): LeagueGroup[] {
  const groups = new Map<string, LeagueGroup>()
  for (const l of list) {
    if (!groups.has(l.countryCode)) groups.set(l.countryCode, { countryCode: l.countryCode, country: l.country, leagues: [] })
    groups.get(l.countryCode)!.leagues.push(l)
  }
  return [...groups.values()]
}

export const LEAGUE_GROUPS = groupLeagues(LEAGUES)

/** Saison-Startjahr: ab Juli zählt die neue Saison (2026 = Saison 2026/27). */
export function currentSeason(now = new Date()): number {
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1
}

/** Laufende Saison eines Wettbewerbs – bei Kalenderjahr-Ligen das aktuelle Jahr. */
export function leagueSeason(l: League, now = new Date()): number {
  return l.calendar ? now.getFullYear() : currentSeason(now)
}
