// Ordnet allen Vereinen aus src/data/stadiums.json ein Wappen zu und schreibt die Tabelle
// nach src/data/crests.json. Quelle: die frei abrufbaren Team-Listen von ESPN (1. und 2. Liga),
// damit Wappen auch im Demo-Modus ohne football-data-Schlüssel für alle Ligen da sind.
// Aufruf: npm run crests

import { readFileSync, writeFileSync } from 'node:fs'
import type { LeagueCode, Stadium } from '../src/shared/types.ts'
import { createTeamMatcher } from '../src/shared/teamMatch.ts'

const ESPN: Record<LeagueCode, string[]> = {
  BL1: ['ger.1', 'ger.2'],
  PL: ['eng.1', 'eng.2'],
  PD: ['esp.1', 'esp.2'],
  SA: ['ita.1', 'ita.2'],
  FL1: ['fra.1', 'fra.2'],
}

interface EspnTeam { id: string; displayName: string; shortDisplayName: string; name: string; location: string }

const stadiums = JSON.parse(readFileSync(new URL('../src/data/stadiums.json', import.meta.url), 'utf8')) as Stadium[]
const match = createTeamMatcher(stadiums)
const clubs = stadiums.flatMap((s) => s.teams)

const crests: Record<string, string> = {}
for (const [league, slugs] of Object.entries(ESPN) as [LeagueCode, string[]][]) {
  for (const slug of slugs) {
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/teams`)
    if (!res.ok) throw new Error(`${res.status} bei ${slug}`)
    const json = await res.json() as { sports: { leagues: { teams: { team: EspnTeam }[] }[] }[] }
    for (const { team } of json.sports[0].leagues[0].teams) {
      const hit = [team.displayName, team.location, team.shortDisplayName, team.name]
        .map((n) => match(n, league)).find(Boolean)
      if (hit && !crests[hit.team]) crests[hit.team] = team.id
    }
  }
}

const sorted = Object.fromEntries(clubs.filter((c) => crests[c.name]).map((c) => [c.name, crests[c.name]]))
writeFileSync(new URL('../src/data/crests.json', import.meta.url), JSON.stringify(sorted, null, 2) + '\n')

const missing = clubs.filter((c) => !crests[c.name]).map((c) => c.name)
console.log(`${Object.keys(sorted).length} von ${clubs.length} Wappen → src/data/crests.json`)
if (missing.length) console.warn('  Ohne Wappen:', missing.join(', '))
