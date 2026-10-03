// Spiele: kompletter Spielplan zum Durchsuchen und Abhaken, Merkliste und besuchte Spiele.

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { ChevronUp, Plus, Search, Star, X } from 'lucide-react'
import type { LeagueCode, Match } from '../shared/types.ts'
import { LEAGUES } from '../shared/leagues.ts'
import { normalizeTeamName } from '../shared/teamMatch.ts'
import { addDays, formatDayFriendly, formatDayLong, localDateKey, relativeDay } from '../lib/dates.ts'
import { stadiumById } from '../lib/stadiums.ts'
import { useMatches } from '../state/matches.ts'
import { toggleMatchVisit, toggleWatch, useUserData } from '../state/userData.ts'
import { openSheet } from '../state/ui.ts'
import { ScreenScaffold } from '../components/ScreenScaffold.tsx'
import { MatchRow, VisitRow } from '../components/MatchRow.tsx'
import { hasStarted } from '../lib/matchState.ts'
import { Chip, Empty, GlassButton, PillButton, Segmented } from '../components/ui.tsx'
import { ProfileButton } from '../components/ProfileButton.tsx'
import { Flag } from '../components/Flag.tsx'
import { softSpring } from '../lib/motion.ts'
import { BallIcon } from '../components/icons.tsx'

type Mode = 'plan' | 'watch' | 'visited'

const norm = (s: string) => normalizeTeamName(s) || s.toLowerCase()

/** Scrollposition, bei der ein Tag knapp unter der Navigationsleiste steht.
 *  offsetTop wird über alle Zwischen-Elemente aufsummiert: während der Einblend-Animation
 *  zählt Chrome die animierte Liste als Bezugselement. */
function dayOffset(scroller: HTMLElement, el: HTMLElement): number {
  let y = 0
  for (let n: HTMLElement | null = el; n && n !== scroller; n = n.offsetParent as HTMLElement | null) y += n.offsetTop
  return y - 104
}

export function GamesScreen() {
  const matches = useMatches()
  const data = useUserData()
  const [mode, setMode] = useState<Mode>('plan')
  const [query, setQuery] = useState('')
  const [league, setLeague] = useState<LeagueCode | 'all'>('all')
  const [range, setRange] = useState({ back: 14, ahead: 28 })
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrolledToToday = useRef(false)
  const prevHeight = useRef<number | null>(null)
  const today = localDateKey()

  const visitedIds = useMemo(() => new Set(data.visits.map((v) => v.matchId).filter(Boolean)), [data.visits])
  const watchIds = useMemo(() => new Set(data.watchlist), [data.watchlist])

  const q = query.trim() ? norm(query.trim()) : ''
  const matchesFilter = useCallback((m: Match) => {
    if (league !== 'all' && m.league !== league) return false
    if (!q) return true
    const s = stadiumById(m.stadiumId)
    return [m.home.name, m.away.name, m.home.shortName, m.away.shortName, s?.name ?? '', s?.city ?? '']
      .some((t) => norm(t).includes(q))
  }, [league, q])

  // ---------- Spielplan nach Tagen ----------

  const planDays = useMemo(() => {
    const from = q ? '0000' : addDays(today, -range.back)
    const to = q ? '9999' : addDays(today, range.ahead)
    return [...matches.byDay.entries()]
      .filter(([d]) => d >= from && d <= to)
      .map(([d, list]) => [d, list.filter(matchesFilter)] as const)
      .filter(([, list]) => list.length)
      .sort(([a], [b]) => a.localeCompare(b))
  }, [matches.byDay, today, range, q, matchesFilter])

  const anchorDay = planDays.find(([d]) => d >= today)?.[0]

  // Beim ersten Laden zum heutigen (bzw. nächsten) Spieltag springen. Schrift und Wappen laden nach
  // und verschieben das Layout – daher kurz nachkorrigieren, solange niemand selbst scrollt.
  useLayoutEffect(() => {
    const s = scrollRef.current
    if (scrolledToToday.current || matches.status !== 'ready' || !anchorDay || !s) return
    const place = () => {
      const el = s.querySelector<HTMLElement>(`[data-day="${anchorDay}"]`)
      if (el) s.scrollTop = dayOffset(s, el)
    }
    place()
    scrolledToToday.current = true
    let userScrolled = false
    const stop = () => { userScrolled = true }
    s.addEventListener('touchstart', stop, { once: true, passive: true })
    s.addEventListener('wheel', stop, { once: true, passive: true })
    const ro = new ResizeObserver(() => { if (!userScrolled) place() })
    ro.observe(s.querySelector('[data-day]')?.parentElement ?? s)
    const t = setTimeout(() => ro.disconnect(), 1500)
    return () => {
      clearTimeout(t)
      ro.disconnect()
      s.removeEventListener('touchstart', stop)
      s.removeEventListener('wheel', stop)
    }
  }, [matches.status, anchorDay])

  // Beim Nachladen früherer Spiele die Scrollposition halten
  useLayoutEffect(() => {
    const s = scrollRef.current
    if (s && prevHeight.current !== null) {
      s.scrollTop += s.scrollHeight - prevHeight.current
      prevHeight.current = null
    }
  }, [range.back])

  const loadEarlier = () => {
    prevHeight.current = scrollRef.current?.scrollHeight ?? null
    setRange((r) => ({ ...r, back: r.back + 28 }))
  }

  const jumpToToday = () => {
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-day="${anchorDay}"]`)
    if (el) scrollRef.current!.scrollTo({ top: dayOffset(scrollRef.current!, el), behavior: 'smooth' })
  }

  // ---------- Handler ----------

  const open = useCallback((m: Match) => openSheet({ kind: 'match', id: m.id }), [])
  const onVisit = useCallback((m: Match) => toggleMatchVisit(m), [])
  const onWatch = useCallback((m: Match) => toggleWatch(m.id), [])

  const row = (m: Match, dateLabel?: string) => (
    <MatchRow key={m.id} match={m} visited={visitedIds.has(m.id)} watched={watchIds.has(m.id)}
      onOpen={open} onToggleVisit={onVisit} onToggleWatch={onWatch} dateLabel={dateLabel} showStadium={!!dateLabel} />
  )

  // ---------- Merkliste & Besucht ----------

  const watchMatches = data.watchlist.map((id) => matches.byId.get(id)).filter((m): m is Match => !!m && matchesFilter(m))
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))
  const upcoming = watchMatches.filter((m) => !hasStarted(m))
  const past = watchMatches.filter((m) => hasStarted(m))

  const visits = [...data.visits]
    .filter((v) => (league === 'all' || v.league === league) && (!q || [v.homeTeam, v.awayTeam].some((t) => norm(t).includes(q))))
    .sort((a, b) => b.date.localeCompare(a.date))

  return (
    <ScreenScaffold
      ref={scrollRef}
      title="Spiele"
      actions={<>
        <GlassButton label="Spiel manuell eintragen" icon={<Plus size={22} strokeWidth={2.4} />} onClick={() => openSheet({ kind: 'add' })} />
        <ProfileButton />
      </>}
    >
      <div style={{ padding: '0 16px 12px', display: 'grid', gap: 12 }}>
        <Segmented id="games-mode" value={mode} onChange={setMode} options={[
          { value: 'plan', label: 'Spielplan' },
          { value: 'watch', label: `Merkliste${data.watchlist.length ? ` · ${data.watchlist.length}` : ''}` },
          { value: 'visited', label: `Besucht${data.visits.length ? ` · ${data.visits.length}` : ''}` },
        ]} />
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
      <div className="chips" style={{ paddingBottom: 6 }}>
        <Chip layoutId="games-league" on={league === 'all'} onClick={() => setLeague('all')}>Alle Ligen</Chip>
        {LEAGUES.map((l) => (
          <Chip key={l.code} layoutId="games-league" on={league === l.code} onClick={() => setLeague(l.code)}>
            <Flag code={l.countryCode} size={11} /> {l.name}
          </Chip>
        ))}
      </div>

      <motion.div key={mode} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={softSpring}>
        {mode === 'plan' && (
          matches.status === 'loading' ? <LoadingList /> :
          matches.status === 'error' ? <Empty title="Spielplan nicht erreichbar" text={matches.error ?? undefined} /> :
          planDays.length === 0 ? <Empty icon={<Search size={30} />} title="Nichts gefunden" text="Versuch es mit einem anderen Vereinsnamen." /> :
          <>
            {!q && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
                <PillButton small onClick={loadEarlier}><ChevronUp size={16} strokeWidth={2.6} /> Frühere Spiele</PillButton>
              </div>
            )}
            {planDays.map(([day, list]) => (
              <section key={day} className="day-group" data-day={day}>
                <div className="day-head">
                  <span>{relativeDay(day) ? `${relativeDay(day)}, ` : ''}{formatDayLong(day)}</span>
                  {day === today && <span className="today-tag">Heute</span>}
                </div>
                <div className="card inset list">{list.map((m) => row(m))}</div>
              </section>
            ))}
            {!q && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 10, padding: '18px 0 0' }}>
                <PillButton small onClick={jumpToToday}>Zu heute</PillButton>
                <PillButton small onClick={() => setRange((r) => ({ ...r, ahead: r.ahead + 35 }))}>Weitere Spiele</PillButton>
              </div>
            )}
          </>
        )}

        {mode === 'watch' && (
          watchMatches.length === 0 ? (
            <Empty icon={<Star size={30} strokeWidth={2} />} title="Deine Merkliste ist leer"
              text="Tippe im Spielplan bei kommenden Spielen auf den Stern. Gemerkte Spiele siehst du auch auf der Karte." />
          ) : <>
            {upcoming.length > 0 && <>
              <div className="day-head">Anstehend</div>
              <div className="card inset list">{upcoming.map((m) => row(m, formatDayFriendly(localDateKey(m.kickoff))))}</div>
            </>}
            {past.length > 0 && <>
              <div className="day-head">Vorbei – warst du da?</div>
              <div className="card inset list">{past.map((m) => row(m, formatDayFriendly(localDateKey(m.kickoff))))}</div>
            </>}
          </>
        )}

        {mode === 'visited' && (
          visits.length === 0 ? (
            <Empty icon={<BallIcon size={32} />} title={data.visits.length ? 'Nichts gefunden' : 'Noch keine Spiele'}
              text={data.visits.length ? undefined : 'Hake im Spielplan Spiele ab, bei denen du im Stadion warst – oder trag eines manuell ein.'}>
              {!data.visits.length && (
                <div style={{ marginTop: 12 }}>
                  <PillButton tint onClick={() => setMode('plan')}>Zum Spielplan</PillButton>
                </div>
              )}
            </Empty>
          ) : (
            <div className="card inset list" style={{ marginTop: 8 }}>
              {visits.map((v) => {
                const m = v.matchId ? matches.byId.get(v.matchId) : undefined
                return m
                  ? row(m, formatDayFriendly(v.date))
                  : <VisitRow key={v.id} visit={v} onOpen={() => openSheet({ kind: 'visit', id: v.id })} />
              })}
            </div>
          )
        )}
      </motion.div>
    </ScreenScaffold>
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
