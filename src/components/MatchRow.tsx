import { memo } from 'react'
import type { Match, Visit } from '../shared/types.ts'
import { leagueByCode } from '../shared/leagues.ts'
import { formatTime } from '../lib/dates.ts'
import { stadiumById } from '../lib/stadiums.ts'
import { hasStarted } from '../lib/matchState.ts'
import { Star } from 'lucide-react'
import { CheckToggle, Crest, StarToggle } from './ui.tsx'


interface Props {
  match: Match
  visited: boolean
  watched: boolean
  onOpen: (m: Match) => void
  onToggleVisit: (m: Match) => void
  onToggleWatch: (m: Match) => void
  showStadium?: boolean
  /** Datum statt nur Uhrzeit anzeigen */
  dateLabel?: string
}

export const MatchRow = memo(function MatchRow({ match: m, visited, watched, onOpen, onToggleVisit, onToggleWatch, showStadium, dateLabel }: Props) {
  const started = hasStarted(m)
  const hasScore = m.score.home !== null && m.score.away !== null
  const homeLost = hasScore && m.score.home! < m.score.away!
  const awayLost = hasScore && m.score.away! < m.score.home!
  const stadium = showStadium ? stadiumById(m.stadiumId) : undefined

  return (
    <div className="match-row row-press pressable" role="button" tabIndex={0} onClick={() => onOpen(m)}>
      <div style={{ minWidth: 0 }}>
        <div className="match-meta">
          <span className="league-tag">{leagueByCode(m.league).shortName}</span>
          {m.status === 'live' && <span className="live-dot" />}
          <span className="tnum" style={{ flex: 'none' }}>
            {dateLabel ? `${dateLabel} · ` : ''}
            {m.status === 'live' ? 'Live' : formatTime(m.kickoff)}
          </span>
          {m.status === 'postponed' && <span style={{ color: 'var(--danger)' }}>· verlegt</span>}
          {stadium && (
            <span className="truncate" style={{ minWidth: 0 }}>· {stadium.name}</span>
          )}
        </div>
        <div className="match-teams">
          <div className={`match-team ${homeLost ? 'lost' : ''}`}>
            <Crest src={m.home.crest} name={m.home.name} size={24} />
            <span className="truncate">{m.home.shortName}</span>
            <span className="score">{m.score.home ?? ''}</span>
          </div>
          <div className={`match-team ${awayLost ? 'lost' : ''}`}>
            <Crest src={m.away.crest} name={m.away.name} size={24} />
            <span className="truncate">{m.away.shortName}</span>
            <span className="score">{m.score.away ?? ''}</span>
          </div>
        </div>
      </div>
      {started
        ? <CheckToggle checked={visited} onToggle={() => onToggleVisit(m)} />
        : <StarToggle on={watched} onToggle={() => onToggleWatch(m)} />}
    </div>
  )
})

/** Zeile für einen Besuch ohne verknüpftes Spiel (manuell eingetragen). */
export function VisitRow({ visit: v, onOpen }: { visit: Visit; onOpen: (v: Visit) => void }) {
  const stadium = stadiumById(v.stadiumId)
  const competition = v.league ? leagueByCode(v.league).shortName : v.competition
  return (
    <div className="match-row row-press pressable" role="button" tabIndex={0} onClick={() => onOpen(v)}>
      <div style={{ minWidth: 0 }}>
        <div className="match-meta">
          {competition && <span className="league-tag">{competition}</span>}
          {stadium && <span className="truncate">{stadium.name}</span>}
          {v.customStadium && <span className="truncate">{v.customStadium.name}</span>}
        </div>
        <div className="match-teams">
          <div className="match-team">
            <Crest src={v.homeCrest} name={v.homeTeam} size={24} />
            <span className="truncate">{v.homeTeam}</span>
            <span className="score">{v.homeScore ?? ''}</span>
          </div>
          <div className="match-team">
            <Crest src={v.awayCrest} name={v.awayTeam} size={24} />
            <span className="truncate">{v.awayTeam}</span>
            <span className="score">{v.awayScore ?? ''}</span>
          </div>
        </div>
      </div>
      {v.rating ? (
        <span className="mini-stars" aria-label={`${v.rating} Sterne`}>
          {Array.from({ length: v.rating }, (_, i) => <Star key={i} size={12} strokeWidth={0} fill="currentColor" />)}
        </span>
      ) : null}
    </div>
  )
}
