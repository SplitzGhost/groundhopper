// Spielkarte: vorne beide Wappen auf einer diagonal geteilten Fläche in Vereinsfarben, der
// Endstand als Anzeigetafel genau auf der Naht, Extras als Plaketten. Hinten der Spielbericht
// mit 3D-Stadion, Zuschauern und Torticker. Alle Maße skalieren mit der Kartenbreite (cqw).

import { memo, useState, type CSSProperties, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { Award, Flame, Info, Lightbulb, PartyPopper, Snowflake, Timer, TrendingUp, Users } from 'lucide-react'
import type { LeagueCode, MatchEvent } from '../../shared/types.ts'
import { cardNo, shortClub, type Extra, type ExtraId, type MatchCard } from '../../lib/matchCards.ts'
import { crestFor, leagueLogo, type CrestSize } from '../../lib/crests.ts'
import { clubInfo } from '../../data/clubs.ts'
import { keyToDate } from '../../lib/dates.ts'
import { stadiumSpec } from '../../data/stadiumInfo.ts'
import { StadiumArt } from '../StadiumArt.tsx'
import { StadiumIcon, WhistleIcon } from '../icons.tsx'
import { useCrew, type CrewMember } from '../../state/crew.ts'
import { CardCrew } from './CardCrew.tsx'

const dateFmt = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
export const cardDate = (c: MatchCard) => dateFmt.format(keyToDate(c.visit.date))

const EXTRA_ICON: Record<ExtraId, ReactNode> = {
  derby: <Flame strokeWidth={2.6} />,
  newGround: <StadiumIcon />,
  goalfest: <PartyPopper strokeWidth={2.4} />,
  nil: <Snowflake strokeWidth={2.4} />,
  floodlight: <Lightbulb strokeWidth={2.4} />,
  comeback: <TrendingUp strokeWidth={2.6} />,
  late: <Timer strokeWidth={2.4} />,
  hattrick: <Award strokeWidth={2.4} />,
  red: <i className="mc-redcard" />,
}

export function ExtraBadge({ extra, label = true }: { extra: Extra; label?: boolean }) {
  return (
    <span className={`mc-extra x-${extra.id}`}>
      {EXTRA_ICON[extra.id]}
      {label && <span>{extra.label}</span>}
    </span>
  )
}

/** Schon einmal geladene Wappen erscheinen sofort – sonst blinken sie bei jedem Umblättern neu ein */
const loadedCrests = new Set<string>()

/** ESPN-Vorschaubild (168 px) gegen die volle Auflösung tauschen */
const fullSize = (src: string | null | undefined) =>
  src?.replace(/^https:\/\/a\.espncdn\.com\/combiner\/i\?img=(\/i\/teamlogos\/[^&]+)&.*$/, 'https://a.espncdn.com$1')

/** Wappen auf heller Scheibe; ohne Bild das Vereinskürzel */
const CardCrest = memo(function CardCrest({ club, size, className, league, saved }: {
  club: string; size: CrestSize; className: string; league: LeagueCode | null; saved?: string | null
}) {
  // Vereine außerhalb der Datenbank: das beim Abhaken gespeicherte Wappen aus dem Spielplan
  const src = crestFor(club, size, league ?? undefined) ?? (size === 'lg' ? fullSize(saved) : saved) ?? null
  const [loaded, setLoaded] = useState(() => !!src && loadedCrests.has(src))
  const [failed, setFailed] = useState(false)
  return (
    <span className={`mc-crest ${className}`}>
      {src && !failed
        ? <img src={src} alt="" draggable={false} decoding={loaded ? "sync" : "async"} className={loaded ? 'loaded' : ''}
            onLoad={() => { loadedCrests.add(src); setLoaded(true) }} onError={() => setFailed(true)} />
        : <b>{clubInfo(club).short}</b>}
    </span>
  )
})

const cardVars = (c: MatchCard, style?: CSSProperties) =>
  ({ '--home': c.colors.home, '--away': c.colors.away, '--n': c.number, ...style }) as CSSProperties

/** Aufsteigende Funken auf Derbykarten – Position und Takt kommen aus cards.css */
const EMBERS = Array.from({ length: 12 }, (_, i) => <i key={i} />)

// ---------- Vorderseite ----------

interface FrontProps {
  card: MatchCard
  /** lg = volle Wappenauflösung für die große Ansicht */
  size?: CrestSize
  className?: string
  style?: CSSProperties
  /** Benutzername, wenn es die Karte eines Freundes ist (für die Hopper auf der Karte) */
  owner?: string
  /** Feste Hopper statt der echten (Vorschau im Editor) */
  crew?: CrewMember[]
}

export const MatchCardFront = memo(function MatchCardFront({ card, size = 'sm', className = '', style, owner, crew: fixedCrew }: FrontProps) {
  const v = card.visit
  const realCrew = useCrew(card.id, owner)
  const crew = fixedCrew ?? realCrew
  const hasScore = v.homeScore !== null && v.awayScore !== null
  const extras = card.extras.filter((x) => x.id !== 'derby')
  const special = !!card.derby || card.extras.some((x) => x.id === 'hattrick' || x.id === 'late' || x.id === 'comeback')
  return (
    <div className={`mc ${card.derby ? 'is-derby' : ''} ${special ? 'is-special' : ''} ${crew.length ? 'has-crew' : ''} ${className}`} style={cardVars(card, style)}>
      <div className="mc-face">
        <div className="mc-top">
          {card.league
            ? <img className="mc-league" src={leagueLogo(card.league)} alt="" draggable={false} />
            : <span className="mc-league mc-league-none" />}
          <span className="mc-comp">{card.competition}</span>
          <span className="mc-no">{cardNo(card.number)}</span>
        </div>

        <div className="mc-art">
          <span className="mc-half home" />
          <span className="mc-half away" />
          {card.derby && <span className="mc-heat" />}
          <CardCrest club={card.home} size={size} className="home" league={card.league} saved={v.homeCrest} />
          <CardCrest club={card.away} size={size} className="away" league={card.league} saved={v.awayCrest} />
          <span className="mc-shine" />
          {card.derby && <span className="mc-embers">{EMBERS}</span>}
          {crew.length > 0 && <CardCrew crew={crew} large={size === 'lg'} />}
          <div className="mc-board">
            <div className="mc-score tnum">
              <b>{hasScore ? v.homeScore : '–'}</b><i>:</i><b>{hasScore ? v.awayScore : '–'}</b>
            </div>
            {v.halfTime && <div className="mc-ht tnum">HZ {v.halfTime[0]}:{v.halfTime[1]}</div>}
          </div>
          {card.derby && (
            <div className="mc-ribbon"><Flame strokeWidth={2.8} />{card.derby.name}</div>
          )}
          {extras.length > 0 && (
            <div className="mc-extras">{extras.slice(0, 3).map((x) => <ExtraBadge key={x.id} extra={x} label={false} />)}</div>
          )}
        </div>

        <div className="mc-names">
          <span><i style={{ background: card.colors.home }} /><em>{shortClub(card.home)}</em></span>
          <span><i style={{ background: card.colors.away }} /><em>{shortClub(card.away)}</em></span>
        </div>
        <div className="mc-foot">
          <span className="tnum">{cardDate(card)}</span>
          {card.ground && <span className="truncate">{card.ground}</span>}
        </div>
      </div>
      {special && <span className="mc-foil" />}
      <span className="mc-glare" />
    </div>
  )
})

// ---------- Rückseite: Spielbericht ----------

function TickerRow({ e, score, i }: { e: MatchEvent; score: [number, number] | null; i: number }) {
  return (
    <motion.div className={`mcb-event ${e.side}`} initial={{ opacity: 0, x: e.side === 'home' ? -6 : 6 }} animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32, delay: 0.1 + i * 0.04 }}>
      <span className="mcb-min tnum">{e.minute}</span>
      <span className={`mcb-kind k-${e.kind}`}>{e.kind === 'red' ? <i className="mc-redcard" /> : '⚽'}</span>
      <span className="mcb-player truncate">
        {e.player}
        {e.kind === 'penalty' && <small> (E)</small>}
        {e.kind === 'own' && <small> (ET)</small>}
      </span>
      {score && <span className="mcb-run tnum">{score[0]}:{score[1]}</span>}
    </motion.div>
  )
}

export function MatchCardBack({ card, onMore, loading }: { card: MatchCard; onMore?: () => void; loading?: boolean }) {
  const v = card.visit
  const d = v.details
  const events = d?.found ? d.events : []
  let h = 0
  let a = 0
  const rows = events.map((e) => {
    if (e.kind === 'red') return { e, score: null }
    if (e.side === 'home') h++
    else a++
    return { e, score: [h, a] as [number, number] }
  })
  const MAX = 7

  return (
    <div className="mc mc-backside" style={cardVars(card)}>
      <div className="mc-face mcb">
        <div className="mcb-head">
          <div>
            <b>Spielbericht</b>
            <span className="tnum">{cardNo(card.number)} · {cardDate(card)}</span>
          </div>
          {onMore && (
            <button type="button" className="mcb-morebtn" onClick={onMore}>
              <Info strokeWidth={2.6} /> Mehr
            </button>
          )}
        </div>

        <div className="mcb-stadium">
          {card.stadium
            ? <StadiumArt stadiumId={card.stadium.id} className="mcb-art" />
            : <span className="mcb-art mcb-art-none"><StadiumIcon size={34} /></span>}
          <div className="mcb-ground">
            <b className="truncate">{card.ground ?? 'Unbekanntes Stadion'}</b>
            <span>{card.stadium?.city ?? v.customStadium?.city ?? ''}</span>
          </div>
        </div>

        <div className="mcb-facts">
          {d?.attendance || !card.stadium || !stadiumSpec(card.stadium.id).capacity
            ? <span><Users strokeWidth={2.4} /><b className="tnum">{d?.attendance ? d.attendance.toLocaleString('de-DE') : '–'}</b><small>Zuschauer</small></span>
            : <span><Users strokeWidth={2.4} /><b className="tnum">{stadiumSpec(card.stadium.id).capacity.toLocaleString('de-DE')}</b><small>Plätze im Stadion</small></span>}
          <span><WhistleIcon /><b className="truncate">{d?.referee ?? '–'}</b><small>Schiedsrichter</small></span>
        </div>

        <div className="mcb-ticker">
          <div className="mcb-ticker-head">
            <span>{shortClub(card.home)}</span>
            <b className="tnum">{v.homeScore ?? '–'}:{v.awayScore ?? '–'}</b>
            <span>{shortClub(card.away)}</span>
          </div>
          {rows.length > 0 ? (
            <>
              {rows.slice(0, MAX).map((r, i) => <TickerRow key={i} e={r.e} score={r.score} i={i} />)}
              {rows.length > MAX && <div className="mcb-more-rows">+ {rows.length - MAX} weitere</div>}
            </>
          ) : (
            <div className="mcb-empty">
              {loading ? <span className="spinner" /> : d?.found ? (v.homeScore === 0 && v.awayScore === 0 ? 'Keine Tore – dafür viel Spannung.' : 'Keine Torschützen gemeldet.') : 'Für dieses Spiel gibt es keinen Ticker.'}
            </div>
          )}
        </div>

      </div>
      <span className="mc-glare" />
    </div>
  )
}

// ---------- Verdeckt ----------

export function CardReverse({ className = '', isNew = false }: { className?: string; isNew?: boolean }) {
  return (
    <div className={`mc mc-reverse ${className}`}>
      <div className="mc-reverse-face">
        <span className="mc-reverse-ring"><StadiumIcon /></span>
        <span className="mc-reverse-word">Groundhopper</span>
        {isNew && <span className="mc-new">Neu</span>}
      </div>
      <span className="mc-glare" />
    </div>
  )
}
