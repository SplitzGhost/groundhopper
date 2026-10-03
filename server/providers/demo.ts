// Demo-Quelle ohne API-Schlüssel, zusammengesetzt aus freien Quellen:
//   Bundesliga     – OpenLigaDB (JSON, mit Wappen)
//   PL, La Liga,   – openfootball (Textdateien auf GitHub, kompletter Spielplan)
//   Serie A
//   Ligue 1        – football-data.co.uk (CSV, nur Ergebnisse + Spiele der nächsten Tage)
// Sobald ein football-data.org-Schlüssel in .env steht, wird diese Quelle nicht mehr genutzt.

import type { LeagueCode, Match, TeamRef } from '../../src/shared/types.ts'
import { matchTeam } from '../stadiums.ts'
import { deriveStatus, localToUtc } from '../time.ts'
import { fetchJson, fetchText, type LeagueResult, type Provider } from './types.ts'

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function plainTeam(name: string, league: LeagueCode): TeamRef {
  const canonical = matchTeam(name, league)?.team
  return { id: 'name-' + slug(canonical ?? name), name: canonical ?? name, shortName: name, crest: null }
}

function buildMatch(
  id: string, league: LeagueCode, season: number, matchday: number | null, kickoff: string,
  home: TeamRef, away: TeamRef, ft: [number, number] | null, ht: [number, number] | null, finished: boolean,
): Match {
  return {
    id, league, season, matchday, kickoff,
    status: deriveStatus(kickoff, finished),
    home, away,
    score: { home: ft?.[0] ?? null, away: ft?.[1] ?? null, halfTimeHome: ht?.[0] ?? null, halfTimeAway: ht?.[1] ?? null },
    stadiumId: matchTeam(home.name, league)?.stadiumId ?? null,
  }
}

// ---------- OpenLigaDB (auch für 3. Liga und Regionalligen) ----------

interface OldbTeam { teamId: number; teamName: string; shortName: string; teamIconUrl: string | null }
interface OldbMatch {
  matchID: number
  matchDateTimeUTC: string
  matchIsFinished: boolean
  group: { groupOrderID: number } | null
  team1: OldbTeam
  team2: OldbTeam
  matchResults: { resultTypeID: number; pointsTeam1: number; pointsTeam2: number }[]
}

export async function openLigaDb(league: LeagueCode, shortcut: string, season: number): Promise<LeagueResult> {
  const data = await fetchJson<OldbMatch[]>(`https://api.openligadb.de/getmatchdata/${shortcut}/${season}`)
  const team = (t: OldbTeam): TeamRef => ({
    id: 'oldb-' + t.teamId,
    name: matchTeam(t.teamName, league)?.team ?? t.teamName,
    shortName: t.shortName || t.teamName,
    crest: t.teamIconUrl,
  })
  const matches = data.map((m) => {
    const result = (type: number): [number, number] | null => {
      const r = m.matchResults.find((x) => x.resultTypeID === type)
      return r ? [r.pointsTeam1, r.pointsTeam2] : null
    }
    return buildMatch(
      'oldb-' + m.matchID, league, season, m.group?.groupOrderID ?? null, m.matchDateTimeUTC,
      team(m.team1), team(m.team2), result(2), result(1), m.matchIsFinished,
    )
  })
  return { matches, warnings: [] }
}

// ---------- openfootball ----------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DATE_LINE = /^\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+([A-Z][a-z]{2})\s+(\d{1,2})(?:\s+(\d{4}))?\s*$/
const MATCH_LINE = /^\s+(?:(\d{1,2}:\d{2})\s+)?(.+?)\s+v\s+(.+?)(?:\s{2,}(\d+)-(\d+)(?:\s+\((\d+)-(\d+)\))?)?\s*$/
const MATCHDAY_LINE = /Matchday\s+(\d+)/

/** Parst das openfootball-Textformat (Ortszeiten) in Spiele. */
export function parseOpenFootball(text: string, league: LeagueCode, season: number, timeZone: string): Match[] {
  const matches: Match[] = []
  let matchday: number | null = null
  let year = season
  let date: string | null = null
  let time = '15:00'

  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('#') || line.startsWith('=')) continue
    const md = MATCHDAY_LINE.exec(line)
    if (md) { matchday = Number(md[1]); continue }
    const d = DATE_LINE.exec(line)
    if (d) {
      if (d[3]) year = Number(d[3])
      const month = MONTHS.indexOf(d[1]) + 1
      date = `${year}-${String(month).padStart(2, '0')}-${d[2].padStart(2, '0')}`
      continue
    }
    const m = MATCH_LINE.exec(line)
    if (!m || !date) continue
    if (m[1]) time = m[1]
    const home = plainTeam(m[2], league)
    const away = plainTeam(m[3], league)
    const ft: [number, number] | null = m[4] ? [Number(m[4]), Number(m[5])] : null
    const ht: [number, number] | null = m[6] ? [Number(m[6]), Number(m[7])] : null
    matches.push(buildMatch(
      `of-${league}-${date}-${home.id}`, league, season, matchday,
      localToUtc(date, time, timeZone), home, away, ft, ht, ft !== null,
    ))
  }
  return matches
}

const OPENFOOTBALL: Partial<Record<LeagueCode, { repo: string; file: string; tz: string }>> = {
  PL: { repo: 'england', file: '1-premierleague.txt', tz: 'Europe/London' },
  PD: { repo: 'espana', file: '1-liga.txt', tz: 'Europe/Madrid' },
  SA: { repo: 'italy', file: '1-seriea.txt', tz: 'Europe/Rome' },
}

async function openFootball(league: LeagueCode, season: number): Promise<LeagueResult> {
  const src = OPENFOOTBALL[league]!
  const folder = `${season}-${String((season + 1) % 100).padStart(2, '0')}`
  const text = await fetchText(`https://raw.githubusercontent.com/openfootball/${src.repo}/master/${folder}/${src.file}`)
  return { matches: parseOpenFootball(text, league, season, src.tz), warnings: [] }
}

// ---------- football-data.co.uk (CSV) ----------

function parseCsv(text: string): Record<string, string>[] {
  const [head, ...rows] = text.replace(/^﻿/, '').split(/\r?\n/).filter(Boolean)
  const cols = head.split(',')
  return rows.map((r) => {
    const cells = r.split(',')
    return Object.fromEntries(cols.map((c, i) => [c, cells[i] ?? '']))
  })
}

async function footballDataCoUk(league: LeagueCode, division: string, season: number): Promise<LeagueResult> {
  const code = String(season % 100).padStart(2, '0') + String((season + 1) % 100).padStart(2, '0')
  const [results, fixtures] = await Promise.all([
    fetchText(`https://www.football-data.co.uk/mmz4281/${code}/${division}.csv`),
    fetchText('https://www.football-data.co.uk/fixtures.csv').catch(() => ''),
  ])
  const rows = [...parseCsv(results), ...(fixtures ? parseCsv(fixtures) : [])].filter((r) => r.Div === division)
  const seen = new Set<string>()
  const matches: Match[] = []
  for (const r of rows) {
    const [dd, mm, yyyy] = r.Date.split('/')
    const date = `${yyyy.length === 2 ? '20' + yyyy : yyyy}-${mm}-${dd}`
    const home = plainTeam(r.HomeTeam, league)
    const away = plainTeam(r.AwayTeam, league)
    const id = `fdcouk-${league}-${date}-${home.id}`
    if (seen.has(id)) continue
    seen.add(id)
    const ft: [number, number] | null = r.FTHG !== '' && r.FTHG !== undefined ? [Number(r.FTHG), Number(r.FTAG)] : null
    const ht: [number, number] | null = r.HTHG ? [Number(r.HTHG), Number(r.HTAG)] : null
    // Zeiten in den CSV-Dateien sind britische Ortszeit.
    matches.push(buildMatch(id, league, season, null, localToUtc(date, r.Time || '15:00', 'Europe/London'),
      home, away, ft, ht, ft !== null))
  }
  return {
    matches,
    warnings: ['Ligue 1 im Demo-Modus: nur bisherige Ergebnisse und Spiele der nächsten Tage, kein kompletter Spielplan.'],
  }
}

// ---------- Zusammenführung ----------

export const demoProvider: Provider = {
  name: 'demo',
  fetchLeague(league, season) {
    switch (league) {
      case 'BL1': return openLigaDb(league, 'bl1', season)
      case 'FL1': return footballDataCoUk(league, 'F1', season)
      default: return openFootball(league, season)
    }
  },
}
