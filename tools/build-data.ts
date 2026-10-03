// Schreibt den kompletten Spielplan als statische Datei public/data/matches.json.
// Für die Website auf GitHub Pages, wo kein API-Server läuft – die GitHub Action ruft das
// vor jedem Build auf (bei jedem Push und alle 6 Stunden).
// Aufruf: npm run data   (mit FOOTBALL_DATA_API_KEY in .env bzw. als Repo-Secret)

import { mkdirSync, writeFileSync } from 'node:fs'
import { LEAGUE_CODES, currentSeason } from '../src/shared/leagues.ts'
import { loadMatches, provider } from '../server/loadMatches.ts'

const season = currentSeason()
const data = await loadMatches(LEAGUE_CODES, season)
const dir = new URL('../public/data/', import.meta.url)
mkdirSync(dir, { recursive: true })
writeFileSync(new URL('matches.json', dir), JSON.stringify(data))

console.log(`${data.matches.length} Spiele (${provider.name}, Saison ${season}/${String(season + 1).slice(2)}) → public/data/matches.json`)
for (const w of data.warnings) console.warn('  Hinweis:', w)
if (!data.matches.length) {
  console.error('Keine Spiele geladen – Abbruch, damit die Website nicht mit leerem Spielplan veröffentlicht wird.')
  process.exit(1)
}
