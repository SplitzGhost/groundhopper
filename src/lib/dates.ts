// Datumshilfen – alles in der Ortszeit des Geräts.

/** YYYY-MM-DD des Geräts für einen Zeitpunkt. */
export function localDateKey(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  return localDateKey(new Date(y, m - 1, d + days))
}

/** Datum-Schlüssel als Date (Mitternacht Ortszeit). */
export function keyToDate(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const dayFormat = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
const timeFormat = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' })
const longFormat = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
const mediumFormat = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })
const weekdayShort = new Intl.DateTimeFormat('de-DE', { weekday: 'short' })

export const formatDay = (iso: string) => dayFormat.format(new Date(iso))
export const formatTime = (iso: string) => timeFormat.format(new Date(iso))

/** „Heute“, „Morgen“, „Gestern“ oder null */
export function relativeDay(dateKey: string, today = localDateKey()): string | null {
  if (dateKey === today) return 'Heute'
  if (dateKey === addDays(today, 1)) return 'Morgen'
  if (dateKey === addDays(today, -1)) return 'Gestern'
  return null
}

/** „Samstag, 10. Oktober“ */
export const formatDayLong = (dateKey: string) => longFormat.format(keyToDate(dateKey))

/** „Sa., 10. Okt.“ */
export const formatDayMedium = (dateKey: string) => mediumFormat.format(keyToDate(dateKey))

/** Kurz für Chips: „Fr 9.“ */
export function formatChip(dateKey: string): string {
  const d = keyToDate(dateKey)
  return `${weekdayShort.format(d).replace('.', '')} ${d.getDate()}.`
}

/** „Heute“ / „Morgen“ / „Sa., 10. Okt.“ */
export const formatDayFriendly = (dateKey: string) => relativeDay(dateKey) ?? formatDayMedium(dateKey)

/** „gerade eben“, „vor 5 Min.“, „vor 3 Std.“, „gestern“, „vor 4 Tagen“, sonst das Datum */
export function timeAgo(iso: string, now = Date.now()): string {
  const min = Math.round((now - new Date(iso).getTime()) / 60_000)
  if (min < 1) return 'gerade eben'
  if (min < 60) return `vor ${min} Min.`
  const h = Math.round(min / 60)
  if (h < 24) return `vor ${h} Std.`
  const days = Math.round(h / 24)
  if (days === 1) return 'gestern'
  if (days < 7) return `vor ${days} Tagen`
  return formatDayMedium(localDateKey(iso))
}
