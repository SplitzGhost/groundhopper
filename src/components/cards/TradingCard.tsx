// Sammelkarten im Stil eines Kartenspiels: Vorderseite je Kartentyp, Kartenrücken und
// leerer Platz im Album. Alle Maße skalieren mit der Kartenbreite (Container-Einheiten).

import { memo, useState, type CSSProperties, type ReactNode } from 'react'
import { Lock, Users } from 'lucide-react'
import { cardColors, cardNo, type Card } from '../../lib/cards.ts'
import { RARITY_LABEL, stadiumSpec, type Rarity } from '../../data/stadiumInfo.ts'
import { clubInfo } from '../../data/clubs.ts'
import { leagueByCode } from '../../shared/leagues.ts'
import { crestFor } from '../../lib/crests.ts'
import { StadiumArt } from '../StadiumArt.tsx'
import { Flag } from '../Flag.tsx'
import { AchievementIcon } from '../AchievementIcon.tsx'
import { StadiumIcon } from '../icons.tsx'

function Pips({ rarity }: { rarity: Rarity }) {
  const n = { common: 1, rare: 2, epic: 3, legendary: 4 }[rarity]
  return <span className="tc-pips" aria-label={RARITY_LABEL[rarity]}>{Array.from({ length: n }, (_, i) => <i key={i} />)}</span>
}

// ---------- Wappen ----------

/** Vereinswappen auf heller Scheibe; gesperrt nur als grauer Schattenriss */
const Logo = memo(function Logo({ club, locked, className = '' }: { club: string; locked: boolean; className?: string }) {
  const src = crestFor(club, 'lg')
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  return (
    <span className={`tc-logo ${locked ? 'silhouette' : ''} ${className}`}>
      {src && !failed
        ? <img src={src} alt="" draggable={false} decoding="async" className={loaded ? 'loaded' : ''}
            onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />
        : <b>{clubInfo(club).short}</b>}
    </span>
  )
})

// ---------- Bildfeld je Kartentyp ----------

function CardArt({ card, locked }: { card: Card; locked: boolean }) {
  switch (card.kind) {
    case 'stadium':
      return <StadiumArt stadiumId={card.stadium.id} mono={locked} className="tc-art-svg" />
    case 'club':
      return <Logo club={card.club} locked={locked} />
    case 'derby':
      return (
        <div className="tc-derby">
          <Logo club={card.derby.teams[0]} locked={locked} className="left" />
          <Logo club={card.derby.teams[1]} locked={locked} className="right" />
          <span className="tc-vs">VS</span>
        </div>
      )
    case 'achievement':
      return (
        <span className="tc-ach-icon">
          <AchievementIcon id={card.achievement.id} size={34} strokeWidth={2} />
        </span>
      )
  }
}

function footer(card: Card): [ReactNode, ReactNode] {
  switch (card.kind) {
    case 'stadium':
      return [card.stadium.city, <><Users size={11} strokeWidth={2.6} />{stadiumSpec(card.stadium.id).capacity.toLocaleString('de-DE')}</>]
    case 'club': {
      const c = clubInfo(card.club)
      return [c.nickname || card.stadium.city, c.founded ? `seit ${c.founded}` : '']
    }
    case 'derby':
      return [card.subtitle, '']
    case 'achievement':
      return [card.subtitle, '']
  }
}

// ---------- Vorderseite ----------

interface FrontProps {
  card: Card
  /** Noch nicht gesammelt: graue Modellansicht */
  locked?: boolean
  className?: string
  style?: CSSProperties
}

export const CardFront = memo(function CardFront({ card, locked = false, className = '', style }: FrontProps) {
  const [c1, c2] = cardColors(card)
  const league = card.league ? leagueByCode(card.league) : null
  const [left, right] = footer(card)
  return (
    <div className={`tc tc-${card.kind} tc-r-${card.rarity} ${locked ? 'tc-locked' : ''} ${className}`}
      style={{ '--c1': c1, '--c2': c2, ...style } as CSSProperties}>
      <div className="tc-face">
        <div className="tc-head">
          <span className="tc-title">{card.title}</span>
          {league ? <Flag code={league.countryCode} size={9} /> : <Pips rarity={card.rarity} />}
        </div>
        <div className="tc-art">
          <CardArt card={card} locked={locked} />
          {locked && <span className="tc-lock"><Lock size={12} strokeWidth={2.6} /></span>}
        </div>
        <div className="tc-foot">
          <span className="tc-sub">{left}</span>
          {right && <span className="tc-stat">{right}</span>}
        </div>
        <div className="tc-meta">
          <span className="tc-num">{cardNo(card.number)}</span>
          <span className="tc-rarity-label">{RARITY_LABEL[card.rarity]}</span>
          <Pips rarity={card.rarity} />
        </div>
      </div>
      {!locked && (card.rarity === 'epic' || card.rarity === 'legendary') && <span className="tc-holo" />}
      <span className="tc-glare" />
    </div>
  )
})

// ---------- Rückseite (verdeckt) ----------

export function CardReverse({ className = '', isNew = false }: { className?: string; isNew?: boolean }) {
  return (
    <div className={`tc tc-reverse ${className}`}>
      <div className="tc-reverse-face">
        <span className="tc-reverse-ring">
          <StadiumIcon size={26} />
        </span>
        <span className="tc-reverse-word">Groundhopper</span>
        {isNew && <span className="tc-new">Neu</span>}
      </div>
      <span className="tc-glare" />
    </div>
  )
}

// ---------- Leerer Platz im Album ----------

export const CardSlot = memo(function CardSlot({ card }: { card: Card }) {
  return (
    <div className="tc-slot">
      <span className="tc-slot-num">{cardNo(card.number)}</span>
      <div className="tc-slot-art">
        {card.kind === 'stadium'
          ? <StadiumArt stadiumId={card.stadium.id} mono size="sm" className="tc-art-svg" />
          : card.kind === 'achievement'
            ? <AchievementIcon id={card.achievement.id} size={26} strokeWidth={1.8} />
            : <Logo club={card.kind === 'club' ? card.club : card.derby.teams[0]} locked />}
      </div>
      <span className="tc-slot-name">{card.title}</span>
    </div>
  )
})
