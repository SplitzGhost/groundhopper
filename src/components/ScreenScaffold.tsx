// Gerüst für Listen-Bildschirme: großer Titel, der beim Scrollen in eine kompakte Glasleiste übergeht.

import { forwardRef, useState, type ReactNode } from 'react'
import { motion, useMotionValue, useTransform } from '../lib/fastMotion.tsx'

interface Props {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
}

export const ScreenScaffold = forwardRef<HTMLDivElement, Props>(function ScreenScaffold({ title, subtitle, actions, children }, ref) {
  const [compact, setCompact] = useState(false)
  const scrollY = useMotionValue(0)
  // Großer Titel schrumpft leicht beim Hochziehen, wächst beim Überziehen nach unten (wie iOS)
  const titleScale = useTransform(scrollY, [-120, 0, 60], [1.08, 1, 0.94])
  const titleOpacity = useTransform(scrollY, [0, 44], [1, 0])

  return (
    <>
      <div className={`navbar ${compact ? 'show' : ''}`}>
        <span className="navbar-title">{title}</span>
      </div>
      <div
        className="screen-scroll"
        ref={ref}
        onScroll={(e) => {
          const y = e.currentTarget.scrollTop
          scrollY.set(y)
          if (y > 40 !== compact) setCompact(y > 40)
        }}
      >
        <div className="large-title-row">
          <motion.h1 className="large-title" style={{ scale: titleScale, opacity: titleOpacity }}>{title}</motion.h1>
          {actions && <div className="btn-group">{actions}</div>}
        </div>
        {subtitle && <div className="large-sub">{subtitle}</div>}
        {children}
      </div>
    </>
  )
})
