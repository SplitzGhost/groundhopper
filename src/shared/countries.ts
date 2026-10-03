// Länder und Verbände: deutscher Name je Code. Länder als ISO-3166-Code (kleingeschrieben),
// Landesteile des Vereinigten Königreichs wie in ISO 3166-2, Kontinentalverbände mit eigenem Kürzel.
// Hinweis: 'gb' steht – wie seit Beginn der App – für England.

export const COUNTRY_NAMES: Record<string, string> = {
  de: 'Deutschland',
  gb: 'England',
  'gb-sct': 'Schottland',
  'gb-wls': 'Wales',
  es: 'Spanien',
  ad: 'Andorra',
  it: 'Italien',
  fr: 'Frankreich',
  mc: 'Monaco',
  nl: 'Niederlande',
  pt: 'Portugal',
  be: 'Belgien',
  at: 'Österreich',
  ch: 'Schweiz',
  tr: 'Türkei',
  gr: 'Griechenland',
  dk: 'Dänemark',
  no: 'Norwegen',
  se: 'Schweden',
  ru: 'Russland',
  us: 'USA',
  ca: 'Kanada',
  mx: 'Mexiko',
  hn: 'Honduras',
  cr: 'Costa Rica',
  gt: 'Guatemala',
  sv: 'El Salvador',
  br: 'Brasilien',
  ar: 'Argentinien',
  cl: 'Chile',
  uy: 'Uruguay',
  co: 'Kolumbien',
  pe: 'Peru',
  py: 'Paraguay',
  ec: 'Ecuador',
  ve: 'Venezuela',
  bo: 'Bolivien',
  jp: 'Japan',
  cn: 'China',
  sa: 'Saudi-Arabien',
  in: 'Indien',
  au: 'Australien',
  nz: 'Neuseeland',
  za: 'Südafrika',
  // Verbände
  uefa: 'Europa',
  concacaf: 'Nord- & Mittelamerika',
  conmebol: 'Südamerika',
  afc: 'Asien',
  caf: 'Afrika',
  fifa: 'Welt',
}

export const countryName = (code: string) => COUNTRY_NAMES[code] ?? code.toUpperCase()

/** Ländernamen, wie ESPN sie bei Stadionadressen schreibt → Code */
export const ESPN_COUNTRY: Record<string, string> = {
  Germany: 'de', England: 'gb', Scotland: 'gb-sct', Wales: 'gb-wls', Spain: 'es', Andorra: 'ad', Italy: 'it', France: 'fr',
  Monaco: 'mc', Netherlands: 'nl', Portugal: 'pt', Belgium: 'be', Austria: 'at', Switzerland: 'ch',
  Turkey: 'tr', 'Türkiye': 'tr', Greece: 'gr', Denmark: 'dk', Norway: 'no', Sweden: 'se', Russia: 'ru',
  USA: 'us', 'United States': 'us', Canada: 'ca', Mexico: 'mx', Honduras: 'hn', 'Costa Rica': 'cr',
  Guatemala: 'gt', 'El Salvador': 'sv', Brazil: 'br', Argentina: 'ar', Chile: 'cl', Uruguay: 'uy',
  Colombia: 'co', Peru: 'pe', Paraguay: 'py', Ecuador: 'ec', Venezuela: 've', Bolivia: 'bo', Japan: 'jp',
  China: 'cn', "China PR": 'cn', 'Saudi Arabia': 'sa', India: 'in', Australia: 'au', 'New Zealand': 'nz',
  'South Africa': 'za',
}

/** Für die Geokodierung (Nominatim erwartet echte ISO-Codes) */
export const isoCountry = (code: string) => code.split('-')[0]
