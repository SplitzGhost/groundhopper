// Kalender zum Springen an einen beliebigen Tag im Spielplan. Punkte zeigen Spieltage.

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { localDateKey } from '../lib/dates.ts'
import { useMatches } from '../state/matches.ts'
import { gamesDayStore } from '../state/ui.ts'
import { Sheet } from '../components/Sheet.tsx'
import { useSheet } from '../components/sheetContext.ts'
import { GlassButton, PillButton } from '../components/ui.tsx'

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const monthFmt = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' })

const pad = (n: number) => String(n).padStart(2, '0')

function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export function CalendarSheet() {
  const { close } = useSheet()
  const matches = useMatches()
  const today = localDateKey()
  const selected = gamesDayStore.get() ?? today
  const [month, setMonth] = useState(selected.slice(0, 7))
  const [dir, setDir] = useState(0)

  const cells = useMemo(() => {
    const [y, m] = month.split('-').map(Number)
    const first = new Date(y, m - 1, 1)
    const lead = (first.getDay() + 6) % 7
    const days = new Date(y, m, 0).getDate()
    return [
      ...Array.from({ length: lead }, () => null),
      ...Array.from({ length: days }, (_, i) => `${month}-${pad(i + 1)}`),
    ]
  }, [month])

  const go = (delta: number) => {
    setDir(delta)
    setMonth((m) => shiftMonth(m, delta))
  }

  const pick = (key: string) => {
    gamesDayStore.set(key)
    close()
  }

  const [y, m] = month.split('-').map(Number)

  return (
    <Sheet title="Datum wählen">
      <div className="cal-head">
        <GlassButton small label="Vorheriger Monat" icon={<ChevronLeft size={20} strokeWidth={2.6} />} onClick={() => go(-1)} />
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.b key={month} className="cal-month" custom={dir}
            initial={{ opacity: 0, y: dir * 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: dir * -12 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}>
            {monthFmt.format(new Date(y, m - 1, 1))}
          </motion.b>
        </AnimatePresence>
        <GlassButton small label="Nächster Monat" icon={<ChevronRight size={20} strokeWidth={2.6} />} onClick={() => go(1)} />
      </div>

      <div className="cal-weekdays">{WEEKDAYS.map((w) => <span key={w}>{w}</span>)}</div>

      <div className="cal-viewport">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div key={month} className="cal-grid"
            initial={{ opacity: 0, x: dir * 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -60 }}
            transition={{ type: 'spring', stiffness: 360, damping: 34 }}
            drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.3}
            onDragEnd={(_, i) => { if (i.offset.x < -50) go(1); else if (i.offset.x > 50) go(-1) }}>
            {cells.map((key, i) => {
              if (!key) return <span key={`b${i}`} />
              const n = matches.byDay.get(key)?.length ?? 0
              const leagues = new Set((matches.byDay.get(key) ?? []).map((x) => x.league)).size
              return (
                <motion.button key={key} type="button" whileTap={{ scale: 0.85 }}
                  className={`cal-day ${key === selected ? 'on' : ''} ${key === today ? 'today' : ''} ${n ? 'has' : ''}`}
                  onClick={() => pick(key)} aria-label={`${key}${n ? `, ${n} Spiele` : ''}`}>
                  <span className="tnum">{Number(key.slice(8))}</span>
                  <i className="cal-dots">{Array.from({ length: Math.min(3, leagues) }, (_, k) => <b key={k} />)}</i>
                </motion.button>
              )
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="sheet-pad" style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <PillButton block tint onClick={() => pick(today)}>Heute</PillButton>
      </div>
    </Sheet>
  )
}
