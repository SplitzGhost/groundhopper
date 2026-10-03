import { useCallback } from 'react'
import { motion } from 'motion/react'
import { MapPin, Navigation } from 'lucide-react'
import type { Match } from '../shared/types.ts'
import { stadiumById } from '../lib/stadiums.ts'
import { distanceKm } from '../lib/geo.ts'
import { formatDayFriendly, formatDayMedium, localDateKey } from '../lib/dates.ts'
import { COUNTRIES } from '../lib/album.ts'
import { useMatches } from '../state/matches.ts'
import { useLocation } from '../state/location.ts'
import { toggleMatchVisit, toggleWatch, useUserData } from '../state/userData.ts'
import { closeAllSheets, focusMap, openSheet, tabStore } from '../state/ui.ts'
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
  const visitedIds = new Set(data.visits.map((v) => v.matchId))
  const watchIds = new Set(data.watchlist)

  const row = (m: Match) => (
    <MatchRow key={m.id} match={m} visited={visitedIds.has(m.id)} watched={watchIds.has(m.id)}
      onOpen={open} onToggleVisit={onVisit} onToggleWatch={onWatch} dateLabel={formatDayFriendly(localDateKey(m.kickoff))} />
  )

  return (
    <Sheet medium title={s.name}>
      <div className="sheet-pad">
        <div className="muted" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15 }}>
          <MapPin size={15} strokeWidth={2.4} />
          {s.city} · {country?.flag} {country?.name}
          {km !== null && <span className="tnum">· {km < 10 ? km.toFixed(1) : Math.round(km).toLocaleString('de-DE')} km</span>}
        </div>
      </div>

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
              ? <span style={{ color: 'var(--accent)', fontWeight: 600 }}>✓ Gesammelt · {myVisits.length}× besucht · zuletzt {formatDayMedium(myVisits[0].date)}</span>
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
