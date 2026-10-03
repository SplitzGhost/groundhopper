// Sammelkarten-Ordner: Der Einband schwingt auf, darunter Seiten mit je vier Kartenhüllen.
// Wischen blättert die Seite in 3D am Ordnerrücken um – wie in einem echten Sammelordner.
// Sortierbar nach Datum, Alphabet oder Liga.

import { memo, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { flushSync } from 'react-dom'
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'motion/react'
import { ArrowUpDown, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { PER_PAGE, SORTS, pagesOf, type BinderPage, type MatchCard } from '../lib/matchCards.ts'
import { leagueLogo } from '../lib/crests.ts'
import { useCards } from '../state/cards.ts'
import { useRevealed } from '../state/revealed.ts'
import { binderSortStore, binderStore, closeBinder, flyingCardStore, openCard, setBinderSort, tabStore } from '../state/ui.ts'
import { GlassButton, PillButton } from '../components/ui.tsx'
import { CardReverse, MatchCardFront } from '../components/cards/MatchCard.tsx'
import { CardsIcon } from '../components/icons.tsx'

export function BinderView() {
  const open = binderStore.use()
  return (
    <AnimatePresence>
      {open && <Binder key="binder" />}
    </AnimatePresence>
  )
}

const pageSpring = { type: 'spring', stiffness: 150, damping: 22, mass: 0.9 } as const

type Dir = 'next' | 'prev'

function Binder() {
  const cards = useCards()
  const sort = binderSortStore.use()
  const pages = useMemo(() => {
    const p = pagesOf(cards, sort)
    return p.length ? p : [{ cards: [], title: 'Dein Ordner', league: null } as BinderPage]
  }, [cards, sort])
  const [index, setIndex] = useState(0)
  const [dir, setDir] = useState<Dir | null>(null)
  const [menu, setMenu] = useState(false)
  const [coverGone, setCoverGone] = useState(false)
  const angle = useMotionValue(0)
  const stage = useRef<HTMLDivElement>(null)
  const gesture = useRef<{ x: number; y: number; dir: Dir | null; blocked: boolean; vx: number; lx: number; lt: number } | null>(null)
  const busy = useRef(false)

  const last = pages.length - 1
  const page = Math.min(index, last)

  // Nach dem Umsortieren vorne anfangen
  const [shownSort, setShownSort] = useState(sort)
  if (shownSort !== sort) {
    setShownSort(sort)
    setIndex(0)
  }

  const moving = dir === 'next' ? pages[page] : dir === 'prev' ? pages[page - 1] : null
  const under = dir === 'prev' ? pages[page] : dir === 'next' ? pages[page + 1] ?? null : pages[page]
  const movingNo = dir === 'prev' ? page - 1 : page
  const underNo = dir === 'next' ? page + 1 : page

  // Schatten: Seite wird beim Anheben dunkler, darunter fällt ein Schatten zum Rücken hin
  const frontShade = useTransform(angle, [-90, 0], [0.42, 0])
  const backShade = useTransform(angle, [-180, -90], [0, 0.3])
  const underShade = useTransform(angle, [-180, -110, -20, 0], [0, 0.32, 0.12, 0])
  const sheetShadow = useTransform(angle, [-90, -45, 0], [0, 0.3, 0])
  const shadow = useTransform(sheetShadow, (o) => `0 18px 40px -10px rgba(5, 20, 50, ${o})`)

  const finish = (d: Dir, complete: boolean, velocity = 0) => {
    busy.current = true
    const target = complete ? (d === 'next' ? -180 : 0) : (d === 'next' ? 0 : -180)
    void animate(angle, target, { ...pageSpring, velocity }).then(() => {
      flushSync(() => {
        if (complete) setIndex((i) => (d === 'next' ? i + 1 : i - 1))
        setDir(null)
      })
      angle.jump(0)
      busy.current = false
    })
  }

  const flip = (d: Dir) => {
    if (busy.current || dir) return
    if (d === 'next' ? page >= last : page <= 0) return
    angle.jump(d === 'next' ? 0 : -180)
    flushSync(() => setDir(d))
    finish(d, true)
  }

  // ---------- Wischgeste ----------

  const width = () => stage.current?.clientWidth ?? 360

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (busy.current || menu) return
    gesture.current = { x: e.clientX, y: e.clientY, dir: null, blocked: false, vx: 0, lx: e.clientX, lt: e.timeStamp }
  }

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g) return
    const dx = e.clientX - g.x
    const dy = e.clientY - g.y
    if (!g.dir) {
      if (Math.hypot(dx, dy) < 8) return
      if (Math.abs(dy) > Math.abs(dx)) {
        gesture.current = null
        return
      }
      const d: Dir = dx < 0 ? 'next' : 'prev'
      g.blocked = d === 'next' ? page >= last : page <= 0
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // Zeiger schon weg (z. B. sehr kurzer Wisch)
      }
      // Am Ende des Ordners hebt sich die Seite nur ein Stück
      g.dir = g.blocked ? 'next' : d
      angle.jump(g.dir === 'prev' ? -180 : 0)
      flushSync(() => setDir(g.dir))
    }
    const dt = Math.max(1, e.timeStamp - g.lt)
    g.vx = g.vx * 0.5 + ((e.clientX - g.lx) / dt) * 0.5
    g.lx = e.clientX
    g.lt = e.timeStamp
    const p = Math.max(0, Math.min(1, Math.abs(dx) / (width() * 0.92)))
    if (g.blocked) angle.set(-Math.min(28, p * 60))
    else if (g.dir === 'prev') angle.set(-180 + p * 180)
    else angle.set(-p * 180)
  }

  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    gesture.current = null
    if (!g?.dir) return
    const dx = e.clientX - g.x
    const p = Math.abs(dx) / (width() * 0.92)
    const vel = g.vx * 1000 / width() * 180
    if (g.blocked) return finish('next', false)
    if (g.dir === 'next') finish('next', p > 0.38 || g.vx < -0.45, vel)
    else finish('prev', p > 0.38 || g.vx > 0.45, vel)
  }

  // Tasten am Computer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') flip('next')
      if (e.key === 'ArrowLeft') flip('prev')
      if (e.key === 'Escape') closeBinder()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const newCount = cards.length

  return (
    <motion.div
      className="binder"
      initial={{ opacity: 0, y: 60, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 60, scale: 0.94, transition: { duration: 0.24 } }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
    >
      <header className="binder-head">
        <GlassButton label="Zurück" icon={<ChevronLeft size={24} strokeWidth={2.4} />} onClick={closeBinder} />
        <div className="binder-title">
          <b>Mein Ordner</b>
          <span className="tnum">{newCount} {newCount === 1 ? 'Karte' : 'Karten'} · {SORTS.find((s) => s.id === sort)!.label}</span>
        </div>
        <GlassButton label="Sortieren" icon={<ArrowUpDown size={19} strokeWidth={2.4} />} active={menu} onClick={() => setMenu((m) => !m)} />
      </header>

      <AnimatePresence>
        {menu && <SortMenu onClose={() => setMenu(false)} />}
      </AnimatePresence>

      <div className="binder-stage" ref={stage}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
        onPointerCancel={() => { const d = gesture.current?.dir; gesture.current = null; if (d) finish(d, false) }}>
        <div className="binder-book">
          <div className="binder-rings" aria-hidden><i /><i /><i /></div>

          <motion.div key={shownSort} className="binder-under" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
            {under ? <Page page={under} no={underNo} total={pages.length} /> : <BlankPage />}
            <motion.span className="binder-under-shade" style={{ opacity: underShade }} />
          </motion.div>

          {moving && (
            <motion.div className="binder-sheet" style={{ rotateY: angle, boxShadow: shadow }}>
              <div className="binder-sheet-front">
                <Page page={moving} no={movingNo} total={pages.length} />
                <motion.span className="binder-sheet-shade" style={{ opacity: frontShade }} />
              </div>
              <div className="binder-sheet-back">
                <motion.span className="binder-sheet-shade" style={{ opacity: backShade }} />
              </div>
            </motion.div>
          )}

          {!coverGone && (
            <motion.div className="binder-cover" initial={{ rotateY: 0 }} animate={{ rotateY: -180 }}
              transition={{ type: 'spring', stiffness: 70, damping: 15, delay: 0.28 }}
              onAnimationComplete={() => setCoverGone(true)}>
              <div className="binder-cover-front">
                <span className="binder-cover-badge"><CardsIcon size={30} /></span>
                <b>Groundhopper</b>
                <span>Meine Spiele</span>
              </div>
              <div className="binder-cover-back" />
            </motion.div>
          )}
        </div>
      </div>

      <footer className="binder-foot">
        <GlassButton small label="Vorherige Seite" icon={<ChevronLeft size={20} strokeWidth={2.6} />} onClick={() => flip('prev')} className={page <= 0 ? 'disabled' : ''} />
        <div className="binder-pager">
          <span className="tnum">Seite {page + 1} von {pages.length}</span>
          <div className="binder-dots">
            {pages.length <= 14 && pages.map((_, i) => (
              <button key={i} type="button" aria-label={`Seite ${i + 1}`} className={i === page ? 'on' : ''}
                onClick={() => { if (!dir && !busy.current) setIndex(i) }} />
            ))}
          </div>
        </div>
        <GlassButton small label="Nächste Seite" icon={<ChevronRight size={20} strokeWidth={2.6} />} onClick={() => flip('next')} className={page >= last ? 'disabled' : ''} />
      </footer>
    </motion.div>
  )
}

function SortMenu({ onClose }: { onClose: () => void }) {
  const sort = binderSortStore.use()
  return (
    <>
      <motion.div className="menu-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div className="glass glass-strong popover-menu binder-menu" role="menu"
        initial={{ opacity: 0, scale: 0.6, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.7, y: -8 }}
        transition={{ type: 'spring', stiffness: 520, damping: 34 }}>
        <div className="popover-label">Sortieren nach</div>
        {SORTS.map((s, i) => (
          <motion.button key={s.id} type="button" role="menuitemradio" aria-checked={s.id === sort} className="popover-item"
            initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.03 * i }}
            onClick={() => { setBinderSort(s.id); onClose() }}>
            <span>{s.label}</span>
            {s.id === sort && <Check size={17} strokeWidth={2.8} />}
          </motion.button>
        ))}
      </motion.div>
    </>
  )
}

function Page({ page, no, total }: { page: BinderPage; no: number; total: number }) {
  const slots = Array.from({ length: PER_PAGE }, (_, i) => page.cards[i] ?? null)
  return (
    <div className="bp">
      <div className="bp-head">
        {page.league && <img className="bp-league" src={leagueLogo(page.league)} alt="" draggable={false} />}
        <span className="bp-title truncate">{page.title}</span>
        <span className="bp-no tnum">{no + 1}/{total}</span>
      </div>
      <div className="bp-grid">
        {slots.map((card, i) => (
          <div key={card?.id ?? `empty-${i}`} className="bp-sleeve">
            {card && <BinderCard card={card} index={i} />}
          </div>
        ))}
      </div>
      {page.cards.length === 0 && (
        <div className="bp-empty">
          <b>Noch keine Karten</b>
          <p>Hake im Spielplan ein Spiel ab, bei dem du im Stadion warst – dafür bekommst du eine Karte.</p>
          <PillButton small tint onClick={() => { closeBinder(); tabStore.set('games') }}>Zum Spielplan</PillButton>
        </div>
      )}
    </div>
  )
}

function BlankPage() {
  return (
    <div className="bp">
      <div className="bp-head"><span className="bp-title">Ende</span></div>
      <div className="bp-grid">{[0, 1, 2, 3].map((i) => <div key={i} className="bp-sleeve" />)}</div>
    </div>
  )
}

const BinderCard = memo(function BinderCard({ card, index }: { card: MatchCard; index: number }) {
  const revealed = useRevealed()
  const flying = flyingCardStore.use() === card.id
  const isNew = !revealed.has(card.id)
  return (
    <motion.button
      type="button"
      className={`bp-card ${isNew ? 'is-new' : ''}`}
      data-card={card.id}
      style={{ visibility: flying ? 'hidden' : 'visible' }}
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 30, delay: 0.05 + index * 0.04 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => openCard(card.id)}
      aria-label={`${card.home} gegen ${card.away}`}
    >
      {isNew ? <CardReverse isNew /> : <MatchCardFront card={card} />}
    </motion.button>
  )
})
