// Aufgeschlagenes Sammelalbum: Seiten mit je 9 Kartenplätzen, zum Wischen.
// Gesammelte Karten stecken in ihren Hüllen, neue liegen verdeckt, fehlende zeigen nur die Nummer.

import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft } from 'lucide-react'
import { albumById, albumProgress, cardState, pagesOf, type AlbumId, type Card } from '../lib/cards.ts'
import { collect, type Collection } from '../lib/album.ts'
import { leagueByCode } from '../shared/leagues.ts'
import { useUserData } from '../state/userData.ts'
import { useRevealed } from '../state/revealed.ts'
import { binderStore, closeBinder, flyingCardStore, openCard } from '../state/ui.ts'
import { GlassButton } from '../components/ui.tsx'
import { Flag } from '../components/Flag.tsx'
import { CardFront, CardReverse, CardSlot } from '../components/cards/TradingCard.tsx'

export function BinderView() {
  const b = binderStore.use()
  return (
    <AnimatePresence>
      {b && <Binder key={b.album} album={b.album} startPage={b.page} />}
    </AnimatePresence>
  )
}

function Binder({ album, startPage }: { album: AlbumId; startPage: number }) {
  const def = albumById(album)
  const pages = useMemo(() => pagesOf(album), [album])
  const data = useUserData()
  const c = useMemo(() => collect(data.visits), [data.visits])
  const progress = albumProgress(album, c)
  const [page, setPage] = useState(startPage)
  const scroller = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const s = scroller.current
    if (s) s.scrollLeft = startPage * s.clientWidth
  }, [startPage])

  const goTo = (i: number) => {
    const s = scroller.current
    if (s) s.scrollTo({ left: i * s.clientWidth, behavior: 'smooth' })
  }

  // Sprungmarken: erste Seite jeder Liga
  const chapters = pages
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.part === 1 && p.league)

  return (
    <motion.div
      className="binder"
      style={{ '--album': def.color, '--album-deep': def.colorDeep } as React.CSSProperties}
      initial={{ opacity: 0, y: 40, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 40, scale: 0.97, transition: { duration: 0.22 } }}
      transition={{ type: 'spring', stiffness: 340, damping: 34 }}
    >
      <header className="binder-head">
        <GlassButton label="Zurück" icon={<ChevronLeft size={24} strokeWidth={2.4} />} onClick={closeBinder} />
        <div className="binder-title">
          <b>{def.title}</b>
          <span className="tnum">{progress.got} von {progress.total} gesammelt</span>
        </div>
        <div className="binder-ring" aria-hidden>
          <svg viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15" />
            <motion.circle cx="18" cy="18" r="15" initial={{ pathLength: 0 }} animate={{ pathLength: progress.got / progress.total }}
              transition={{ duration: 1, ease: [0.32, 0.72, 0, 1], delay: 0.2 }} />
          </svg>
          <span className="tnum">{Math.round((progress.got / progress.total) * 100)}%</span>
        </div>
      </header>

      {chapters.length > 1 && (
        <div className="chips binder-chips">
          {chapters.map(({ p, i }) => {
            const on = pages[page]?.league === p.league
            const l = leagueByCode(p.league!)
            return (
              <button key={p.league} type="button" className={`chip ${on ? 'on' : ''}`} onClick={() => goTo(i)}>
                {on && <motion.span layoutId="binder-chip" className="chip-bg" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
                <Flag code={l.countryCode} size={11} />
                <span>{l.name}</span>
              </button>
            )
          })}
        </div>
      )}

      <div className="binder-pages" ref={scroller}
        onScroll={(e) => {
          const s = e.currentTarget
          const i = Math.round(s.scrollLeft / s.clientWidth)
          if (i !== page) setPage(i)
        }}>
        {pages.map((p, i) => {
          const got = p.cards.filter((card) => cardState(card, c).got).length
          const near = Math.abs(i - page) <= 1
          return (
            <section key={i} className="binder-page" aria-label={`Seite ${i + 1}`}>
              <div className="binder-page-head">
                {p.league && <Flag code={leagueByCode(p.league).countryCode} size={12} />}
                <span className="binder-page-title">{p.title}{p.parts > 1 && <span className="dim"> · {p.part}/{p.parts}</span>}</span>
                <span className="binder-page-count tnum">{got}/{p.cards.length}</span>
              </div>
              <div className="binder-grid">
                {p.cards.map((card, k) => (
                  <div key={card.id} className="binder-sleeve">
                    {near && <BinderCard card={card} c={c} index={k} />}
                  </div>
                ))}
              </div>
            </section>
          )
        })}
      </div>

      <div className="binder-dots" role="tablist">
        {pages.map((_, i) => (
          <button key={i} type="button" aria-label={`Seite ${i + 1}`} className={i === page ? 'on' : ''} onClick={() => goTo(i)} />
        ))}
      </div>
    </motion.div>
  )
}

const BinderCard = memo(function BinderCard({ card, c, index }: { card: Card; c: Collection; index: number }) {
  const revealed = useRevealed()
  const flying = flyingCardStore.use() === card.id
  const st = cardState(card, c)
  const isNew = st.got && !revealed.has(card.id)

  return (
    <motion.button
      type="button"
      className={`binder-card ${isNew ? 'is-new' : ''}`}
      data-card={card.id}
      style={{ visibility: flying ? 'hidden' : 'visible' }}
      initial={{ opacity: 0, y: 14, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 30, delay: index * 0.03 }}
      whileTap={{ scale: 0.94 }}
      onClick={() => openCard(card.id, card.id)}
      aria-label={card.title}
    >
      {!st.got ? <CardSlot card={card} /> : isNew ? <CardReverse isNew /> : <CardFront card={card} />}
    </motion.button>
  )
})
