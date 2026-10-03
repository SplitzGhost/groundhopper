import type { MatchStatus } from '../src/shared/types.ts'

/** Versatz einer Zeitzone zu UTC in Millisekunden zum Zeitpunkt `ts`. */
function tzOffset(ts: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(ts))
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value)
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - ts
}

/** Wandelt eine Ortszeit (z. B. "2026-08-22" + "18:30" in Europe/Rome) in einen UTC-ISO-String um. */
export function localToUtc(date: string, time: string, timeZone: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  let utc = guess - tzOffset(guess, timeZone)
  // Zweiter Durchlauf fängt Sommer-/Winterzeitwechsel ab.
  utc = guess - tzOffset(utc, timeZone)
  return new Date(utc).toISOString()
}

const MATCH_DURATION_MS = 2.25 * 60 * 60 * 1000

/** Status für Quellen, die nur "beendet ja/nein" kennen. */
export function deriveStatus(kickoff: string, finished: boolean, now = Date.now()): MatchStatus {
  if (finished) return 'finished'
  const start = Date.parse(kickoff)
  if (now < start) return 'scheduled'
  if (now < start + MATCH_DURATION_MS) return 'live'
  // Anpfiff lange vorbei, aber kein Ergebnis eingetragen: als beendet ohne Ergebnis behandeln.
  return 'finished'
}
