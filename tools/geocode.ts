// Erzeugt src/data/stadiums.json aus tools/stadiums.source.ts (handgepflegt) und
// tools/world.source.json (aus den ESPN-Spielplänen, `npm run world`).
// Aufruf: npm run stadiums
// Koordinaten über OpenStreetMap Nominatim (max. 1 Anfrage pro Sekunde laut Nutzungsrichtlinie),
// ersatzweise über Wikidata (Stadionname → Koordinaten und Kapazität).
// Bereits bekannte Stadien behalten ihre Koordinaten, Abfragen landen in tools/geocache.json –
// ein erneuter Lauf fragt nur Neues ab.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { STADIUM_SOURCE } from './stadiums.source.ts'
import type { WorldSource } from './world.ts'
import type { Stadium, StadiumTeam } from '../src/shared/types.ts'
import { leagueByCode } from '../src/shared/leagues.ts'
import { ESPN_COUNTRY, isoCountry } from '../src/shared/countries.ts'

const OUT = new URL('../src/data/stadiums.json', import.meta.url)
const CACHE = new URL('geocache.json', import.meta.url)
const MAX_DISTANCE_KM = 30

interface Pos { lat: number; lon: number; capacity?: number; stadium?: boolean }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const cache: Record<string, Pos | null> = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {}
const previous = new Map<string, Stadium>(
  existsSync(OUT) ? (JSON.parse(readFileSync(OUT, 'utf8')) as Stadium[]).map((s) => [s.id, s]) : [],
)

const round = (n: number) => Math.round(n * 1e5) / 1e5
let requests = 0

async function geocode(q: string, country: string): Promise<Pos | null> {
  const key = country + '|' + q
  if (key in cache) return cache[key]
  await sleep(1100)
  requests++
  const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&extratags=1'
    + '&countrycodes=' + isoCountry(country) + '&q=' + encodeURIComponent(q)
  let pos: Pos | null = null
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Groundhopper-Prototype/0.1 (private project)' } })
    const json = (await res.json()) as { lat: string; lon: string; class: string; type: string; extratags?: Record<string, string> }[]
    const hit = json[0]
    if (hit) {
      const capacity = Number(hit.extratags?.capacity?.replace(/[^\d]/g, ''))
      pos = {
        lat: round(+hit.lat), lon: round(+hit.lon),
        ...(capacity >= 100 ? { capacity } : {}),
        stadium: /stadium|pitch|sports_centre|sports_hall/.test(hit.type),
      }
    }
  } catch (err) {
    console.warn('  Fehler bei', q, (err as Error).message)
    return null
  }
  cache[key] = pos
  if (requests % 10 === 0) writeFileSync(CACHE, JSON.stringify(cache, null, 0))
  return pos
}

/** Wikidata: Objekt mit dem Stadionnamen suchen, das Koordinaten hat und nah an der Stadt liegt */
async function wikidata(name: string, near: Pos | null): Promise<Pos | null> {
  const key = 'wd|' + name
  if (key in cache) return cache[key]
  const UA = { 'User-Agent': 'Groundhopper-Prototype/0.1 (private project)' }
  let pos: Pos | null = null
  try {
    await sleep(250)
    const search = await (await fetch('https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&type=item&limit=5&language=en&search='
      + encodeURIComponent(name), { headers: UA })).json() as { search?: { id: string }[] }
    const ids = (search.search ?? []).map((h) => h.id)
    if (ids.length) {
      const ents = await (await fetch('https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids='
        + ids.join('|'), { headers: UA })).json() as { entities: Record<string, { claims?: Record<string, { mainsnak: { datavalue?: { value: { latitude?: number; longitude?: number; amount?: string } } } }[]> }> }
      for (const id of ids) {
        const c = ents.entities[id]?.claims
        const coord = c?.P625?.[0]?.mainsnak.datavalue?.value
        if (coord?.latitude === undefined || coord.longitude === undefined) continue
        const cand: Pos = { lat: round(coord.latitude), lon: round(coord.longitude), stadium: true }
        if (near && km(cand, near) > MAX_DISTANCE_KM) continue
        const capacity = Number(c?.P1083?.at(-1)?.mainsnak.datavalue?.value.amount?.replace('+', ''))
        if (capacity >= 100) cand.capacity = capacity
        pos = cand
        break
      }
    }
  } catch (err) {
    console.warn('  Wikidata-Fehler bei', name, (err as Error).message)
    return null
  }
  cache[key] = pos
  return pos
}

function km(a: Pos, b: Pos): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLon = (b.lon - a.lon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

const slug = (s: string) => s
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/ß/g, 'ss')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const stadiums = new Map<string, Stadium>()
const problems: string[] = []

/** Stadion anlegen (oder vorhandenes wiederverwenden) und den Verein eintragen. */
async function add(name: string, city: string, country: string, query: string, team: StadiumTeam, venueId?: string) {
  const id = slug(name + '-' + city)
  if (!stadiums.has(id)) {
    // Ungenaue Altdaten (nur Stadt) neu versuchen – vielleicht hilft ein geänderter Suchbegriff
    const prev = previous.get(id)?.approx ? undefined : previous.get(id)
    let pos: Pos | null = prev ? { lat: prev.lat, lon: prev.lon, capacity: prev.capacity } : null
    let approx = false
    if (!prev) {
      const where = city ? (query || name) + ', ' + city : query || name
      pos = await geocode(where, country)
      // Ein Treffer, der wirklich ein Stadion/Sportplatz ist, gilt auch ohne Stadtabgleich
      if (!pos?.stadium && city) {
        const cityPos = await geocode(city, country)
        if (!pos) pos = await geocode(query || name, country)
        if (!pos || (cityPos && km(pos, cityPos) > MAX_DISTANCE_KM)) {
          pos = await wikidata(query || name, cityPos)
          if (!pos) {
            pos = cityPos
            approx = true
            problems.push(`${name} (${city}) – nur Stadt gefunden`)
          }
        }
      }
      if (!pos) {
        problems.push(`${name} (${city}) – nicht gefunden, ausgelassen`)
        return
      }
    }
    stadiums.set(id, {
      id, name, city, country, lat: pos!.lat, lon: pos!.lon, approx, teams: [],
      ...(pos!.capacity ? { capacity: pos!.capacity } : {}),
    })
    if (!prev) console.log((approx ? '~ ' : '✓ ') + name + ' (' + city + ')')
  }
  const s = stadiums.get(id)!
  s.teams.push(team)
  if (venueId && !s.espnVenues?.includes(venueId)) s.espnVenues = [...(s.espnVenues ?? []), venueId]
}

// ---------- Handgepflegte Liste ----------

const world = JSON.parse(readFileSync(new URL('world.source.json', import.meta.url), 'utf8')) as WorldSource
const crests = JSON.parse(readFileSync(new URL('../src/data/crests.json', import.meta.url), 'utf8')) as Record<string, string>

for (const [league, team, name, city, country, query, aliases] of STADIUM_SOURCE) {
  const espnId = crests[team]
  await add(name, city, country, query, { name: team, league, aliases, ...(espnId ? { espnId } : {}) })
  for (const v of world.top5Venues[team] ?? []) {
    const s = stadiums.get(slug(name + '-' + city))
    if (s && !s.espnVenues?.includes(v)) s.espnVenues = [...(s.espnVenues ?? []), v]
  }
}

// ---------- Aus ESPN erzeugte Vereine ----------

const venueToStadium = () => new Map([...stadiums.values()].flatMap((s) => (s.espnVenues ?? []).map((v) => [v, s] as const)))
let skipped = 0
for (const c of world.clubs) {
  if (!c.venue) { skipped++; continue }
  const team: StadiumTeam = { name: c.name, league: c.league, aliases: c.aliases, espnId: c.espnId, colors: c.colors, short: c.short }
  // Stadion schon bekannt (z. B. ein Top-5-Stadion, das ein Zweitligist mitnutzt)
  const known = venueToStadium().get(c.venue.id)
  if (known) {
    known.teams.push(team)
    continue
  }
  const country = ESPN_COUNTRY[c.venue.country] ?? leagueByCode(c.league).countryCode
  await add(c.venue.name, c.venue.city, country, '', team, c.venue.id)
}

writeFileSync(CACHE, JSON.stringify(cache, null, 0))

// Eine Zeile je Stadion – die Datei bleibt so lesbar und klein
const list = [...stadiums.values()]
writeFileSync(OUT, '[\n' + list.map((s) => JSON.stringify(s)).join(',\n') + '\n]\n')
console.log(`\n${list.length} Stadien, ${list.reduce((n, s) => n + s.teams.length, 0)} Vereine geschrieben (${requests} neue Abfragen).`)
if (skipped) console.log(`${skipped} Vereine ohne bekanntes Heimstadion ausgelassen.`)
if (problems.length) console.log('Ungenau:\n  ' + problems.join('\n  '))
