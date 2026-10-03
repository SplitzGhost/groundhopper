// Sammelalbum: Sammler-Pass mit Level, der Sammelkarten-Ordner mit allen besuchten Spielen
// und Listen zum Vervollständigen – Vereine und Stadien je Land, Ligen, Derbys, Erfolge.

import { useEffect, useMemo, type ReactNode } from 'react'
import { motion, useSpring, useTransform } from 'motion/react'
import { ChevronRight, Swords, Trophy } from 'lucide-react'
import { collect, levelOf, TEAM_NAMES, type Collection } from '../lib/album.ts'
import { CLUB_LISTS, STADIUM_LISTS, leagueOfList, listInfo, type ListId } from '../lib/lists.ts'
import { leagueByCode } from '../shared/leagues.ts'
import { leagueLogo } from '../lib/crests.ts'
import { useUserData } from '../state/userData.ts'
import { useCards } from '../state/cards.ts'
import { useRevealed } from '../state/revealed.ts'
import { openBinder, openList, tabStore } from '../state/ui.ts'
import { ScreenScaffold } from '../components/ScreenScaffold.tsx'
import { ProfileButton } from '../components/ProfileButton.tsx'
import { Flag } from '../components/Flag.tsx'
import { CardsIcon, StadiumIcon } from '../components/icons.tsx'
import { CardReverse, MatchCardFront } from '../components/cards/MatchCard.tsx'
import { CardStrip } from '../components/cards/CardStrip.tsx'
import { PillButton } from '../components/ui.tsx'

export function AlbumScreen() {
  const data = useUserData()
  const c = useMemo(() => collect(data.visits), [data.visits])
  const level = levelOf(c.points)
  const clubsSeen = [...c.clubs.keys()].filter((n) => TEAM_NAMES.has(n)).length
  const cards = useCards()
  const recent = useMemo(() => [...cards].reverse().slice(0, 10), [cards])

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

      <SectionHead title="Sammelordner" />
      <BinderCover />

      {recent.length > 0 ? (
        <>
          <SectionHead title="Zuletzt gesammelt" />
          <CardStrip cards={recent} />
        </>
      ) : (
        <motion.div className="album-empty" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="album-empty-fan" aria-hidden>
            <CardReverse /><CardReverse /><CardReverse />
          </div>
          <div>
            <b>Deine erste Karte wartet</b>
            <p>Hake im Spielplan ein Spiel ab, bei dem du im Stadion warst – dafür gibt es eine Karte mit Endstand und Spielbericht.</p>
            <PillButton small tint onClick={() => tabStore.set('games')}>Zum Spielplan</PillButton>
          </div>
        </motion.div>
      )}

      <SectionHead title="Vereine" hint="Jedes Land eine Liste" />
      <div className="list-tiles">
        {CLUB_LISTS.map((id, i) => <ListTile key={id} id={id} c={c} index={i} />)}
      </div>

      <SectionHead title="Stadien" hint="Alle Grounds abhaken" />
      <div className="list-tiles">
        {STADIUM_LISTS.map((id, i) => <ListTile key={id} id={id} c={c} index={i} />)}
      </div>

      <SectionHead title="Weitere Listen" />
      <div className="more-lists">
        {(['leagues', 'derbies', 'achievements'] as ListId[]).map((id, i) => <MoreTile key={id} id={id} c={c} index={i} />)}
      </div>
    </ScreenScaffold>
  )
}

function SectionHead({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="section-head">
      <h2 className="section-title">{title}</h2>
      {hint && <span className="section-hint">{hint}</span>}
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

/** Einband des Ordners – oben schauen die neuesten Karten heraus */
function BinderCover() {
  const cards = useCards()
  const revealed = useRevealed()
  const fan = useMemo(() => [...cards].reverse().filter((c) => revealed.has(c.id)).slice(0, 3), [cards, revealed])
  const unseen = cards.filter((c) => !revealed.has(c.id)).length

  return (
    <motion.button type="button" className="bcover" onClick={openBinder}
      initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28, delay: 0.06 }}
      whileTap={{ scale: 0.97 }}>
      <div className="bcover-fan" aria-hidden>
        {[0, 1, 2].map((k) => (
          <div key={k} className={`bcover-card k${k}`}>
            {fan[k] ? <MatchCardFront card={fan[k]} /> : <CardReverse />}
          </div>
        ))}
      </div>
      <div className="bcover-book">
        <span className="bcover-spine" />
        <span className="bcover-stitch" />
        <span className="bcover-icon"><CardsIcon size={24} /></span>
        <div className="bcover-text">
          <b>Mein Ordner</b>
          <span className="tnum">{cards.length} {cards.length === 1 ? 'Spielkarte' : 'Spielkarten'}</span>
        </div>
        <span className="bcover-open">Aufschlagen <ChevronRight size={15} strokeWidth={2.8} /></span>
      </div>
      {unseen > 0 && (
        <motion.span className="cover-badge" initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 18, delay: 0.4 }}>
          {unseen} neu
        </motion.span>
      )}
    </motion.button>
  )
}

function Progress({ got, total, delay = 0 }: { got: number; total: number; delay?: number }) {
  return (
    <span className={`tile-bar ${got === total && total > 0 ? 'done' : ''}`}>
      <motion.i initial={{ width: 0 }} whileInView={{ width: `${total ? (got / total) * 100 : 0}%` }} viewport={{ once: true }}
        transition={{ duration: 0.9, ease: [0.32, 0.72, 0, 1], delay }} />
    </span>
  )
}

function ListTile({ id, c, index }: { id: ListId; c: Collection; index: number }) {
  const info = listInfo(id, c)
  const code = leagueOfList(id)!
  const league = leagueByCode(code)
  const isClubs = id.startsWith('clubs')
  return (
    <motion.button type="button" className="ltile" onClick={() => openList(id)}
      initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
      transition={{ type: 'spring', stiffness: 380, damping: 30, delay: index * 0.04 }}
      whileTap={{ scale: 0.95 }}>
      <div className="ltile-top">
        <Flag code={league.countryCode} size={20} />
        <span className="ltile-icon">{isClubs ? <img src={leagueLogo(code)} alt="" /> : <StadiumIcon size={18} />}</span>
      </div>
      <b className="ltile-title">{info.title}</b>
      <span className="ltile-sub truncate">{league.name}</span>
      <span className="ltile-count tnum"><b>{info.got}</b>/{info.total}</span>
      <Progress got={info.got} total={info.total} delay={0.1 + index * 0.05} />
    </motion.button>
  )
}

const MORE_ICON: Record<string, ReactNode> = {
  leagues: <Trophy size={20} strokeWidth={2.3} />,
  derbies: <Swords size={20} strokeWidth={2.3} />,
  achievements: <CardsIcon size={21} />,
}

function MoreTile({ id, c, index }: { id: ListId; c: Collection; index: number }) {
  const info = listInfo(id, c)
  return (
    <motion.button type="button" className={`mtile mtile-${id}`} onClick={() => openList(id)}
      initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
      transition={{ type: 'spring', stiffness: 380, damping: 30, delay: index * 0.05 }}
      whileTap={{ scale: 0.95 }}>
      <span className="mtile-icon">{MORE_ICON[id]}</span>
      <b>{info.title}</b>
      <span className="tnum">{info.got}/{info.total}</span>
      <Progress got={info.got} total={info.total} delay={0.15 + index * 0.05} />
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
