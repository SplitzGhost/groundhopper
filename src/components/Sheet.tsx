// Bottom-Sheet wie in iOS: federt hoch, lässt sich am Griff nach unten wegwischen,
// übereinanderliegende Sheets rücken leicht nach hinten.
// Mit `medium` öffnet es halbhoch wie in Apple Maps (Karte bleibt bedienbar) und wird
// durch Hochziehen oder Scrollen groß.

import { useState, type ReactNode } from 'react'
import { motion, useDragControls, type PanInfo } from 'motion/react'
import { X } from 'lucide-react'
import { GlassButton } from './ui.tsx'
import { useSheet } from './sheetContext.ts'

const sheetSpring = { type: 'spring', stiffness: 380, damping: 38, mass: 0.9 } as const

interface SheetProps {
  title?: ReactNode
  /** Elemente rechts im Kopf (vor dem Schließen-Knopf) */
  actions?: ReactNode
  children: ReactNode
  /** Volle Höhe statt an den Inhalt angepasst */
  full?: boolean
  header?: ReactNode
  /** Zuerst halbhoch öffnen */
  medium?: boolean
}

export function Sheet({ title, actions, children, full, header, medium }: SheetProps) {
  const { close, depth } = useSheet()
  const drag = useDragControls()
  const [expanded, setExpanded] = useState(!medium)

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const down = info.offset.y > 100 || info.velocity.y > 650
    if (!expanded && (info.offset.y < -40 || info.velocity.y < -500)) setExpanded(true)
    else if (down && medium && expanded) setExpanded(false)
    else if (down) close()
  }

  return (
    <>
      <motion.div
        className="sheet-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: depth > 0 || !expanded ? 0 : 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        onClick={close}
        // Halbhoch: Karte dahinter bleibt antippbar
        style={{ pointerEvents: expanded ? 'auto' : 'none' }}
      />
      <motion.div
        className={`sheet ${full ? 'full' : ''} ${expanded ? '' : 'medium'}`}
        role="dialog"
        aria-modal="true"
        initial={{ y: '100%' }}
        animate={{ y: depth * -10, scale: 1 - depth * 0.05, opacity: depth > 1 ? 0 : 1 }}
        exit={{ y: '100%', transition: { type: 'spring', stiffness: 420, damping: 42 } }}
        transition={sheetSpring}
        drag="y"
        dragControls={drag}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.03, bottom: 0.85 }}
        onDragEnd={onDragEnd}
        style={{ pointerEvents: depth > 0 ? 'none' : 'auto' }}
      >
        <div className="sheet-grab" onPointerDown={(e) => drag.start(e)}>
          <div className="sheet-grabber" />
          {header ?? (
            <div className="sheet-header">
              <h2 className="sheet-title truncate">{title}</h2>
              {actions}
              <GlassButton small label="Schließen" icon={<X size={18} strokeWidth={2.6} />} onClick={close} />
            </div>
          )}
        </div>
        <div className="sheet-body" onScroll={(e) => {
          if (!expanded && e.currentTarget.scrollTop > 6) setExpanded(true)
        }}>{children}</div>
      </motion.div>
    </>
  )
}
