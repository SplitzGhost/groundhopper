import { useCallback } from 'react'
import { motion } from 'motion/react'
import type { CSSProperties } from 'react'
import { Check, ChevronRight, Lock, MapPin, Navigation, Rotate3d } from 'lucide-react'
import type { Match } from '../shared/types.ts'
import { stadiumById } from '../lib/stadiums.ts'
import { distanceKm } from '../lib/geo.ts'
import { formatDayFriendly, formatDayMedium, localDateKey } from '../lib/dates.ts'
import { COUNTRIES } from '../lib/album.ts'
import { useMatches } from '../state/matches.ts'
import { useLocation } from '../state/location.ts'
import { toggleMatchVisit, toggleWatch, useUserData } from '../state/userData.ts'
import { closeAllSheets, focusMap, openCard, openSheet, tabStore } from '../state/ui.ts'
import { useCards } from '../state/cards.ts'
import { CardStrip } from '../components/cards/CardStrip.tsx'
import { stadiumSpec } from '../data/stadiumInfo.ts'
import { clubInfo } from '../data/clubs.ts'
import { Stadium3D } from '../components/Stadium3D.tsx'
import { Flag } from '../components/Flag.tsx'
import { Sheet } from '../components/Sheet.tsx'
import { MatchRow } from '../components/MatchRow.tsx'
import { hasStarted } from '../lib/matchState.ts'
import { Crest, PillButton } from '../components/ui.tsx'
import { softSpring } from '../lib/motion.ts'

export function StadiumSheet({ id }: { id: string }) {
  const s = stadiumById(id)
  const matches = useMatches()
  const data = useUserData()
  const loc = useLocation()
  const tab = tabStore.use()
  const cards = useCards().filter((c) => c.visit.stadiumId === id)
  const openStadiumCard = () => { if (cards.length) openCard(cards[cards.length - 1].id) }

  const open = useCallback((m: Match) => openSheet({ kind: 'match', id: m.id }), [])
  const onVisit = useCallback((m: Match) => toggleMatchVisit(m), [])
  const onWatch = useCallback((m: Match) => toggleWatch(m.id), [])

  if (!s) return <Sheet title="Stadion">Unbekanntes Stadion</Sheet>

  const list = matches.byStadium.get(id) ?? []
  const upcoming = list.filter((m) => !hasStarted(m)).slice(0, 5)
  const recent = list.filter((m) => hasStarted(m)).slice(-5).reverse()
  const myVisits = data.visits.filter((v) => v.stadiumId === id).sort((a, b) => b.date.localeCompare(a.date))
  const km = loc.position ? distanceKm(loc.position, s) : null
  const country = COUNTRIES[s.country]
  const spec = stadiumSpec(s.id)
  const club = clubInfo(s.teams[0].name)

  const visitedIds = new Set(data.visits.map((v) => v.matchId))
  const watchIds = new Set(data.watchlist)

  const row = (m: Match) => (
    <MatchRow key={m.id} match={m} visited={visitedIds.has(m.id)} watched={watchIds.has(m.id)}
      onOpen={open} onToggleVisit={onVisit} onToggleWatch={onWatch} dateLabel={formatDayFriendly(localDateKey(m.kickoff))} />
  )

  return (
    <Sheet medium title={s.name}>
      <div className="sheet-pad">
        <div className="muted stadium-where">
          <MapPin size={15} strokeWidth={2.4} />
          {s.city} · <Flag code={s.country} size={10} /> {country?.name}
          {km !== null && <span className="tnum">· {km < 10 ? km.toFixed(1) : Math.round(km).toLocaleString('de-DE')} km</span>}
        </div>
      </div>

      <motion.div className={`stadium-hero ${myVisits.length ? 'got' : ''}`} style={{ '--c1': club.primary } as CSSProperties}
        initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={softSpring}>
        <Stadium3D stadiumId={s.id} mono={!myVisits.length} className="stadium-hero-art" onTap={openStadiumCard} />
        <span className="stadium-hero-tag">
          {myVisits.length ? <><Check size={12} strokeWidth={3} /> Gesammelt</> : <><Lock size={11} strokeWidth={2.6} /> Noch nicht gesammelt</>}
        </span>
        <span className="stadium-hero-hint"><Rotate3d size={12} strokeWidth={2.4} /> 3D</span>
        <span className="stadium-hero-stats">
          <span><b className="tnum">{spec.capacity.toLocaleString('de-DE')}</b> Plätze</span>
          {spec.opened && <span><b className="tnum">{spec.opened}</b> eröffnet</span>}
          {cards.length > 0 && (
            <motion.button type="button" className="stadium-hero-card" whileTap={{ scale: 0.94 }} onClick={openStadiumCard}>
              {cards.length === 1 ? 'Karte' : `${cards.length} Karten`} <ChevronRight size={13} strokeWidth={2.8} />
            </motion.button>
          )}
        </span>
      </motion.div>

      <motion.div className="card inset" style={{ marginTop: 14, padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={softSpring}>
        <div style={{ display: 'flex' }}>
          {s.teams.map((t, i) => (
            <motion.span key={t.name} style={{ marginLeft: i ? -12 : 0 }}
              initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 420, damping: 18, delay: 0.08 + i * 0.08 }}>
              <Crest src={matches.crests.get(t.name)} name={t.name} size={52} />
            </motion.span>
          ))}
        </div>
        <div className="row-main">
          <div className="row-title">{s.teams.map((t) => t.name).join(' & ')}</div>
          <div className="row-sub">
            {myVisits.length
              ? <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{myVisits.length}× besucht · zuletzt {formatDayMedium(myVisits[0].date)}</span>
              : 'Noch nicht gesammelt'}
          </div>
        </div>
      </motion.div>

      <div className="fab-row" style={{ marginTop: 14 }}>
        <PillButton tint block onClick={() => window.open(`https://maps.apple.com/?daddr=${s.lat},${s.lon}&q=${encodeURIComponent(s.name)}`, '_blank')}>
          <Navigation size={18} strokeWidth={2.4} /> Route
        </PillButton>
        {tab !== 'map' && (
          <PillButton block onClick={() => {
            closeAllSheets()
            focusMap(s.lat, s.lon, 15.6, s.id)
          }}>
            <MapPin size={18} strokeWidth={2.4} /> Auf Karte
          </PillButton>
        )}
      </div>

      {cards.length > 0 && <>
        <div className="section-head"><h3 className="section-title">Deine Karten<b>{cards.length}</b></h3></div>
        <CardStrip cards={[...cards].reverse()} className="in-sheet" />
      </>}

      {upcoming.length > 0 && <>
        <div className="section-head"><h3 className="section-title">Nächste Spiele</h3></div>
        <div className="card inset list">{upcoming.map(row)}</div>
      </>}
      {recent.length > 0 && <>
        <div className="section-head"><h3 className="section-title">Letzte Spiele</h3></div>
        <div className="card inset list">{recent.map(row)}</div>
      </>}
      {s.approx && <p className="muted sheet-pad" style={{ fontSize: 12.5 }}>Position nur ungefähr (Stadtzentrum).</p>}
    </Sheet>
  )
}
