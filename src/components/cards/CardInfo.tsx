// Kartenrückseite mit Steckbrief: Stadion- bzw. Vereinsinfos und der eigene Sammelstand.

import type { CSSProperties, ReactNode } from 'react'
import { motion } from 'motion/react'
import { CalendarDays, Flame, Hash, House, MapPin, Palette, Quote, Shield, Sparkles, Ticket, Umbrella, Users } from 'lucide-react'
import type { Card, CardState } from '../../lib/cards.ts'
import { cardColors, cardNo, shortClub } from '../../lib/cards.ts'
import { RARITY_LABEL, stadiumSpec, type RoofType } from '../../data/stadiumInfo.ts'
import { clubInfo } from '../../data/clubs.ts'
import { COUNTRIES, canonicalTeam } from '../../lib/album.ts'
import { DERBIES } from '../../lib/derbies.ts'
import { STADIUMS } from '../../lib/stadiums.ts'
import { leagueByCode } from '../../shared/leagues.ts'
import { formatDayFriendly, formatDayMedium, localDateKey } from '../../lib/dates.ts'
import { hasStarted } from '../../lib/matchState.ts'
import { useMatches } from '../../state/matches.ts'
import { Crest } from '../ui.tsx'

const ROOF: Record<RoofType, string> = {
  none: 'ohne Dach',
  main: 'Haupttribüne überdacht',
  sides: 'Längsseiten überdacht',
  full: 'komplett überdacht',
  closed: 'schließbares Dach',
}

function Row({ icon, label, children, i }: { icon: ReactNode; label: string; children: ReactNode; i: number }) {
  return (
    <motion.div className="ci-row" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32, delay: 0.12 + i * 0.035 }}>
      <span className="ci-icon">{icon}</span>
      <span className="ci-label">{label}</span>
      <span className="ci-value">{children}</span>
    </motion.div>
  )
}

export function CardInfo({ card, state }: { card: Card; state: CardState }) {
  const matches = useMatches()
  const [c1, c2] = cardColors(card)
  const rows: [ReactNode, string, ReactNode][] = []
  let fact: string | undefined
  let nextMatch: { id: string; label: string } | null = null

  const upcomingAt = (stadiumId: string) => {
    const m = (matches.byStadium.get(stadiumId) ?? []).find((x) => !hasStarted(x))
    return m ? { id: m.id, label: `${formatDayFriendly(localDateKey(m.kickoff))} · ${m.home.shortName} – ${m.away.shortName}` } : null
  }

  switch (card.kind) {
    case 'stadium': {
      const s = card.stadium
      const spec = stadiumSpec(s.id)
      rows.push([<Users size={14} />, 'Plätze', spec.capacity.toLocaleString('de-DE')])
      if (spec.opened) rows.push([<CalendarDays size={14} />, 'Eröffnet', spec.opened])
      rows.push([<MapPin size={14} />, 'Ort', `${s.city}, ${COUNTRIES[s.country]?.name ?? ''}`])
      rows.push([<House size={14} />, s.teams.length > 1 ? 'Heimat von' : 'Heimverein', (
        <span className="ci-crests">{s.teams.map((t) => <Crest key={t.name} src={matches.crests.get(t.name)} name={t.name} size={16} />)}
          {s.teams.map((t) => shortClub(t.name)).join(' & ')}</span>
      )])
      rows.push([<Umbrella size={14} />, 'Dach', ROOF[spec.roof]])
      fact = spec.fact
      nextMatch = upcomingAt(s.id)
      break
    }
    case 'club': {
      const info = clubInfo(card.club)
      if (info.founded) rows.push([<CalendarDays size={14} />, 'Gegründet', info.founded])
      if (info.nickname) rows.push([<Hash size={14} />, 'Spitzname', info.nickname])
      rows.push([<Shield size={14} />, 'Stadion', card.stadium.name])
      rows.push([<Palette size={14} />, 'Farben', (
        <span className="ci-swatches"><i style={{ background: info.primary }} /><i style={{ background: info.secondary }} /></span>
      )])
      const derbies = DERBIES.filter((d) => d.teams.includes(card.club))
      if (derbies.length) rows.push([<Flame size={14} />, 'Derbys', derbies.map((d) => d.name).join(', ')])
      const own = (name: string, league: Card['league']) => canonicalTeam(name, league) === card.club
      const next = matches.matches.find((m) => !hasStarted(m) && (own(m.home.name, m.league) || own(m.away.name, m.league)))
      if (next) nextMatch = { id: next.id, label: `${formatDayFriendly(localDateKey(next.kickoff))} · ${next.home.shortName} – ${next.away.shortName}` }
      break
    }
    case 'derby': {
      const [a, b] = card.derby.teams
      rows.push([<Shield size={14} />, 'Paarung', (
        <span className="ci-crests"><Crest src={matches.crests.get(a)} name={a} size={16} /><Crest src={matches.crests.get(b)} name={b} size={16} />
          {shortClub(a)} – {shortClub(b)}</span>
      )])
      rows.push([<Sparkles size={14} />, 'Liga', leagueByCode(card.derby.league).name])
      const games = matches.matches.filter((m) => (m.home.name === a && m.away.name === b) || (m.home.name === b && m.away.name === a))
      const next = games.find((m) => !hasStarted(m))
      if (next) nextMatch = { id: next.id, label: `${formatDayFriendly(localDateKey(next.kickoff))} · ${STADIUMS.find((s) => s.id === next.stadiumId)?.name ?? ''}` }
      break
    }
    case 'achievement': {
      rows.push([<Sparkles size={14} />, 'Aufgabe', card.achievement.description])
      rows.push([<Ticket size={14} />, 'Belohnung', '+10 Punkte'])
      break
    }
  }

  const first = state.visits.reduce<string | null>((min, v) => (!min || v.date < min ? v.date : min), null)

  return (
    <div className={`tc tc-info tc-r-${card.rarity}`} style={{ '--c1': c1, '--c2': c2 } as CSSProperties}>
      <div className="tc-face ci">
        <div className="ci-head">
          <div className="ci-title">{card.title}</div>
          <div className="ci-sub">{cardNo(card.number)} · {RARITY_LABEL[card.rarity]}</div>
        </div>
        <div className="ci-rows">
          {rows.map(([icon, label, value], i) => <Row key={label} icon={icon} label={label} i={i}>{value}</Row>)}
        </div>
        {fact && (
          <motion.div className="ci-fact" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
            <Quote size={11} strokeWidth={2.6} />{fact}
          </motion.div>
        )}
        <div className={`ci-mine ${state.got ? 'got' : ''}`}>
          {card.kind === 'achievement' ? (
            state.got ? <b>Freigeschaltet</b> : (
              <>
                <span>Fortschritt {state.progress ?? 0}/{state.target}</span>
                <span className="ci-bar"><motion.i initial={{ width: 0 }} animate={{ width: `${((state.progress ?? 0) / (state.target ?? 1)) * 100}%` }}
                  transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1], delay: 0.2 }} /></span>
              </>
            )
          ) : state.got ? (
            <><b>{state.visits.length}× {card.kind === 'stadium' ? 'besucht' : 'live gesehen'}</b>{first && <span>seit {formatDayMedium(first)}</span>}</>
          ) : (
            <><b>Noch nicht gesammelt</b>{nextMatch && <span>Nächste Chance: {nextMatch.label}</span>}</>
          )}
        </div>
      </div>
    </div>
  )
}
