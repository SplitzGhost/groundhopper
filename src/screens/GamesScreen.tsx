// Spiele: Spielplan Tag für Tag, nach Ligen getrennt. Wischen nach rechts zeigt den Vortag,
// nach links den nächsten Tag; Wochenleiste und Kalender springen direkt zu einem Datum.
// Die Merkliste öffnet sich über den Stern oben rechts.

import { forwardRef, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { AnimatePresence, animate, motion, useMotionValue, type PanInfo } from 'motion/react'
import { ArrowRight, CalendarDays, Plus, Search, Star, X } from 'lucide-react'
import type { Match } from '../shared/types.ts'
import { LEAGUES } from '../shared/leagues.ts'
import { normalizeTeamName } from '../shared/teamMatch.ts'
import { addDays, formatDayLong, formatDayMedium, keyToDate, localDateKey, relativeDay } from '../lib/dates.ts'
import { stadiumById } from '../lib/stadiums.ts'
import { leagueLogo } from '../lib/crests.ts'
import { useMatches } from '../state/matches.ts'
import { toggleMatchVisit, toggleWatch, useUserData } from '../state/userData.ts'
import { gamesDayStore, openSheet } from '../state/ui.ts'
import { ScreenScaffold } from '../components/ScreenScaffold.tsx'
import { MatchRow } from '../components/MatchRow.tsx'
import { hasStarted } from '../lib/matchState.ts'
import { Empty, GlassButton, PillButton } from '../components/ui.tsx'
import { ProfileButton } from '../components/ProfileButton.tsx'
import { Flag } from '../components/Flag.tsx'
import { softSpring } from '../lib/motion.ts'
import { BallIcon } from '../components/icons.tsx'

const norm = (s: string) => normalizeTeamName(s) || s.toLowerCase()

const monthFmt = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' })
const weekdayFmt = new Intl.DateTimeFormat('de-DE', { weekday: 'short' })

/** Montag der Woche eines Tages */
function weekStart(day: string) {
  const d = keyToDate(day)
  return addDays(day, -((d.getDay() + 6) % 7))
}

export function GamesScreen() {
  const matches = useMatches()
  const data = useUserData()
  const [query, setQuery] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const today = localDateKey()
  const day = gamesDayStore.use() ?? today

  const visitedIds = useMemo(() => new Set(data.visits.map((v) => v.matchId).filter(Boolean)), [data.visits])
  const watchIds = useMemo(() => new Set(data.watchlist), [data.watchlist])

  const q = query.trim() ? norm(query.trim()) : ''
  const matchesFilter = useCallback((m: Match) => {
    if (!q) return true
    const s = stadiumById(m.stadiumId)
    return [m.home.name, m.away.name, m.home.shortName, m.away.shortName, s?.name ?? '', s?.city ?? '']
      .some((t) => norm(t).includes(q))
  }, [q])

  // Stern oben zählt die noch anstehenden gemerkten Spiele
  const upcomingWatched = data.watchlist.filter((id) => {
    const m = matches.byId.get(id)
    return m && !hasStarted(m)
  }).length

  const dayMatches = useCallback((d: string) => (matches.byDay.get(d) ?? []).filter(matchesFilter), [matches.byDay, matchesFilter])

  // Beim Tageswechsel nach oben, falls weit unten gescrollt – die Tagesleiste bleibt oben stehen
  useEffect(() => {
    const s = scrollRef.current
    const bar = barRef.current
    if (!s || !bar) return
    const top = bar.offsetTop - 46
    if (s.scrollTop > top) s.scrollTo({ top, behavior: 'smooth' })
  }, [day])

  // ---------- Handler ----------

  const open = useCallback((m: Match) => openSheet({ kind: 'match', id: m.id }), [])
  const onVisit = useCallback((m: Match) => toggleMatchVisit(m), [])
  const onWatch = useCallback((m: Match) => toggleWatch(m.id), [])

  const row = (m: Match) => (
    <MatchRow key={m.id} match={m} visited={visitedIds.has(m.id)} watched={watchIds.has(m.id)}
      onOpen={open} onToggleVisit={onVisit} onToggleWatch={onWatch} />
  )

  // ---------- Suche über die ganze Saison ----------

  const searchDays = useMemo(() => !q ? [] : [...matches.byDay.entries()]
    .map(([d, list]) => [d, list.filter(matchesFilter)] as const)
    .filter(([, list]) => list.length)
    .sort(([a], [b]) => a.localeCompare(b)), [matches.byDay, q, matchesFilter])

  return (
    <ScreenScaffold
      ref={scrollRef}
      title="Spiele"
      actions={<>
        <GlassButton label="Merkliste" badge={upcomingWatched || null}
          icon={<Star size={21} strokeWidth={2.2} />} onClick={() => openSheet({ kind: 'watchlist' })} />
        <GlassButton label="Spiel manuell eintragen" icon={<Plus size={22} strokeWidth={2.4} />} onClick={() => openSheet({ kind: 'add' })} />
        <ProfileButton />
      </>}
    >
      <div style={{ padding: '0 16px 6px' }}>
        <label className="search-field">
          <Search size={18} strokeWidth={2.4} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Verein oder Stadion suchen"
            enterKeyHint="search" autoCorrect="off" spellCheck={false} />
          {query && (
            <motion.button type="button" aria-label="Suche leeren" onClick={() => setQuery('')}
              initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ display: 'grid', color: 'var(--text-3)' }}>
              <X size={18} strokeWidth={2.6} />
            </motion.button>
          )}
        </label>
      </div>

      <motion.div key={q ? 'search' : 'plan'} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={softSpring}>
        {matches.status === 'loading' ? <LoadingList /> :
          matches.status === 'error' ? <Empty title="Spielplan nicht erreichbar" text={matches.error ?? undefined} /> :
          q ? (
            searchDays.length === 0 ? <Empty icon={<Search size={30} />} title="Nichts gefunden" text="Versuch es mit einem anderen Vereinsnamen." /> :
            searchDays.map(([d, list]) => (
              <section key={d} className="day-group">
                <div className="day-head">
                  <span>{relativeDay(d) ? `${relativeDay(d)}, ` : ''}{formatDayLong(d)}</span>
                  <button type="button" className="section-link" onClick={() => { setQuery(''); gamesDayStore.set(d) }}>Ganzer Tag</button>
                </div>
                <div className="card inset list">{list.map(row)}</div>
              </section>
            ))
          ) : (
            <>
              <DayBar ref={barRef} day={day} today={today} count={(d) => dayMatches(d).length} />
              <DayPager day={day} onChange={(d) => gamesDayStore.set(d)}
                render={(d) => <DayContent day={d} today={today} list={dayMatches(d)} row={row}
                  findNext={() => nextMatchDay(matches.byDay, d, matchesFilter)} />} />
            </>
          )}
      </motion.div>
    </ScreenScaffold>
  )
}

/** Nächster Tag mit Spielen (sonst der letzte davor) */
function nextMatchDay(byDay: Map<string, Match[]>, from: string, filter: (m: Match) => boolean) {
  const days = [...byDay.keys()].filter((d) => byDay.get(d)!.some(filter)).sort()
  return days.find((d) => d > from) ?? days.reverse().find((d) => d < from) ?? null
}

// ---------- Tagesleiste: Monat, Woche, Kalender ----------

const DayBar = forwardRef<HTMLDivElement, { day: string; today: string; count: (d: string) => number }>(
  function DayBar({ day, today, count }, ref) {
    const start = weekStart(day)
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
    // Richtung des Wochenwechsels für die Schiebe-Animation
    const [shownStart, setShownStart] = useState(start)
    const [dir, setDir] = useState(0)
    if (shownStart !== start) {
      setDir(start > shownStart ? 1 : -1)
      setShownStart(start)
    }

    return (
      <div className="daybar" ref={ref}>
        <div className="daybar-top">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.b key={day.slice(0, 7)} className="daybar-month"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={softSpring}>
              {monthFmt.format(keyToDate(day))}
            </motion.b>
          </AnimatePresence>
          <div className="daybar-actions">
            <AnimatePresence>
              {day !== today && (
                <motion.button key="today" type="button" className="today-btn"
                  initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  onClick={() => gamesDayStore.set(today)}>Heute</motion.button>
              )}
            </AnimatePresence>
            <GlassButton small label="Datum wählen" icon={<CalendarDays size={18} strokeWidth={2.4} />} onClick={() => openSheet({ kind: 'calendar' })} />
          </div>
        </div>
        <div className="week-viewport">
          <AnimatePresence mode="popLayout" initial={false} custom={dir}>
            <motion.div key={start} className="week" custom={dir}
              initial={{ opacity: 0, x: dir * 70 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -70 }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}>
              {days.map((d) => {
                const n = count(d)
                const on = d === day
                return (
                  <button key={d} type="button" className={`week-day ${on ? 'on' : ''} ${d === today ? 'today' : ''} ${n ? 'has' : ''}`}
                    onClick={() => gamesDayStore.set(d)} aria-label={`${formatDayLong(d)}, ${n} Spiele`}>
                    <span className="week-wd">{weekdayFmt.format(keyToDate(d)).replace('.', '')}</span>
                    <span className="week-num tnum">
                      {on && <motion.span layoutId="week-sel" className="week-sel" transition={{ type: 'spring', stiffness: 480, damping: 36 }} />}
                      <span>{Number(d.slice(8))}</span>
                    </span>
                    <i className="week-dot" />
                  </button>
                )
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    )
  },
)

// ---------- Tagesseiten zum Wischen ----------

function DayPager({ day, onChange, render }: { day: string; onChange: (d: string) => void; render: (d: string) => ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  // Per Wischen erreichter Tag (steht schon an Ort und Stelle) bzw. Richtung bei Sprüngen über Wochenleiste/Kalender
  const [swipedTo, setSwipedTo] = useState<string | null>(null)
  const [shown, setShown] = useState(day)
  const [jumpDir, setJumpDir] = useState(0)
  if (shown !== day) {
    setJumpDir(day > shown ? 1 : -1)
    setShown(day)
  }

  const go = (dir: 1 | -1, velocity = 0) => {
    const w = ref.current?.clientWidth ?? 390
    void animate(x, -dir * w, { type: 'spring', stiffness: 300, damping: 34, velocity }).then(() => {
      const target = addDays(day, dir)
      flushSync(() => {
        setSwipedTo(target)
        onChange(target)
      })
      x.jump(0)
    })
  }

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const w = ref.current?.clientWidth ?? 390
    if (info.offset.x < -w * 0.22 || info.velocity.x < -450) go(1, info.velocity.x)
    else if (info.offset.x > w * 0.22 || info.velocity.x > 450) go(-1, info.velocity.x)
    else void animate(x, 0, { type: 'spring', stiffness: 420, damping: 36 })
  }

  return (
    <div className="pager" ref={ref}>
      <motion.div className="pager-track" style={{ x }} drag="x" dragDirectionLock dragMomentum={false} onDragEnd={onDragEnd}>
        <div className="pager-side prev" aria-hidden>{render(addDays(day, -1))}</div>
        <motion.div key={day} className="pager-page"
          initial={swipedTo === day || !jumpDir ? false : { opacity: 0, x: jumpDir * 40 }}
          animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 34 }}>
          {render(day)}
        </motion.div>
        <div className="pager-side next" aria-hidden>{render(addDays(day, 1))}</div>
      </motion.div>
    </div>
  )
}

function DayContent({ day, today, list, row, findNext }: {
  day: string
  today: string
  list: Match[]
  row: (m: Match) => ReactNode
  findNext: () => string | null
}) {
  const groups = LEAGUES.map((l) => ({ league: l, matches: list.filter((m) => m.league === l.code).sort((a, b) => a.kickoff.localeCompare(b.kickoff)) }))
    .filter((g) => g.matches.length)
  const rel = relativeDay(day, today)

  return (
    <div className="day-page">
      <div className="day-title">
        <div>
          <b>{rel ?? formatDayLong(day).split(',')[0]}</b>
          <span>{rel ? formatDayLong(day) : formatDayLong(day).split(', ')[1]}</span>
        </div>
        <span className="day-count tnum">{list.length ? `${list.length} ${list.length === 1 ? 'Spiel' : 'Spiele'}` : 'spielfrei'}</span>
      </div>

      {groups.length === 0 ? (
        <NoGames findNext={findNext} />
      ) : groups.map((g) => {
        const md = g.matches.find((m) => m.matchday)?.matchday
        return (
          <section key={g.league.code} className="lg-sec">
            <div className="lg-head">
              <span className="lg-logo"><img src={leagueLogo(g.league.code)} alt="" draggable={false} /></span>
              <b>{g.league.name}</b>
              <Flag code={g.league.countryCode} size={10} />
              {md && <span className="lg-md">{md}. Spieltag</span>}
            </div>
            <div className="card inset list">{g.matches.map((m) => row(m))}</div>
          </section>
        )
      })}
    </div>
  )
}

function NoGames({ findNext }: { findNext: () => string | null }) {
  const next = findNext()
  return (
    <div className="no-games">
      <span className="no-games-icon"><BallIcon size={30} /></span>
      <b>Keine Spiele an diesem Tag</b>
      <p>Wische weiter oder spring direkt zum nächsten Spieltag.</p>
      {next && (
        <PillButton small tint onClick={() => gamesDayStore.set(next)}>
          {formatDayMedium(next)} <ArrowRight size={15} strokeWidth={2.6} />
        </PillButton>
      )}
    </div>
  )
}

function LoadingList() {
  return (
    <div style={{ padding: '14px 16px', display: 'grid', gap: 10 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="skeleton" style={{ height: 86, borderRadius: 22, animationDelay: `${i * 0.1}s` }} />
      ))}
    </div>
  )
}
