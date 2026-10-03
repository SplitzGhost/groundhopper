// Merkliste: alle gemerkten Spiele, anstehende zuerst. Vorbei gegangene lassen sich direkt abhaken.

import { useCallback, useMemo } from 'react'
import { Star } from 'lucide-react'
import type { Match } from '../shared/types.ts'
import { formatDayFriendly, localDateKey } from '../lib/dates.ts'
import { hasStarted } from '../lib/matchState.ts'
import { useMatches } from '../state/matches.ts'
import { toggleMatchVisit, toggleWatch, useUserData } from '../state/userData.ts'
import { openSheet } from '../state/ui.ts'
import { Sheet } from '../components/Sheet.tsx'
import { MatchRow } from '../components/MatchRow.tsx'
import { Empty } from '../components/ui.tsx'

export function WatchlistSheet() {
  const matches = useMatches()
  const data = useUserData()
  const visitedIds = useMemo(() => new Set(data.visits.map((v) => v.matchId).filter(Boolean)), [data.visits])

  const list = data.watchlist.map((id) => matches.byId.get(id)).filter((m): m is Match => !!m)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))
  const upcoming = list.filter((m) => !hasStarted(m))
  const past = list.filter((m) => hasStarted(m))

  const open = useCallback((m: Match) => openSheet({ kind: 'match', id: m.id }), [])
  const onVisit = useCallback((m: Match) => toggleMatchVisit(m), [])
  const onWatch = useCallback((m: Match) => toggleWatch(m.id), [])

  const row = (m: Match) => (
    <MatchRow key={m.id} match={m} visited={visitedIds.has(m.id)} watched onOpen={open} onToggleVisit={onVisit}
      onToggleWatch={onWatch} dateLabel={formatDayFriendly(localDateKey(m.kickoff))} showStadium />
  )

  return (
    <Sheet title="Merkliste">
      {list.length === 0 ? (
        <Empty icon={<Star size={30} strokeWidth={2} />} title="Deine Merkliste ist leer"
          text="Tippe im Spielplan bei kommenden Spielen auf den Stern. Gemerkte Spiele siehst du auch auf der Karte." />
      ) : <div style={{ paddingBottom: 16 }}>
        {upcoming.length > 0 && <>
          <div className="day-head">Anstehend</div>
          <div className="card inset list">{upcoming.map(row)}</div>
        </>}
        {past.length > 0 && <>
          <div className="day-head">Vorbei – warst du da?</div>
          <div className="card inset list">{past.map(row)}</div>
        </>}
      </div>}
    </Sheet>
  )
}
