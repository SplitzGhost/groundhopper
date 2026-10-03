// Sammelalbum: Sammler-Pass mit Level, vier Alben (Stadien, Vereine, Derbys, Erfolge),
// zuletzt gesammelte Karten und Fortschritt je Liga.

import { useEffect, useMemo, type CSSProperties, type ReactNode } from 'react'
import { motion, useSpring, useTransform } from 'motion/react'
import { ChevronRight, Shield, Swords, Trophy } from 'lucide-react'
import { LEAGUES } from '../shared/leagues.ts'
import { TEAM_NAMES, collect, levelOf, type Collection } from '../lib/album.ts'
import { ALBUMS, albumProgress, cardsOf, pagesOf, recentCards, type AlbumDef, type Card } from '../lib/cards.ts'
import { stadiumsOfLeague } from '../lib/stadiums.ts'
import { useUserData } from '../state/userData.ts'
import { useRevealed } from '../state/revealed.ts'
import { flyingCardStore, openBinder, openCard, tabStore } from '../state/ui.ts'
import { ScreenScaffold } from '../components/ScreenScaffold.tsx'
import { ProfileButton } from '../components/ProfileButton.tsx'
import { Flag } from '../components/Flag.tsx'
import { StadiumIcon } from '../components/icons.tsx'
import { CardFront, CardReverse } from '../components/cards/TradingCard.tsx'
import { PillButton } from '../components/ui.tsx'

const ALBUM_ICONS: Record<string, ReactNode> = {
  stadiums: <StadiumIcon size={20} />,
  clubs: <Shield size={19} strokeWidth={2.2} />,
  derbies: <Swords size={19} strokeWidth={2.2} />,
  achievements: <Trophy size={19} strokeWidth={2.2} />,
}

export function AlbumScreen() {
  const data = useUserData()
  const c = useMemo(() => collect(data.visits), [data.visits])
  const level = levelOf(c.points)
  const clubsSeen = [...c.clubs.keys()].filter((n) => TEAM_NAMES.has(n)).length
  const recent = useMemo(() => recentCards(c), [c])
  const revealed = useRevealed()

  return (
    <ScreenScaffold title="Sammelalbum" actions={<ProfileButton />}>
      {/* Sammler-Pass */}
      <motion.div className="pass" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 28 }}>
        <div className="pass-top">
          <div className="pass-level">
            <svg viewBox="0 0 64 64" aria-hidden>
              <circle cx="32" cy="32" r="27" className="pass-track" />
              <motion.circle cx="32" cy="32" r="27" className="pass-fill" initial={{ pathLength: 0 }}
                animate={{ pathLength: Math.max(0.03, level.progress) }} transition={{ duration: 1.2, ease: [0.32, 0.72, 0, 1], delay: 0.15 }} />
            </svg>
            <span><small>Level</small><b className="tnum">{level.level}</b></span>
          </div>
          <div className="pass-main">
            <div className="pass-name">{level.name}</div>
            <div className="pass-points"><AnimatedNumber value={c.points} /> Punkte</div>
            <div className="pass-next">{level.next ? `Noch ${level.toNext} bis „${level.next}“` : 'Höchstes Level erreicht'}</div>
          </div>
        </div>
        <div className="pass-stats">
          <Stat value={data.visits.length} label="Spiele" />
          <Stat value={c.stadiums.size} label="Stadien" />
          <Stat value={clubsSeen} label="Vereine" />
          <Stat value={c.countries.size} label="Länder" />
        </div>
      </motion.div>

      <SectionHead title="Alben" />
      <div className="covers">
        {ALBUMS.map((a, i) => <AlbumCover key={a.id} album={a} c={c} revealed={revealed} index={i} />)}
      </div>

      {recent.length > 0 ? (
        <>
          <SectionHead title="Zuletzt gesammelt" />
          <div className="card-row">
            {recent.map((card, i) => <RecentCard key={card.id} card={card} isNew={!revealed.has(card.id)} index={i} />)}
          </div>
        </>
      ) : (
        <motion.div className="album-empty" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="album-empty-fan" aria-hidden>
            <CardReverse /><CardReverse /><CardReverse />
          </div>
          <div>
            <b>Deine erste Karte wartet</b>
            <p>Hake im Spielplan ein Spiel ab, bei dem du im Stadion warst – Stadion und Vereine landen als Karten im Album.</p>
            <PillButton small tint onClick={() => tabStore.set('games')}>Zum Spielplan</PillButton>
          </div>
        </motion.div>
      )}

      <SectionHead title="Ligen" />
      <div className="card inset list">
        {LEAGUES.map((l, i) => {
          const all = stadiumsOfLeague(l.code)
          const got = all.filter((s) => c.stadiums.has(s.id)).length
          const page = pagesOf('stadiums').findIndex((p) => p.league === l.code)
          return (
            <motion.button key={l.code} type="button" className="list-row league-row row-press"
              initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ type: 'spring', stiffness: 400, damping: 32, delay: i * 0.04 }}
              onClick={() => openBinder('stadiums', Math.max(0, page))}>
              <Flag code={l.countryCode} size={16} />
              <div className="row-main">
                <div className="league-row-top">
                  <span className="row-title">{l.name}</span>
                  <span className={`league-row-count tnum ${got === all.length ? 'done' : ''}`}>{got}/{all.length}</span>
                </div>
                <div className="league-bar">
                  <motion.i initial={{ width: 0 }} whileInView={{ width: `${(got / all.length) * 100}%` }} viewport={{ once: true }}
                    transition={{ duration: 0.9, ease: [0.32, 0.72, 0, 1], delay: 0.1 + i * 0.05 }} />
                </div>
              </div>
              <ChevronRight size={18} className="dim" />
            </motion.button>
          )
        })}
      </div>
    </ScreenScaffold>
  )
}

function SectionHead({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="section-head">
      <h2 className="section-title">{title}</h2>
      {children}
    </div>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="pass-stat">
      <b className="tnum"><AnimatedNumber value={value} /></b>
      <span>{label}</span>
    </div>
  )
}

function AlbumCover({ album, c, revealed, index }: { album: AlbumDef; c: Collection; revealed: Set<string>; index: number }) {
  const p = albumProgress(album.id, c)
  const newCount = p.gotCards.filter((card) => !revealed.has(card.id)).length
  // Drei Karten fächern oben aus dem Einband: die wertvollsten gesammelten, sonst Rückseiten
  const fan = useMemo(() => {
    const order = { legendary: 0, epic: 1, rare: 2, common: 3 }
    return [...p.gotCards].filter((card) => revealed.has(card.id)).sort((a, b) => order[a.rarity] - order[b.rarity]).slice(0, 3)
  }, [p.gotCards, revealed])
  const empty = cardsOf(album.id).length === 0

  return (
    <motion.button
      type="button"
      className="cover"
      style={{ '--album': album.color, '--album-deep': album.colorDeep } as CSSProperties}
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 360, damping: 28, delay: 0.05 + index * 0.05 }}
      whileTap={{ scale: 0.96 }}
      onClick={() => openBinder(album.id)}
      disabled={empty}
    >
      <div className="cover-fan" aria-hidden>
        {[0, 1, 2].map((k) => (
          <div key={k} className={`cover-fan-card k${k}`}>
            {fan[k] ? <CardFront card={fan[k]} /> : <CardReverse />}
          </div>
        ))}
      </div>
      <div className="cover-book">
        <span className="cover-spine" />
        <span className="cover-icon">{ALBUM_ICONS[album.id]}</span>
        <span className="cover-title">{album.title}</span>
        <span className="cover-count tnum">{p.got}<span>/{p.total}</span></span>
        <span className="cover-bar"><motion.i initial={{ width: 0 }} animate={{ width: `${(p.got / p.total) * 100}%` }}
          transition={{ duration: 1, ease: [0.32, 0.72, 0, 1], delay: 0.3 + index * 0.06 }} /></span>
      </div>
      {newCount > 0 && (
        <motion.span className="cover-badge" initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 18, delay: 0.4 + index * 0.05 }}>
          {newCount} neu
        </motion.span>
      )}
    </motion.button>
  )
}

function RecentCard({ card, isNew, index }: { card: Card; isNew: boolean; index: number }) {
  const flying = flyingCardStore.use() === card.id
  return (
    <motion.button type="button" className="card-row-item" data-card={card.id}
      style={{ visibility: flying ? 'hidden' : 'visible' }}
      initial={{ opacity: 0, x: 24, rotate: 3 }} animate={{ opacity: 1, x: 0, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 360, damping: 28, delay: 0.1 + Math.min(index, 6) * 0.05 }}
      whileTap={{ scale: 0.94 }}
      onClick={() => openCard(card.id, card.id)}>
      {isNew ? <CardReverse isNew /> : <CardFront card={card} />}
    </motion.button>
  )
}

/** Zahl, die weich zum neuen Wert hochzählt. */
function AnimatedNumber({ value }: { value: number }) {
  const spring = useSpring(0, { stiffness: 90, damping: 20 })
  const rounded = useTransform(spring, (v) => Math.round(v).toLocaleString('de-DE'))
  useEffect(() => {
    spring.set(value)
  }, [spring, value])
  return <motion.span>{rounded}</motion.span>
}

