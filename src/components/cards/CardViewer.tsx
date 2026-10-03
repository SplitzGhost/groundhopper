// Große Spielkarte: fliegt aus dem Ordner in die Mitte, neigt sich unter dem Finger, Tippen
// dreht sie um – vorn Wappen & Endstand, hinten der Spielbericht. „Mehr“ zeigt die eigene
// Erinnerung (Bewertung, Notizen). Frisch verdiente Karten kommen verdeckt angeflogen.

import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import { BookOpen, PenLine, Quote, RotateCcw, Star, X } from 'lucide-react'
import type { MatchCard } from '../../lib/matchCards.ts'
import { shortClub } from '../../lib/matchCards.ts'
import { useCards } from '../../state/cards.ts'
import { ensureReport, updateVisit } from '../../state/userData.ts'
import { reveal, useRevealed } from '../../state/revealed.ts'
import { cardViewStore, closeCard, flyingCardStore, openSheet, pendingCardStore, sheetStore, tabStore } from '../../state/ui.ts'
import { formatDayLong } from '../../lib/dates.ts'
import { GlassButton, PillButton } from '../ui.tsx'
import { CardReverse, ExtraBadge, MatchCardBack, MatchCardFront } from './MatchCard.tsx'

export function CardViewer() {
  const view = cardViewStore.use()
  const pending = pendingCardStore.use()
  const sheets = sheetStore.use()

  // Frisch verdiente Karte erscheint, sobald Bewertung & Notizen geschlossen sind
  useEffect(() => {
    if (!pending || sheets.length || view) return
    const t = setTimeout(() => {
      pendingCardStore.set(null)
      cardViewStore.set({ visitId: pending })
    }, 420)
    return () => clearTimeout(t)
  }, [pending, sheets.length, view])

  return (
    <AnimatePresence onExitComplete={() => flyingCardStore.set(null)}>
      {view && <Viewer key={view.visitId} visitId={view.visitId} memoryAtOpen={!!view.memory} />}
    </AnimatePresence>
  )
}

/** Ausgangsposition relativ zur Mitte: sichtbare Karte mit data-card, sonst der Album-Tab. */
function sourceOffset(id: string, width: number) {
  const app = document.querySelector('.app')?.getBoundingClientRect()
  if (!app) return { x: 0, y: 60, scale: 0.6, opacity: 0, rotate: 0 }
  const cx = app.left + app.width / 2
  const cy = app.top + app.height / 2 - 40
  const visible = [...document.querySelectorAll(`[data-card="${CSS.escape(id)}"]`)]
    .map((el) => el.getBoundingClientRect())
    .find((r) => r.width > 0 && r.bottom > app.top && r.top < app.bottom && r.right > app.left && r.left < app.right)
  if (visible) return { x: visible.left + visible.width / 2 - cx, y: visible.top + visible.height / 2 - cy, scale: visible.width / width, opacity: 1, rotate: 0 }
  const tab = document.querySelector('[data-tab="album"]')?.getBoundingClientRect()
  if (tab) return { x: tab.left + tab.width / 2 - cx, y: tab.top + tab.height / 2 - cy, scale: 0.08, opacity: 0, rotate: -12 }
  return { x: 0, y: app.height, scale: 0.6, opacity: 0, rotate: 0 }
}

type Side = 'reverse' | 'front' | 'back'

function Viewer({ visitId, memoryAtOpen }: { visitId: string; memoryAtOpen: boolean }) {
  const cards = useCards()
  const card = cards.find((c) => c.id === visitId)
  const revealed = useRevealed()
  // Verdeckt nur, wenn die Karte beim Öffnen noch nicht aufgedeckt war
  const [hiddenAtOpen] = useState(() => !revealed.has(visitId))
  const [fresh] = useState(() => !document.querySelector(`[data-card="${CSS.escape(visitId)}"]`))
  const [turn, setTurn] = useState(0)
  const [burst, setBurst] = useState(0)
  const [memory, setMemory] = useState(memoryAtOpen && !hiddenAtOpen)
  const [width] = useState(() => Math.min(300, (document.querySelector('.app')?.clientWidth ?? 390) * 0.76))
  const [from] = useState(() => fresh
    ? { x: 0, y: 520, scale: 0.7, opacity: 0, rotate: -14 }
    : sourceOffset(visitId, width))

  useEffect(() => {
    flyingCardStore.set(visitId)
    void ensureReport(visitId)
  }, [visitId])

  useEffect(() => {
    if (!card) closeCard()
  }, [card])

  // ---------- Neigen & Drehen ----------

  const rx = useSpring(0, { stiffness: 260, damping: 22 })
  const ry = useSpring(0, { stiffness: 260, damping: 22 })
  const flip = useSpring(0, { stiffness: 170, damping: 20, mass: 1 })
  const rotateY = useTransform(() => flip.get() + ry.get())
  const mx = useMotionValue(50)
  const my = useMotionValue(30)
  const glareX = useTransform(mx, (v) => `${v}%`)
  const glareY = useTransform(my, (v) => `${v}%`)
  const press = useRef<{ x: number; y: number; t: number } | null>(null)
  const touching = useRef(false)

  useEffect(() => {
    flip.set(turn * 180)
  }, [turn, flip])

  // Leichtes Schweben, solange niemand die Karte berührt – lässt den Glanz wandern
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
    // Knöpfe auf der Karte (z. B. „Mehr“) bekommen ihren Klick selbst
    if ((e.target as HTMLElement).closest('button')) return
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
    if (Math.hypot(dx, dy) < 10 && performance.now() - p.t < 500) {
      if (memory) setMemory(false)
      else advance()
    }
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
        reveal(visitId)
        setBurst((b) => b + 1)
      }, 260)
    }
  }

  // ---------- Seiten ----------

  const sideAt = (k: number): Side => hiddenAtOpen
    ? (k === 0 ? 'reverse' : k % 2 === 1 ? 'front' : 'back')
    : (k % 2 === 0 ? 'front' : 'back')
  const sideA = sideAt(turn % 2 === 0 ? turn : turn + 1)
  const sideB = sideAt(turn % 2 === 1 ? turn : turn + 1)
  const current = sideAt(turn)

  const colors = useMemo(() => card ? [card.colors.home, card.colors.away, '#ffffff', '#ffd34d'] : [], [card])
  if (!card) return null

  const loading = !card.visit.details && !!card.visit.league
  const render = (side: Side): ReactNode => {
    if (side === 'reverse') return <CardReverse isNew />
    if (side === 'back') return <MatchCardBack card={card} loading={loading} onMore={() => setMemory(true)} />
    return <MatchCardFront card={card} size="lg" />
  }

  return (
    <div className="cv">
      <motion.div className="cv-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }} onClick={() => (memory ? setMemory(false) : closeCard())} />

      <div className="cv-top">
        <motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }}>
          <GlassButton small label="Schließen" icon={<X size={18} strokeWidth={2.6} />} onClick={closeCard} />
        </motion.div>
      </div>

      <motion.div
        className="cv-stage"
        style={{ width }}
        initial={from}
        animate={memory
          ? { x: 0, y: -168, scale: 0.56, opacity: 1, rotate: 0 }
          : { x: 0, y: 0, scale: 1, opacity: 1, rotate: 0 }}
        exit={{ ...sourceOffset(visitId, width), transition: { type: 'spring', stiffness: 380, damping: 36 } }}
        transition={fresh && !memory
          ? { type: 'spring', stiffness: 170, damping: 19, mass: 1 }
          : { type: 'spring', stiffness: 300, damping: 30, mass: 0.9 }}
      >
        <motion.div
          className="cv-card"
          style={{ rotateX: rx, rotateY, '--mx': glareX, '--my': glareY } as never}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={() => { touching.current = false; press.current = null }}
        >
          <div className="cv-face">{render(sideA)}</div>
          <div className="cv-face back">{render(sideB)}</div>
        </motion.div>
        <Burst key={burst} active={burst > 0} colors={colors} />
      </motion.div>

      <AnimatePresence>
        {!memory && (
          <motion.div key="bottom" className="cv-bottom" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20, transition: { duration: 0.15 } }} transition={{ type: 'spring', stiffness: 320, damping: 30, delay: 0.12 }}>
            <AnimatePresence mode="wait">
              <motion.div key={current} className="cv-hint" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}>
                {current === 'reverse' ? 'Neue Karte – tippen zum Aufdecken' : current === 'front' ? 'Tippen für den Spielbericht' : 'Tippen zum Zurückdrehen'}
              </motion.div>
            </AnimatePresence>
            {current !== 'reverse' && (
              <div className="cv-actions">
                <PillButton small onClick={advance}><RotateCcw size={15} strokeWidth={2.5} /> Umdrehen</PillButton>
                <PillButton small tint onClick={() => setMemory(true)}><BookOpen size={15} strokeWidth={2.5} /> Erinnerung</PillButton>
              </div>
            )}
          </motion.div>
        )}
        {memory && <Memory key="memory" card={card} cards={cards} onClose={() => setMemory(false)} />}
      </AnimatePresence>
    </div>
  )
}

// ---------- Erinnerung ----------

function Memory({ card, cards, onClose }: { card: MatchCard; cards: MatchCard[]; onClose: () => void }) {
  const v = card.visit
  const before = cards.filter((c) => c.number <= card.number)
  const atGround = card.visit.stadiumId ? before.filter((c) => c.visit.stadiumId === card.visit.stadiumId).length : 0
  const sawHome = before.filter((c) => c.home === card.home || c.away === card.home).length
  const facts = [
    `Dein ${card.number}. Spiel`,
    atGround ? `${atGround}. Besuch im Stadion` : null,
    `${sawHome}× ${shortClub(card.home)} live`,
  ].filter(Boolean) as string[]

  const edit = () => {
    closeCard()
    openSheet(v.matchId ? { kind: 'match', id: v.matchId } : { kind: 'visit', id: v.id })
  }

  return (
    <motion.div className="glass glass-strong cv-memory"
      initial={{ y: '110%' }} animate={{ y: 0 }} exit={{ y: '110%', transition: { type: 'spring', stiffness: 420, damping: 40 } }}
      transition={{ type: 'spring', stiffness: 360, damping: 34 }}>
      <div className="cv-memory-head">
        <div>
          <b>Deine Erinnerung</b>
          <span>{formatDayLong(v.date)}</span>
        </div>
        <GlassButton small label="Erinnerung schließen" icon={<X size={17} strokeWidth={2.6} />} onClick={onClose} />
      </div>

      <div className="cv-memory-stars" role="radiogroup" aria-label="Bewertung">
        {[1, 2, 3, 4, 5].map((n) => {
          const on = (v.rating ?? 0) >= n
          return (
            <motion.button key={n} type="button" className={`star-btn ${on ? 'on' : ''}`} aria-label={`${n} Sterne`}
              whileTap={{ scale: 0.75 }} initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 460, damping: 16, delay: 0.08 + n * 0.04 }}
              onClick={() => updateVisit(v.id, { rating: v.rating === n ? null : n })}>
              <Star size={28} strokeWidth={1.8} fill={on ? 'currentColor' : 'none'} />
            </motion.button>
          )
        })}
      </div>

      <motion.div className={`cv-memory-notes ${v.notes ? '' : 'empty'}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}>
        <Quote size={14} strokeWidth={2.6} />
        <p>{v.notes || 'Noch keine Notizen – wie war die Stimmung, wer war dabei?'}</p>
      </motion.div>

      {card.extras.length > 0 && (
        <div className="cv-memory-extras">
          {card.extras.map((x) => <ExtraBadge key={x.id} extra={x} />)}
        </div>
      )}

      <div className="cv-memory-facts">
        {facts.map((f, i) => (
          <motion.span key={f} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 420, damping: 24, delay: 0.2 + i * 0.05 }}>{f}</motion.span>
        ))}
      </div>

      <div className="cv-memory-actions">
        <PillButton small block onClick={edit}><PenLine size={15} strokeWidth={2.5} /> Bearbeiten</PillButton>
        <PillButton small block onClick={() => { closeCard(); tabStore.set('album') }}>Zum Ordner</PillButton>
      </div>
    </motion.div>
  )
}

/** Funkenregen beim Aufdecken */
function Burst({ active, colors }: { active: boolean; colors: string[] }) {
  const sparks = useMemo(() => Array.from({ length: 20 }, (_, i) => {
    const angle = (i / 20) * Math.PI * 2 + Math.random() * 0.3
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
