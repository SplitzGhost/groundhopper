// Startseite: Vollbild-Karte mit Standort, Stadien, Ligen-/Tagesfilter und Spiele-Karussell.

import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CalendarDays, LocateFixed, Search, SlidersHorizontal, Star } from 'lucide-react'
import type { Match, Stadium } from '../shared/types.ts'
import { LEAGUE_CODES, leagueByCode } from '../shared/leagues.ts'
import { STADIUMS, stadiumById } from '../lib/stadiums.ts'
import { distanceKm, type LatLon } from '../lib/geo.ts'
import { addDays, formatChip, formatDayFriendly, formatDayMedium, formatTime, localDateKey, relativeDay } from '../lib/dates.ts'
import { useMatches } from '../state/matches.ts'
import { useUserData } from '../state/userData.ts'
import { locate, useLocation } from '../state/location.ts'
import { mapFilterStore, mapFocusStore, openSheet, setMapFilter, sheetStore } from '../state/ui.ts'
import { MapAttribution, StadiumMap, type Pin, type StadiumMapHandle } from '../components/StadiumMap.tsx'
import { Crest, GlassButton, PillButton } from '../components/ui.tsx'
import { ProfileButton } from '../components/ProfileButton.tsx'
import { softSpring, spring } from '../lib/motion.ts'
import { hasStarted } from '../lib/matchState.ts'

/** Startansicht: Mitteleuropa, bis der Standort da ist */
const START: LatLon = { lat: 49.6, lon: 6.2 }
const START_ZOOM = 4.3

/** Pins mit Spiel zuerst nach Entfernung sortieren – so „ploppen“ sie vom Zentrum nach außen auf. */
function byDistance<T extends { stadium: Stadium }>(list: T[], from: LatLon): T[] {
  return [...list].sort((a, b) => distanceKm(from, a.stadium) - distanceKm(from, b.stadium))
}

function groupByStadium(matches: Match[], label: (m: Match) => string, star = false): Pin[] {
  const pins = new Map<string, Pin>()
  for (const m of matches) {
    const s = stadiumById(m.stadiumId)
    if (!s || pins.has(s.id)) continue
    pins.set(s.id, { stadium: s, label: label(m), star, hasMatch: true })
  }
  return [...pins.values()]
}

export function MapScreen() {
  const mapRef = useRef<StadiumMapHandle>(null)
  const filter = mapFilterStore.use()
  const sheets = sheetStore.use()
  const focus = mapFocusStore.use()
  const data = useUserData()
  const matches = useMatches()
  const loc = useLocation()
  const today = localDateKey()
  const centeredOnUser = useRef(false)

  const selectedId = [...sheets].reverse().find((s) => s.spec.kind === 'stadium')?.spec
  const selected = selectedId && 'id' in selectedId ? selectedId.id : null

  const visited = useMemo(() => new Set(data.visits.map((v) => v.stadiumId).filter(Boolean)), [data.visits])
  const origin: LatLon = loc.position ?? START

  // ---------- Was wird angezeigt? ----------

  const leagueSet = useMemo(() => new Set(filter.leagues), [filter.leagues])

  const dayMatches = useMemo(() => {
    if (filter.day === 'all') return []
    return (matches.byDay.get(filter.day) ?? []).filter((m) => leagueSet.has(m.league) && m.stadiumId)
  }, [filter.day, matches.byDay, leagueSet])

  const watchMatches = useMemo(() => data.watchlist
    .map((id) => matches.byId.get(id))
    .filter((m): m is Match => !!m && !hasStarted(m) && !!m.stadiumId)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff)), [data.watchlist, matches.byId])

  const pins = useMemo(() => {
    let list: Pin[]
    if (filter.watchlist) {
      list = groupByStadium(watchMatches, (m) => formatChip(localDateKey(m.kickoff)), true)
    } else if (filter.day !== 'all') {
      list = groupByStadium(dayMatches, (m) => formatTime(m.kickoff))
    } else {
      const playingToday = new Set((matches.byDay.get(today) ?? []).map((m) => m.stadiumId))
      list = STADIUMS
        .filter((s) => s.teams.some((t) => leagueSet.has(t.league)))
        .map((s) => ({ stadium: s, hasMatch: playingToday.has(s.id) }))
    }
    if (filter.onlyUnvisited) list = list.filter((p) => !visited.has(p.stadium.id))
    // Gezielt geöffnetes Stadion (Suche, Album) immer zeigen, auch wenn der Filter es ausblendet
    const sel = stadiumById(selected)
    if (sel && !list.some((p) => p.stadium.id === sel.id)) list.push({ stadium: sel })
    return byDistance(list, origin)
    // origin bewusst nicht als Abhängigkeit: Pins sollen nicht bei jeder Standortänderung neu aufploppen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.watchlist, filter.day, filter.onlyUnvisited, watchMatches, dayMatches, matches.byDay, leagueSet, visited, today, selected])

  // Karussell: Spiele des gewählten Tages nach Entfernung, oder gemerkte Spiele nach Datum
  const carousel: Match[] | null = filter.watchlist
    ? watchMatches
    : filter.day !== 'all'
      ? [...dayMatches].sort((a, b) =>
          distanceKm(origin, stadiumById(a.stadiumId)!) - distanceKm(origin, stadiumById(b.stadiumId)!))
      : null

  // ---------- Tage für die Leiste ----------

  const days = useMemo(() => {
    const list = [today, addDays(today, 1)]
    for (let i = 2; i < 24; i++) {
      const d = addDays(today, i)
      if (matches.byDay.has(d)) list.push(d)
    }
    if (filter.day !== 'all' && !list.includes(filter.day)) list.push(filter.day)
    return list.sort()
  }, [today, matches.byDay, filter.day])

  const nextMatchDay = useMemo(() => {
    const from = filter.day === 'all' ? today : addDays(filter.day, 1)
    return [...matches.byDay.keys()].filter((d) => d >= from).sort()
      .find((d) => matches.byDay.get(d)!.some((m) => leagueSet.has(m.league)))
  }, [filter.day, today, matches.byDay, leagueSet])

  // ---------- Karte steuern ----------

  useEffect(() => {
    locate()
  }, [])

  useEffect(() => {
    if (!loc.position || centeredOnUser.current) return
    centeredOnUser.current = true
    mapRef.current?.flyTo(loc.position, { zoom: 8.5 })
  }, [loc.position])

  useEffect(() => {
    if (!focus) return
    const pos = { lat: focus.lat, lon: focus.lon }
    mapRef.current?.flyTo(pos, { zoom: focus.zoom, lift: !!focus.stadiumId })
    if (focus.stadiumId) openSheet({ kind: 'stadium', id: focus.stadiumId })
  }, [focus])

  const onPinClick = useCallback((id: string) => {
    const s = stadiumById(id)!
    mapRef.current?.flyTo(s, { minZoom: 7, lift: true })
    openSheet({ kind: 'stadium', id }, true)
  }, [])

  const openMatch = (m: Match) => {
    const s = stadiumById(m.stadiumId)
    if (s) mapRef.current?.flyTo(s, { minZoom: 9, lift: true })
    openSheet({ kind: 'match', id: m.id }, true)
  }

  const onLocate = async () => {
    const pos = loc.position && loc.status === 'ok' ? loc.position : await locate()
    if (pos) mapRef.current?.flyTo(pos, { minZoom: 11 })
  }

  const filterCount = (filter.leagues.length < LEAGUE_CODES.length ? 1 : 0) + (filter.onlyUnvisited ? 1 : 0)

  return (
    <div className="map-screen">
      <div className="map-wrap">
        <StadiumMap ref={mapRef} start={START} startZoom={START_ZOOM} pins={pins} visited={visited}
          selectedId={selected} me={loc.position} onPinClick={onPinClick} />
      </div>

      {/* Obere Knöpfe */}
      <div className="map-top">
        <div className="btn-group">
          <GlassButton label="Filter" icon={<SlidersHorizontal size={21} strokeWidth={2.2} />} badge={filterCount}
            onClick={() => openSheet({ kind: 'filter' })} />
          <GlassButton label="Gemerkte Spiele" active={filter.watchlist}
            icon={<Star size={21} strokeWidth={2.2} fill={filter.watchlist ? 'currentColor' : 'none'} />}
            onClick={() => setMapFilter({ watchlist: !filter.watchlist })} />
        </div>
        <div className="btn-group">
          <GlassButton label="Suchen" icon={<Search size={21} strokeWidth={2.3} />} onClick={() => openSheet({ kind: 'search' })} />
          <ProfileButton />
        </div>
      </div>
      <MapAttribution />

      {/* Untere Leiste: Karussell + Tage */}
      <div className="map-bottom">
        <AnimatePresence mode="popLayout" initial={false}>
          {carousel && (
            <motion.div
              key={filter.watchlist ? 'watch' : filter.day}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24, transition: { duration: 0.18 } }}
              transition={softSpring}
            >
              {matches.status === 'loading' ? (
                <div className="carousel"><div className="glass carousel-card wide" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div className="spinner" /><span className="muted">Spielplan wird geladen …</span>
                </div></div>
              ) : carousel.length ? (
                <div className="carousel">
                  {carousel.map((m, i) => (
                    <CarouselCard key={m.id} match={m} index={i} origin={loc.position} showDate={filter.watchlist}
                      onClick={() => openMatch(m)} />
                  ))}
                </div>
              ) : (
                <div className="carousel">
                  <div className="glass carousel-card wide">
                    <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: -0.2 }}>
                      {filter.watchlist ? 'Noch keine Spiele gemerkt' : `Keine Spiele ${relativeDay(filter.day)?.toLowerCase() ?? 'am ' + formatDayMedium(filter.day)}`}
                    </div>
                    <div className="muted" style={{ fontSize: 14, marginTop: 2 }}>
                      {filter.watchlist
                        ? 'Tippe bei einem Spiel auf den Stern, um es dir zu merken.'
                        : filter.leagues.length < LEAGUE_CODES.length ? 'in den gewählten Ligen.' : 'Vielleicht Länderspielpause?'}
                    </div>
                    {!filter.watchlist && nextMatchDay && (
                      <div style={{ marginTop: 12 }}>
                        <PillButton small tint onClick={() => setMapFilter({ day: nextMatchDay })}>
                          Nächster Spieltag: {formatDayFriendly(nextMatchDay)}
                        </PillButton>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="day-strip-wrap">
          <DayStrip days={days} value={filter.watchlist ? null : filter.day}
            counts={(d) => (matches.byDay.get(d) ?? []).filter((m) => leagueSet.has(m.league)).length}
            onChange={(day) => setMapFilter({ day, watchlist: false })} />
          <GlassButton label="Mein Standort" active={loc.status === 'ok'}
            icon={loc.status === 'locating' ? <span className="spinner" style={{ width: 20, height: 20 }} /> : <LocateFixed size={22} strokeWidth={2.2} />}
            onClick={onLocate} />
        </div>
      </div>
    </div>
  )
}

// ---------- Tagesleiste ----------

function DayStrip({ days, value, counts, onChange }: {
  days: string[]
  value: string | null
  counts: (d: string) => number
  onChange: (d: string) => void
}) {
  const scroller = useRef<HTMLDivElement>(null)

  // Gewählten Tag sanft in die Mitte scrollen
  useEffect(() => {
    const el = scroller.current?.querySelector<HTMLElement>('[data-on="true"]')
    if (el && scroller.current) {
      const s = scroller.current
      s.scrollTo({ left: el.offsetLeft - s.clientWidth / 2 + el.clientWidth / 2, behavior: 'smooth' })
    }
  }, [value])

  const chip = (key: string, label: ReactNode, sub?: string | number, empty = false) => {
    const on = value === key
    return (
      <motion.button key={key} type="button" data-on={on} className={`day-chip ${on ? 'on' : ''} ${empty ? 'zero' : ''}`}
        whileTap={{ scale: 0.92 }} transition={spring} onClick={() => onChange(key)}>
        {on && <motion.span layoutId="day-pill" className="chip-bg" transition={softSpring} />}
        <span style={{ position: 'relative' }}>{label}{sub !== undefined && sub !== '' && <span className="sub">{sub}</span>}</span>
      </motion.button>
    )
  }

  return (
    <div className="glass day-strip">
      <div className="day-strip-scroll" ref={scroller}>
        {chip('all', 'Alle Stadien')}
        {days.map((d) => {
          const n = counts(d)
          return chip(d, relativeDay(d) ?? formatChip(d), n || '', n === 0)
        })}
        <label className="day-chip" style={{ display: 'grid', placeItems: 'center', position: 'relative' }} aria-label="Datum wählen">
          <CalendarDays size={18} strokeWidth={2.2} />
          <input type="date" style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%' }}
            onChange={(e) => e.target.value && onChange(e.target.value)} />
        </label>
      </div>
    </div>
  )
}

// ---------- Karte im Karussell ----------

function CarouselCard({ match: m, index, origin, showDate, onClick }: {
  match: Match
  index: number
  origin: LatLon | null
  showDate: boolean
  onClick: () => void
}) {
  const s = stadiumById(m.stadiumId)!
  const km = origin ? distanceKm(origin, s) : null
  return (
    <motion.button
      type="button"
      className="glass carousel-card"
      initial={{ opacity: 0, x: 30, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ ...softSpring, delay: Math.min(index, 6) * 0.045 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
    >
      <div className="match-meta" style={{ marginBottom: 9 }}>
        <span className="league-tag">{leagueByCode(m.league).shortName}</span>
        <span className="tnum" style={{ color: 'var(--text)', fontWeight: 600 }}>
          {showDate ? formatDayFriendly(localDateKey(m.kickoff)) + ' · ' : ''}{formatTime(m.kickoff)}
        </span>
        {km !== null && <span className="tnum">· {km < 10 ? km.toFixed(1) : Math.round(km)} km</span>}
      </div>
      <div className="match-teams" style={{ gap: 6 }}>
        <div className="match-team" style={{ gridTemplateColumns: '22px 1fr' }}>
          <Crest src={m.home.crest} name={m.home.name} size={22} />
          <span className="truncate">{m.home.shortName}</span>
        </div>
        <div className="match-team" style={{ gridTemplateColumns: '22px 1fr' }}>
          <Crest src={m.away.crest} name={m.away.name} size={22} />
          <span className="truncate">{m.away.shortName}</span>
        </div>
      </div>
      <div className="muted truncate" style={{ fontSize: 12.5, marginTop: 8 }}>{s.name} · {s.city}</div>
    </motion.button>
  )
}
