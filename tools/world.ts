// Sammelt aus den ESPN-Spielplänen aller Ligen die Vereine mit Heimstadion, Farben und Kürzel und
// schreibt sie nach tools/world.source.json. `npm run stadiums` geokodiert daraus die Stadien.
// Für die Top 5 (handgepflegt in stadiums.source.ts) werden nur die ESPN-Stadion-IDs übernommen.
// Aufruf: npm run world   (einmal pro Saison, danach npm run stadiums)

import { readFileSync, writeFileSync } from 'node:fs'
import { LEAGUES, leagueByCode, leagueSeason } from '../src/shared/leagues.ts'
import { countryName } from '../src/shared/countries.ts'
import { fetchEspnSeason, type EspnTeam, type EspnVenue } from '../server/providers/espn.ts'

export interface WorldClub {
  league: string
  espnId: string
  name: string
  aliases: string[]
  short: string
  colors: [string, string]
  venue: { id: string; name: string; city: string; country: string } | null
}

export interface WorldSource {
  /** Top-5-Verein → ESPN-Stadion-IDs seines Heimstadions */
  top5Venues: Record<string, string[]>
  clubs: WorldClub[]
}

const CRESTS = JSON.parse(readFileSync(new URL('../src/data/crests.json', import.meta.url), 'utf8')) as Record<string, string>
const top5ById = new Map(Object.entries(CRESTS).map(([name, id]) => [id, name]))

interface Seen { team: EspnTeam; league: string; venues: Map<string, { n: number; venue: EspnVenue }> }
const seen = new Map<string, Seen>()

for (const l of LEAGUES) {
  if (l.kind !== 'league' || !l.espn) continue
  const events = await fetchEspnSeason(l.espn, leagueSeason(l), l.calendar)
  console.log(`${l.name.padEnd(28)} ${events.length} Spiele`)
  for (const e of events) {
    const comp = e.competitions[0]
    for (const c of comp?.competitors ?? []) {
      const id = c.team.id
      // Ein Verein gehört zur ersten (höchsten) Liga, in der er auftaucht
      if (!seen.has(id)) seen.set(id, { team: c.team, league: l.code, venues: new Map() })
      const s = seen.get(id)!
      if (s.league !== l.code || c.homeAway !== 'home' || comp.neutralSite || !comp.venue?.id) continue
      const v = s.venues.get(comp.venue.id) ?? { n: 0, venue: comp.venue }
      v.n++
      s.venues.set(comp.venue.id, v)
    }
  }
}

const hex = (c?: string) => (c && /^[0-9a-f]{6}$/i.test(c) ? '#' + c.toLowerCase() : null)
const light = (c: string) => {
  const n = parseInt(c.slice(1), 16)
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 225
}

function colors(t: EspnTeam): [string, string] {
  let a = hex(t.color) ?? '#0a7cff'
  let b = hex(t.alternateColor) ?? '#ffffff'
  // Weiß als Hauptfarbe wirkt auf den hellen Karten blass – dann die Zweitfarbe nach vorn
  if (light(a) && !light(b)) [a, b] = [b, a]
  return [a, b]
}

const top5Venues: Record<string, string[]> = {}
const clubs: WorldClub[] = []
const usedNames = new Set(Object.keys(CRESTS))

for (const { team, league, venues } of seen.values()) {
  // Platzhalter wie „TBD Home“ und Auswahlteams (All-Star-Spiele) überspringen
  if (/\bTBD\b|All-?Stars/i.test(team.displayName)) continue
  const ranked = [...venues.values()].sort((a, b) => b.n - a.n)
  const top5 = top5ById.get(team.id)
  if (top5) {
    if (ranked[0]) top5Venues[top5] = [ranked[0].venue.id!]
    continue
  }
  const lg = leagueByCode(league)
  if (lg.source === 'top5') {
    // Verein einer Top-5-Liga, der in stadiums.source.ts fehlt
    console.warn(`  Top-5-Verein ohne Eintrag: ${team.displayName} (${league}, ESPN ${team.id})`)
    continue
  }
  let name = team.displayName
  if (usedNames.has(name)) name += ` (${countryName(lg.countryCode)})`
  usedNames.add(name)
  const aliases = [...new Set([team.displayName, team.shortDisplayName, team.name, team.location]
    .filter((n): n is string => !!n && n !== name))]
  const v = ranked[0]?.venue
  clubs.push({
    league,
    espnId: team.id,
    name,
    aliases,
    short: (team.abbreviation ?? name.slice(0, 3)).toUpperCase(),
    colors: colors(team),
    venue: v?.id && v.fullName ? { id: v.id, name: v.fullName.trim().replace(/^['"]+|['"]+$/g, ''), city: v.address?.city?.trim() ?? '', country: v.address?.country ?? '' } : null,
  })
}

const out: WorldSource = { top5Venues, clubs }
writeFileSync(new URL('world.source.json', import.meta.url), JSON.stringify(out, null, 1) + '\n')
const noVenue = clubs.filter((c) => !c.venue)
console.log(`\n${clubs.length} Vereine, ${Object.keys(top5Venues).length} Top-5-Stadion-IDs → tools/world.source.json`)
if (noVenue.length) console.log(`Ohne Heimstadion (${noVenue.length}): ${noVenue.map((c) => c.name).join(', ')}`)
