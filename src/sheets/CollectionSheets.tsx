// Detailansichten aus den Sammellisten: Verein, Liga und Derby – jeweils mit Infos und den
// eigenen Spielkarten, die dazugehören.

import { useMemo, type CSSProperties, type ReactNode } from 'react'
import { motion } from '../lib/fastMotion.tsx'
import { CalendarDays, ChevronRight, Flame, Hash, Lock, Palette, Shield } from 'lucide-react'
import type { LeagueCode, Match } from '../shared/types.ts'
import { leagueByCode } from '../shared/leagues.ts'
import { canonicalTeam, collect } from '../lib/album.ts'
import { DERBIES } from '../lib/derbies.ts'
import { clubInfo } from '../data/clubs.ts'
import { crestFor, leagueLogo } from '../lib/crests.ts'
import { findTeam, stadiumById, stadiumsOfLeague } from '../lib/stadiums.ts'
import { clubsOfLeague } from '../lib/lists.ts'
import { cardsOfClub, shortClub, type MatchCard } from '../lib/matchCards.ts'
import { formatDayFriendly, localDateKey } from '../lib/dates.ts'
import { hasStarted } from '../lib/matchState.ts'
import { useMatches } from '../state/matches.ts'
import { useUserData } from '../state/userData.ts'
import { useCards } from '../state/cards.ts'
import { openSheet } from '../state/ui.ts'
import { Sheet } from '../components/Sheet.tsx'
import { ProgressRing } from '../components/ui.tsx'
import { CardStrip } from '../components/cards/CardStrip.tsx'
import { StadiumThumb } from '../components/StadiumThumb.tsx'
import { Flag } from '../components/Flag.tsx'

// ---------- Bausteine ----------

function Hero({ children, colors, got }: { children: ReactNode; colors: [string, string]; got: boolean }) {
  return (
    <motion.div className={`coll-hero ${got ? 'got' : ''}`} style={{ '--c1': colors[0], '--c2': colors[1] } as CSSProperties}
      initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 320, damping: 28 }}>
      {children}
    </motion.div>
  )
}

function Facts({ rows }: { rows: [ReactNode, string, ReactNode][] }) {
  if (!rows.length) return null
  return (
    <div className="card inset list coll-facts">
      {rows.map(([icon, label, value], i) => (
        <motion.div key={label} className="list-row" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 32, delay: 0.1 + i * 0.04 }}>
          <span className="coll-fact-icon">{icon}</span>
          <span className="row-main muted">{label}</span>
          <span className="coll-fact-value">{value}</span>
        </motion.div>
      ))}
    </div>
  )
}

function YourCards({ cards, empty }: { cards: MatchCard[]; empty: string }) {
  return (
    <>
      <div className="section-head"><h3 className="section-title">Deine Karten{cards.length > 0 && <b>{cards.length}</b>}</h3></div>
      {cards.length
        ? <CardStrip cards={[...cards].reverse()} className="in-sheet" />
        : <p className="sheet-pad muted coll-empty"><Lock size={14} strokeWidth={2.6} /> {empty}</p>}
    </>
  )
}

function NextMatch({ match, label = 'Nächste Chance' }: { match: Match | undefined; label?: string }) {
  if (!match) return null
  return (
    <>
      <div className="section-head"><h3 className="section-title">{label}</h3></div>
      <button type="button" className="card inset list-row row-press pressable" style={{ width: 'calc(100% - 32px)' }}
        onClick={() => openSheet({ kind: 'match', id: match.id })}>
        <CalendarDays size={20} style={{ color: 'var(--accent)' }} />
        <div className="row-main">
          <div className="row-title truncate">{match.home.shortName} – {match.away.shortName}</div>
          <div className="row-sub">{formatDayFriendly(localDateKey(match.kickoff))} · {stadiumById(match.stadiumId)?.name ?? ''}</div>
        </div>
        <ChevronRight size={20} className="dim" />
      </button>
    </>
  )
}

/** Bilanz aus Sicht eines Vereins in den eigenen Spielen */
function record(cards: MatchCard[], club: string) {
  let w = 0, d = 0, l = 0
  for (const c of cards) {
    const { homeScore: h, awayScore: a } = c.visit
    if (h === null || a === null) continue
    const own = c.home === club ? h : a
    const other = c.home === club ? a : h
    if (own > other) w++
    else if (own === other) d++
    else l++
  }
  return { w, d, l }
}

// ---------- Verein ----------

export function ClubSheet({ name }: { name: string }) {
  const matches = useMatches()
  const data = useUserData()
  const cards = cardsOfClub(useCards(), name)
  const info = clubInfo(name)
  const team = findTeam(name)
  const stadium = stadiumById(team?.stadiumId)
  const leagueCode = stadium?.teams.find((t) => t.name === name)?.league
  const league = leagueCode ? leagueByCode(leagueCode) : null
  const derbies = DERBIES.filter((d) => d.teams.includes(name))
  const got = cards.length > 0
  const next = matches.matches.find((m) => !hasStarted(m)
    && (canonicalTeam(m.home.name, m.league) === name || canonicalTeam(m.away.name, m.league) === name))
  const r = record(cards, name)

  const rows: [ReactNode, string, ReactNode][] = []
  if (info.founded) rows.push([<CalendarDays key="i" size={16} />, 'Gegründet', info.founded])
  if (info.nickname) rows.push([<Hash key="i" size={16} />, 'Spitzname', info.nickname])
  rows.push([<Palette key="i" size={16} />, 'Farben', <span key="v" className="coll-swatches"><i style={{ background: info.primary }} /><i style={{ background: info.secondary }} /></span>])
  if (derbies.length) rows.push([<Flame key="i" size={16} />, 'Derbys', derbies.map((d) => d.name).join(', ')])

  return (
    <Sheet title={league ? <span className="title-flag"><Flag code={league.countryCode} size={14} />{league.name}</span> : 'Verein'}>
      <Hero colors={[info.primary, info.secondary]} got={got}>
        <motion.img className="coll-crest" src={crestFor(name, 'lg') ?? undefined} alt="" draggable={false}
          initial={{ scale: 0.4, rotate: -20, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 16, delay: 0.05 }} />
        <b className="coll-name">{name}</b>
        <span className="coll-tag">{got ? `${cards.length}× live gesehen` : <><Lock size={11} strokeWidth={2.8} /> Noch nicht live gesehen</>}</span>
      </Hero>

      {got && (
        <div className="coll-record">
          {([['Siege', r.w, 'w'], ['Remis', r.d, 'd'], ['Niederlagen', r.l, 'l']] as const).map(([label, n, k], i) => (
            <motion.div key={k} className={`coll-record-item ${k}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 28, delay: 0.12 + i * 0.05 }}>
              <b className="tnum">{n}</b><span>{label}</span>
            </motion.div>
          ))}
        </div>
      )}

      {stadium && (
        <button type="button" className="card inset list-row row-press pressable" style={{ width: 'calc(100% - 32px)', marginTop: 14 }}
          onClick={() => openSheet({ kind: 'stadium', id: stadium.id })}>
          <StadiumThumb stadiumId={stadium.id} collected={data.visits.some((v) => v.stadiumId === stadium.id)} />
          <div className="row-main">
            <div className="row-title truncate">{stadium.name}</div>
            <div className="row-sub">Heimstadion · {stadium.city}</div>
          </div>
          <ChevronRight size={20} className="dim" />
        </button>
      )}

      <div style={{ height: 14 }} />
      <Facts rows={rows} />
      <YourCards cards={cards} empty="Sobald du ein Spiel dieses Vereins abhakst, landet die Karte hier." />
      <NextMatch match={next} label={got ? 'Nächstes Spiel' : 'Nächste Chance'} />
    </Sheet>
  )
}

// ---------- Liga ----------

export function LeagueSheet({ code }: { code: LeagueCode }) {
  const data = useUserData()
  const c = useMemo(() => collect(data.visits), [data.visits])
  const league = leagueByCode(code)
  const cards = useCards().filter((x) => x.league === code)
  const grounds = stadiumsOfLeague(code)
  const clubs = clubsOfLeague(code)
  const gotGrounds = grounds.filter((s) => c.stadiums.has(s.id)).length
  const gotClubs = clubs.filter((x) => c.clubs.has(x.name)).length

  return (
    <Sheet title={league.name}>
      <Hero colors={['#0a7cff', '#5ac8fa']} got={cards.length > 0}>
        <motion.img className="coll-crest coll-league" src={leagueLogo(code)} alt="" draggable={false}
          initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }} />
        <span className="coll-tag"><Flag code={league.countryCode} size={11} /> {league.country}</span>
      </Hero>
      <div className="coll-rings">
        {([['Stadien', gotGrounds, grounds.length], ['Vereine', gotClubs, clubs.length], ['Spiele', cards.length, 0]] as const).map(([label, got, total]) => (
          <div key={label} className="coll-ring">
            <ProgressRing value={total ? got / total : got ? 1 : 0} size={70} stroke={6}>
              <b className="tnum">{got}</b>
            </ProgressRing>
            <span>{label}{total ? <small className="tnum"> von {total}</small> : null}</span>
          </div>
        ))}
      </div>
      <YourCards cards={cards} empty={`Noch kein Spiel aus der ${league.name} abgehakt.`} />
      <div style={{ height: 8 }} />
    </Sheet>
  )
}

// ---------- Derby ----------

export function DerbySheet({ id }: { id: string }) {
  const derby = DERBIES.find((d) => d.id === id)!
  const matches = useMatches()
  const [a, b] = derby.teams
  const cards = useCards().filter((x) => x.derby?.id === id)
  const next = matches.matches.find((m) => !hasStarted(m)
    && [canonicalTeam(m.home.name, m.league), canonicalTeam(m.away.name, m.league)].sort().join() === [a, b].sort().join())
  const league = leagueByCode(derby.league)

  return (
    <Sheet title={<span className="title-flag"><Flag code={league.countryCode} size={14} />{league.name}</span>}>
      <Hero colors={[clubInfo(a).primary, clubInfo(b).primary]} got={cards.length > 0}>
        <div className="coll-duel">
          <motion.img src={crestFor(a, 'lg') ?? undefined} alt="" draggable={false}
            initial={{ x: -40, opacity: 0, rotate: -15 }} animate={{ x: 0, opacity: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 16 }} />
          <motion.span className="coll-vs" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 14, delay: 0.2 }}>
            <Flame size={18} strokeWidth={2.8} />
          </motion.span>
          <motion.img src={crestFor(b, 'lg') ?? undefined} alt="" draggable={false}
            initial={{ x: 40, opacity: 0, rotate: 15 }} animate={{ x: 0, opacity: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 16 }} />
        </div>
        <b className="coll-name">{derby.name}</b>
        <span className="coll-tag">{cards.length ? `${cards.length}× live erlebt` : <><Lock size={11} strokeWidth={2.8} /> Noch nicht erlebt</>}</span>
      </Hero>
      <Facts rows={[
        [<Shield key="i" size={16} />, 'Paarung', `${shortClub(a)} – ${shortClub(b)}`],
        [<Flame key="i" size={16} />, 'Liga', league.name],
      ]} />
      <YourCards cards={cards} empty="Erlebe das Duell im Stadion, dann bekommt die Karte eine Derby-Plakette." />
      <NextMatch match={next} label="Nächstes Duell" />
    </Sheet>
  )
}
