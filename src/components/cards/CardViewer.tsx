// Vergrößerte Sammelkarte: fliegt aus dem Album in die Mitte, neigt sich unter dem Finger
// (Holo-Glanz folgt), Tippen dreht sie um – vorn Motiv, hinten Steckbrief.
// Neu gesammelte Karten kommen verdeckt an und werden beim ersten Tippen aufgedeckt.

import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import { CalendarDays, MapPin, RotateCcw, X } from 'lucide-react'
import { cardById, cardState, stadiumOfCard, type Card } from '../../lib/cards.ts'
import { collect } from '../../lib/album.ts'
import { useUserData } from '../../state/userData.ts'
import { useMatches } from '../../state/matches.ts'
import { reveal, useRevealed } from '../../state/revealed.ts'
import { cardViewStore, closeBinder, closeCard, flyingCardStore, focusMap, openSheet } from '../../state/ui.ts'
import { hasStarted } from '../../lib/matchState.ts'
import { GlassButton, PillButton } from '../ui.tsx'
import { StadiumIcon } from '../icons.tsx'
import { CardFront, CardReverse } from './TradingCard.tsx'
import { CardInfo } from './CardInfo.tsx'

export function CardViewer() {
  const view = cardViewStore.use()
  return (
    <AnimatePresence onExitComplete={() => flyingCardStore.set(null)}>
      {view && <Viewer key={view.cardId} cardId={view.cardId} />}
    </AnimatePresence>
  )
}

const RARITY_BURST: Record<Card['rarity'], string[]> = {
  common: ['#9fb4cc', '#ffffff'],
  rare: ['#3a96ff', '#9fd0ff'],
  epic: ['#a855f7', '#f0abfc', '#60a5fa'],
  legendary: ['#ffcf3f', '#ff9f0a', '#fff3b0'],
}

/** Ausgangsposition der Karte im Album relativ zur Mitte der Ansicht */
function sourceOffset(cardId: string, width: number) {
  const app = document.querySelector('.app')?.getBoundingClientRect()
  const src = document.querySelector(`[data-card="${CSS.escape(cardId)}"]`)?.getBoundingClientRect()
  if (!app || !src) return { x: 0, y: 60, scale: 0.6, opacity: 0 }
  const cx = app.left + app.width / 2
  const cy = app.top + app.height / 2 - 40
  return { x: src.left + src.width / 2 - cx, y: src.top + src.height / 2 - cy, scale: src.width / width, opacity: 1 }
}

type Side = 'reverse' | 'front' | 'info'

function Viewer({ cardId }: { cardId: string }) {
  const card = cardById(cardId)!
  const data = useUserData()
  const matches = useMatches()
  const c = useMemo(() => collect(data.visits), [data.visits])
  const state = cardState(card, c)
  const revealed = useRevealed()
  // Verdeckt nur, wenn die Karte beim Öffnen gesammelt, aber noch nicht aufgedeckt war
  const [hiddenAtOpen] = useState(() => state.got && !revealed.has(cardId))
  const [turn, setTurn] = useState(0)
  const [burst, setBurst] = useState(0)
  const [width] = useState(() => Math.min(300, (document.querySelector('.app')?.clientWidth ?? 390) * 0.76))
  const [from] = useState(() => sourceOffset(cardId, width))

  useEffect(() => {
    flyingCardStore.set(cardId)
  }, [cardId])

  // ---------- Neigen & Drehen ----------

  const rx = useSpring(0, { stiffness: 260, damping: 22 })
  const ry = useSpring(0, { stiffness: 260, damping: 22 })
  const flip = useSpring(0, { stiffness: 170, damping: 20, mass: 1 })
  const rotateY = useTransform(() => flip.get() + ry.get())
  const mx = useMotionValue(50)
  const my = useMotionValue(30)
  const holoX = useTransform(mx, (v) => `${v}%`)
  const holoY = useTransform(my, (v) => `${v}%`)
  const press = useRef<{ x: number; y: number; t: number } | null>(null)
  const touching = useRef(false)

  useEffect(() => {
    flip.set(turn * 180)
  }, [turn, flip])

  // Leichtes Schweben, solange niemand die Karte berührt – lässt den Holo-Glanz wandern
  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      if (!touching.current) {
        const t = (now - start) / 1000
        ry.set(Math.sin(t * 0.9) * 5)
        rx.set(Math.cos(t * 0.7) * 2.5)
        mx.set(50 + Math.sin(t * 0.9) * 30)
        my.set(35 + Math.cos(t * 0.7) * 20)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [rx, ry, mx, my])

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!touching.current) return
    const r = e.currentTarget.getBoundingClientRect()
    const px = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
    const py = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))
    ry.set((px - 0.5) * 26)
    rx.set(-(py - 0.5) * 22)
    mx.set(px * 100)
    my.set(py * 100)
  }

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    touching.current = true
    press.current = { x: e.clientX, y: e.clientY, t: performance.now() }
    e.currentTarget.setPointerCapture(e.pointerId)
    onMove(e)
  }

  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    touching.current = false
    const p = press.current
    press.current = null
    if (!p) return
    const dx = e.clientX - p.x
    const dy = e.clientY - p.y
    if (dy > 90 && Math.abs(dy) > Math.abs(dx)) return closeCard()
    if (Math.hypot(dx, dy) < 10 && performance.now() - p.t < 500) advance()
  }

  const lastTurn = useRef(0)
  const advance = () => {
    // Manche Browser melden einen Tipp doppelt (Touch + Maus) – nur einmal drehen
    const now = performance.now()
    if (now - lastTurn.current < 350) return
    lastTurn.current = now
    const nextTurn = turn + 1
    setTurn(nextTurn)
    if (hiddenAtOpen && nextTurn === 1) {
      // Aufdecken, wenn die Karte halb gedreht ist
      setTimeout(() => {
        reveal(cardId)
        setBurst((b) => b + 1)
      }, 260)
    }
  }

  // ---------- Inhalt der beiden Seiten ----------

  const sideAt = (k: number): Side => hiddenAtOpen
    ? (k === 0 ? 'reverse' : k % 2 === 1 ? 'front' : 'info')
    : (k % 2 === 0 ? 'front' : 'info')
  const sideA = sideAt(turn % 2 === 0 ? turn : turn + 1)
  const sideB = sideAt(turn % 2 === 1 ? turn : turn + 1)
  const current = sideAt(turn)

  const render = (side: Side): ReactNode => {
    if (side === 'reverse') return <CardReverse isNew />
    if (side === 'info') return <CardInfo card={card} state={state} />
    return <CardFront card={card} locked={!state.got} />
  }

  // ---------- Aktionen ----------

  const stadium = stadiumOfCard(card)
  const nextDerby = card.kind === 'derby'
    ? matches.matches.find((m) => !hasStarted(m)
      && [m.home.name, m.away.name].sort().join() === [...card.derby.teams].sort().join())
    : undefined

  const goMap = () => {
    if (!stadium) return
    closeCard()
    closeBinder()
    focusMap(stadium.lat, stadium.lon, 15.6, stadium.id)
  }

  return (
    <div className="cv">
      <motion.div className="cv-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }} onClick={closeCard} />

      <div className="cv-top">
        <motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }}>
          <GlassButton small label="Schließen" icon={<X size={18} strokeWidth={2.6} />} onClick={closeCard} />
        </motion.div>
      </div>

      <motion.div
        className="cv-stage"
        style={{ width }}
        initial={from}
        animate={{ x: 0, y: 0, scale: 1, opacity: 1 }}
        exit={{ ...sourceOffset(cardId, width), transition: { type: 'spring', stiffness: 380, damping: 36 } }}
        transition={{ type: 'spring', stiffness: 300, damping: 28, mass: 0.9 }}
      >
        <motion.div
          className="cv-card"
          style={{ rotateX: rx, rotateY, '--mx': holoX, '--my': holoY } as never}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={() => { touching.current = false; press.current = null }}
        >
          <div className="cv-face">{render(sideA)}</div>
          <div className="cv-face back">{render(sideB)}</div>
        </motion.div>
        <Burst key={burst} active={burst > 0} colors={RARITY_BURST[card.rarity]} />
      </motion.div>

      <motion.div className="cv-bottom" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20, transition: { duration: 0.15 } }} transition={{ type: 'spring', stiffness: 320, damping: 30, delay: 0.12 }}>
        <AnimatePresence mode="wait">
          <motion.div key={current} className="cv-hint" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}>
            {current === 'reverse' ? 'Tippen zum Aufdecken' : current === 'front' ? 'Tippen für den Steckbrief' : 'Tippen zum Zurückdrehen'}
          </motion.div>
        </AnimatePresence>
        {current !== 'reverse' && (
          <div className="cv-actions">
            <PillButton small onClick={advance}><RotateCcw size={15} strokeWidth={2.5} /> Umdrehen</PillButton>
            {stadium && card.kind !== 'achievement' && card.kind !== 'derby' && (
              <PillButton small onClick={() => { closeCard(); openSheet({ kind: 'stadium', id: stadium.id }) }}><StadiumIcon size={16} /> Stadion</PillButton>
            )}
            {nextDerby && (
              <PillButton small onClick={() => { closeCard(); openSheet({ kind: 'match', id: nextDerby.id }) }}><CalendarDays size={15} strokeWidth={2.5} /> Nächstes Duell</PillButton>
            )}
            {stadium && card.kind === 'stadium' && (
              <PillButton small onClick={goMap}><MapPin size={15} strokeWidth={2.5} /> Karte</PillButton>
            )}
          </div>
        )}
      </motion.div>
    </div>
  )
}

/** Funkenregen beim Aufdecken */
function Burst({ active, colors }: { active: boolean; colors: string[] }) {
  const sparks = useMemo(() => Array.from({ length: 18 }, (_, i) => {
    const angle = (i / 18) * Math.PI * 2 + Math.random() * 0.3
    const dist = 130 + Math.random() * 90
    return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, s: 4 + Math.random() * 6, c: colors[i % colors.length], d: Math.random() * 0.08 }
  }), [colors])
  if (!active) return null
  return (
    <div className="cv-burst" aria-hidden>
      <motion.span className="cv-flash" initial={{ opacity: 0.9, scale: 0.6 }} animate={{ opacity: 0, scale: 1.6 }}
        transition={{ duration: 0.7, ease: 'easeOut' }} />
      {sparks.map((p, i) => (
        <motion.span key={i} className="cv-spark" style={{ width: p.s, height: p.s, background: p.c }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.3 }}
          transition={{ duration: 0.9, ease: [0.2, 0.7, 0.3, 1], delay: p.d }} />
      ))}
    </div>
  )
}
