// Erzeugt src/data/stadiums.json aus tools/stadiums.source.ts.
// Aufruf: npm run stadiums
// Nutzt OpenStreetMap Nominatim (max. 1 Anfrage pro Sekunde laut Nutzungsrichtlinie).

import { writeFileSync } from 'node:fs'
import { STADIUM_SOURCE } from './stadiums.source.ts'
import type { Stadium } from '../src/shared/types.ts'

const OUT = new URL('../src/data/stadiums.json', import.meta.url)
const MAX_DISTANCE_KM = 30

interface Pos { lat: number; lon: number }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const cache = new Map<string, Pos | null>()

async function geocode(q: string, country: string): Promise<Pos | null> {
  const key = country + '|' + q
  if (cache.has(key)) return cache.get(key)!
  await sleep(1100)
  const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1'
    + '&countrycodes=' + country + '&q=' + encodeURIComponent(q)
  const res = await fetch(url, { headers: { 'User-Agent': 'Groundhopper-Prototype/0.1 (private project)' } })
  const json = (await res.json()) as { lat: string; lon: string }[]
  const pos = json[0] ? { lat: round(+json[0].lat), lon: round(+json[0].lon) } : null
  cache.set(key, pos)
  return pos
}

const round = (n: number) => Math.round(n * 1e5) / 1e5

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

for (const [league, team, name, city, country, query, aliases] of STADIUM_SOURCE) {
  const id = slug(name + '-' + city)
  if (!stadiums.has(id)) {
    const cityPos = await geocode(city, country)
    let pos = await geocode((query || name) + ', ' + city, country)
    if (!pos) pos = await geocode(query || name, country)
    let approx = false
    if (!pos || (cityPos && km(pos, cityPos) > MAX_DISTANCE_KM)) {
      pos = cityPos
      approx = true
      problems.push(`${name} (${city}) – nur Stadt gefunden`)
    }
    if (!pos) throw new Error(`Kein Ort gefunden für ${name}, ${city}`)
    stadiums.set(id, { id, name, city, country, lat: pos.lat, lon: pos.lon, approx, teams: [] })
    console.log((approx ? '~ ' : '✓ ') + name + ' (' + city + ')')
  }
  stadiums.get(id)!.teams.push({ name: team, league, aliases })
}

writeFileSync(OUT, JSON.stringify([...stadiums.values()], null, 2) + '\n')
console.log(`\n${stadiums.size} Stadien geschrieben.`)
if (problems.length) console.log('Ungenau:\n  ' + problems.join('\n  '))
