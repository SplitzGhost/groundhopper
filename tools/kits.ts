// Heimtrikots der Top-5-Ligen je Saison für die Hopper – Rohdaten aus der englischen Wikipedia.
//
// 1. Vereine je Saison aus den Ligaartikeln („2023–24 Bundesliga“ usw.)
// 2. Trikot-Parameter (Farben + Musterbilder) aus der Vereins-Infobox, so wie der Artikel mitten in
//    der Saison aussah (15. Januar), für die laufende Saison der aktuelle Stand
// 3. Musterbilder (Kit_body…, Kit_left_arm…) herunterladen
//
// Alles landet in .cache/kits/ – tools/kits-build.ts macht daraus src/data/kits.json.
// Aufruf: npm run kits   (erneuter Aufruf lädt nur, was noch fehlt)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { Stadium } from '../src/shared/types.ts'
import { createTeamMatcher } from '../src/shared/teamMatch.ts'

const FIRST = 2022
const CURRENT = 2026
const DIR = new URL('../.cache/kits/', import.meta.url)
const IMG = new URL('img/', DIR)
mkdirSync(IMG, { recursive: true })

const UA = { 'User-Agent': 'groundhopper-kits/1.0 (https://github.com/SplitzGhost/groundhopper; kit colours for cartoon avatars)', 'Api-User-Agent': 'groundhopper-kits/1.0 (https://github.com/SplitzGhost/groundhopper)' }
const API = 'https://en.wikipedia.org/w/api.php'

const LEAGUES: [code: string, wiki: string][] = [
  ['BL1', 'Bundesliga'],
  ['PL', 'Premier League'],
  ['PD', 'La Liga'],
  ['SA', 'Serie A'],
  ['FL1', 'Ligue 1'],
]

const stadiums = JSON.parse(readFileSync(new URL('../src/data/stadiums.json', import.meta.url), 'utf8')) as Stadium[]
const match = createTeamMatcher(stadiums)

/** Von Hand: Wikipedia-Titel → Vereinsname in der App, wo der Abgleich nicht greift */
const MANUAL: Record<string, string> = {
  'Hertha BSC': 'Hertha Berlin',
  'U.S. Salernitana 1919': 'Salernitana',
  'US Salernitana 1919': 'Salernitana',
  'Spezia Calcio': 'Spezia',
  'AC Ajaccio': 'AC Ajaccio',
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** Höflich bleiben: etwa eine Anfrage pro Sekunde (Wikipedia drosselt sonst mit 429) */
const slots = new Map<string, number>()
/** Abstand je Server: die API drosselt stark, der Bildserver kaum */
async function throttle(host: string) {
  const gap = host === 'upload.wikimedia.org' ? 120 : 1000
  const now = Date.now()
  const next = slots.get(host) ?? 0
  const wait = Math.max(0, next - now)
  slots.set(host, Math.max(now, next) + gap)
  if (wait) await sleep(wait)
}

async function get(url: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    await throttle(new URL(url).host)
    const res = await fetch(url, { headers: UA })
    if (res.ok) return res
    if (attempt >= 6 || (res.status !== 429 && res.status < 500)) throw new Error(`${res.status} ${url}`)
    const after = Number(res.headers.get('retry-after')) || 5 * (attempt + 1)
    console.warn(`${res.status}, warte ${after} s`)
    await sleep(after * 1000)
  }
}

async function api(params: Record<string, string>): Promise<any> {
  return (await get(`${API}?${new URLSearchParams({ format: 'json', formatversion: '2', maxlag: '5', ...params })}`)).json()
}

/** `lead`: nur der Kopfteil des Artikels (dort steht die Infobox) */
async function wikitext(title: string, before?: string, lead = false): Promise<{ title: string; text: string; ts: string } | null> {
  const j = await api({
    action: 'query', prop: 'revisions', titles: title, redirects: '1', rvlimit: '1', rvslots: 'main',
    rvprop: 'content|timestamp', ...(before ? { rvstart: before, rvdir: 'older' } : {}), ...(lead ? { rvsection: '0' } : {}),
  })
  const page = j.query.pages[0]
  const rev = page?.revisions?.[0]
  return rev ? { title: page.title, text: rev.slots.main.content, ts: rev.timestamp } : null
}

const seasonTitle = (s: number, league: string) => `${s}–${String((s + 1) % 100).padStart(2, '0')} ${league}`

/** Vereinslinks aus der Stadion-Tabelle im Abschnitt „Teams“ */
function teamLinks(text: string): { target: string; label: string }[] {
  const start = text.search(/^==\s*Teams\s*==/m)
  const body = start >= 0 ? text.slice(start) : text
  const tables = body.split(/\n\{\|/).slice(1).map((t) => t.split(/\n\|\}/)[0])
  for (const t of tables) {
    const rows = t.split(/\n\|-/).slice(1)
    const links = rows.map((r) => {
      const m = r.match(/\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/)
      return m ? { target: m[1].trim(), label: (m[2] ?? m[1]).trim() } : null
    }).filter((x): x is { target: string; label: string } => !!x)
    if (links.length >= 16) return links
  }
  return []
}

interface ClubEntry {
  /** Name in der App */
  club: string
  wiki: string
  league: string
  seasons: number[]
}

const clubsFile = new URL('clubs.json', DIR)
let clubs: Record<string, ClubEntry> = existsSync(clubsFile) ? JSON.parse(readFileSync(clubsFile, 'utf8')) : {}

if (!Object.keys(clubs).length) {
  const unmatched: string[] = []
  const leaguesFile = new URL('leagues.json', DIR)
  const cached: Record<string, { target: string; label: string }[]> = existsSync(leaguesFile) ? JSON.parse(readFileSync(leaguesFile, 'utf8')) : {}
  for (const [code, wiki] of LEAGUES) {
    for (let s = FIRST; s <= CURRENT; s++) {
      const title = seasonTitle(s, wiki)
      if (!cached[title]) {
        const page = await wikitext(title)
        if (!page) { console.warn('fehlt:', title); continue }
        cached[title] = teamLinks(page.text)
        writeFileSync(leaguesFile, JSON.stringify(cached, null, 1))
      }
      const links = cached[title]
      console.log(title, links.length)
      for (const l of links) {
        const name = MANUAL[l.target] ?? match(l.label, code)?.team ?? match(l.target, code)?.team
        if (!name) { unmatched.push(`${code} ${s}: ${l.target} (${l.label})`); continue }
        clubs[name] ??= { club: name, wiki: l.target, league: code, seasons: [] }
        if (!clubs[name].seasons.includes(s)) clubs[name].seasons.push(s)
      }
    }
  }
  if (unmatched.length) console.warn('Ohne Zuordnung (bitte in MANUAL eintragen):\n' + unmatched.join('\n'))
  writeFileSync(clubsFile, JSON.stringify(clubs, null, 2))
}

// ---------- Trikot-Parameter ----------

export interface RawKit {
  club: string
  season: number
  /** Stand des Artikels */
  ts: string
  params: Record<string, string>
}

const kitsFile = new URL('raw.json', DIR)
const raw: Record<string, RawKit> = existsSync(kitsFile) ? JSON.parse(readFileSync(kitsFile, 'utf8')) : {}

const KEYS = ['pattern_la1', 'pattern_b1', 'pattern_ra1', 'pattern_sh1', 'leftarm1', 'body1', 'rightarm1', 'shorts1', 'socks1']

function kitParams(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const k of KEYS) {
    const m = text.match(new RegExp(`\\|\\s*${k}\\s*=\\s*([^|\\n}]*)`))
    if (m) out[k] = m[1].replace(/<!--.*?-->/g, '').trim()
  }
  return out
}

const jobs: [ClubEntry, number][] = []
for (const c of Object.values(clubs)) {
  // Alle Saisons ab FIRST – auch Jahre in der 2. Liga, falls jemand dort war
  for (let s = FIRST; s <= CURRENT; s++) if (!raw[`${c.club}|${s}`]) jobs.push([c, s])
}

let done = 0
async function worker() {
  for (;;) {
    const job = jobs.shift()
    if (!job) return
    const [c, s] = job
    const page = await wikitext(c.wiki, s === CURRENT ? undefined : `${s + 1}-01-15T00:00:00Z`, true)
    if (page) raw[`${c.club}|${s}`] = { club: c.club, season: s, ts: page.ts, params: kitParams(page.text) }
    if (++done % 10 === 0) {
      console.log(`${done} Trikots …`)
      writeFileSync(kitsFile, JSON.stringify(raw))
    }
  }
}
await worker()
writeFileSync(kitsFile, JSON.stringify(raw))

// ---------- Musterbilder ----------

const files = new Set<string>()
for (const k of Object.values(raw)) {
  const p = k.params
  if (p.pattern_b1) files.add(`Kit_body${p.pattern_b1}.png`)
  if (p.pattern_la1) files.add(`Kit_left_arm${p.pattern_la1}.png`)
}
const missing = [...files].filter((f) => !existsSync(new URL(f.replace(/[^\w.-]/g, '_'), IMG)) && !existsSync(new URL(f.replace(/[^\w.-]/g, '_') + '.none', IMG)))
console.log(`${files.size} Musterbilder, ${missing.length} fehlen`)
for (let i = 0; i < missing.length; i += 50) {
  const batch = missing.slice(i, i + 50)
  const j = await api({ action: 'query', prop: 'imageinfo', iiprop: 'url', titles: batch.map((f) => 'File:' + f).join('|') })
  const norm = new Map<string, string>((j.query.normalized ?? []).map((n: { from: string; to: string }) => [n.to, n.from]))
  for (const page of j.query.pages) {
    const name = (norm.get(page.title) ?? page.title).replace(/^File:/, '').replace(/ /g, '_')
    const local = new URL(name.replace(/[^\w.-]/g, '_'), IMG)
    const url = page.imageinfo?.[0]?.url
    if (!url) { writeFileSync(new URL(name.replace(/[^\w.-]/g, '_') + '.none', IMG), ''); continue }
    const res = await get(url).catch(() => null)
    if (res) writeFileSync(local, Buffer.from(await res.arrayBuffer()))
  }
  console.log(`Bilder ${Math.min(i + 50, missing.length)}/${missing.length}`)
}
console.log('fertig')
