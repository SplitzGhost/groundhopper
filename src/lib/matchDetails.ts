// Spielbericht für Sammelkarten: Torschützen, Rote Karten, Zuschauer und Schiedsrichter.
// Quelle ist die frei zugängliche ESPN-Schnittstelle (dieselbe wie bei den Wappen) – deren
// Vereins-IDs stehen schon in crests.json, darüber wird das Spiel eindeutig gefunden.

import type { LeagueCode, MatchDetails, MatchEvent, Visit } from '../shared/types.ts'
import { espnTeamId } from './crests.ts'
import { addDays } from './dates.ts'

const SLUG: Record<LeagueCode, string> = { BL1: 'ger.1', PL: 'eng.1', PD: 'esp.1', SA: 'ita.1', FL1: 'fra.1' }
const BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer'

interface EspnCompetitor { homeAway: 'home' | 'away'; score?: string; team: { id: string } }
interface EspnDetail {
  clock?: { value?: number; displayValue?: string }
  team?: { id: string }
  scoringPlay?: boolean
  redCard?: boolean
  penaltyKick?: boolean
  ownGoal?: boolean
  shootout?: boolean
  athletesInvolved?: { displayName?: string; shortName?: string }[]
}
interface EspnEvent {
  id: string
  status?: { type?: { completed?: boolean } }
  competitions: {
    attendance?: number
    venue?: { fullName?: string }
    competitors: EspnCompetitor[]
    details?: EspnDetail[]
  }[]
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(12_000) })
  if (!res.ok) throw new Error(`${res.status}`)
  return (await res.json()) as T
}

const compact = (day: string) => day.replaceAll('-', '')

async function findEvent(league: LeagueCode, day: string, homeId: string, awayId: string) {
  // ESPN ordnet Spiele nach US-Ostküstenzeit – zur Sicherheit auch die Nachbartage prüfen
  for (const d of [day, addDays(day, -1), addDays(day, 1)]) {
    const json = await getJson<{ events?: EspnEvent[] }>(`${BASE}/${SLUG[league]}/scoreboard?dates=${compact(d)}`)
    const hit = json.events?.find((e) => {
      const ids = e.competitions[0]?.competitors.map((c) => c.team.id) ?? []
      return ids.includes(homeId) && ids.includes(awayId)
    })
    if (hit) return hit
  }
  return null
}

function parseEvents(details: EspnDetail[], homeId: string): MatchEvent[] {
  return details
    .filter((d) => !d.shootout && (d.scoringPlay || d.redCard))
    .map((d): MatchEvent => {
      const person = d.athletesInvolved?.[0]
      return {
        minute: d.clock?.displayValue ?? '',
        t: d.clock?.value ?? 0,
        side: d.team?.id === homeId ? 'home' : 'away',
        kind: d.redCard ? 'red' : d.ownGoal ? 'own' : d.penaltyKick ? 'penalty' : 'goal',
        player: person?.displayName ?? person?.shortName ?? 'Unbekannt',
      }
    })
    .sort((a, b) => a.t - b.t)
}

export interface FetchedReport {
  details: MatchDetails
  score: [number, number] | null
}

/** Lädt den Spielbericht zu einem Besuch. Gibt null zurück, wenn die Quelle das Spiel nicht kennt. */
export async function fetchReport(v: Visit): Promise<FetchedReport> {
  const fetchedAt = new Date().toISOString()
  const missing: FetchedReport = {
    details: { found: false, final: false, attendance: null, referee: null, venue: null, events: [], fetchedAt },
    score: null,
  }
  if (!v.league) return missing
  const homeId = espnTeamId(v.homeTeam, v.league)
  const awayId = espnTeamId(v.awayTeam, v.league)
  if (!homeId || !awayId) return missing

  const event = await findEvent(v.league, v.date, homeId, awayId)
  if (!event) return missing
  const comp = event.competitions[0]
  const home = comp.competitors.find((c) => c.homeAway === 'home')
  const away = comp.competitors.find((c) => c.homeAway === 'away')
  // Heim/Gast laut Quelle – falls die Eintragung andersherum ist, Seiten tauschen
  const swapped = home?.team.id === awayId
  let events = parseEvents(comp.details ?? [], home?.team.id ?? homeId)
  if (swapped) events = events.map((e) => ({ ...e, side: e.side === 'home' ? 'away' : 'home' }))

  let referee: string | null = null
  let attendance = comp.attendance || null
  try {
    const summary = await getJson<{ gameInfo?: { attendance?: number; officials?: { displayName?: string; order?: number }[] } }>(
      `${BASE}/${SLUG[v.league]}/summary?event=${event.id}`)
    referee = summary.gameInfo?.officials?.find((o) => o.order === 1)?.displayName
      ?? summary.gameInfo?.officials?.[0]?.displayName ?? null
    attendance ||= summary.gameInfo?.attendance || null
  } catch {
    // Zusatzinfos sind optional
  }

  const hs = Number(home?.score)
  const as = Number(away?.score)
  const final = !!event.status?.type?.completed
  return {
    details: { found: true, final, attendance, referee, venue: comp.venue?.fullName ?? null, events, fetchedAt },
    score: final && Number.isFinite(hs) && Number.isFinite(as) ? (swapped ? [as, hs] : [hs, as]) : null,
  }
}

/** Muss (erneut) geladen werden? Nicht gefundene Spiele nur selten neu versuchen. */
export function needsReport(v: Visit, now = Date.now()): boolean {
  if (!v.league) return false
  const d = v.details
  if (!d) return true
  const age = now - new Date(d.fetchedAt).getTime()
  if (!d.found) return age > 6 * 3600_000
  return !d.final && age > 5 * 60_000
}
