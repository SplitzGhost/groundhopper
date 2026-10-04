// Seitenweises Wischen über natives Scrollen mit Einrasten (wie in der Fotos-App).
// iOS scrollt selbst – das bleibt auch im Stromsparmodus flüssig, anders als Gesten, die die App Bild für Bild nachrechnet.
// Es gibt immer drei Seiten (vorherige, aktuelle, nächste); nach dem Einrasten auf einer Nachbarseite meldet
// `onStep` die Richtung, die Eltern-Komponente wechselt `pageKey` und wir springen unsichtbar zurück in die Mitte.
// Mit der Maus (Vorschau am Computer) lässt sich ebenfalls ziehen.

import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'

interface SnapPagerProps {
  /** Ändert sich mit der angezeigten Seite (z. B. Datum) */
  pageKey: string
  onStep: (dir: 1 | -1) => void
  prev: ReactNode
  current: ReactNode
  next: ReactNode
  className?: string
}

export function SnapPager({ pageKey, onStep, prev, current, next, className }: SnapPagerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef(0)
  const touching = useRef(false)
  // Pro Seitenwechsel nur ein Schritt, auch wenn mehrere Scroll-Ereignisse das Einrasten melden
  const stepped = useRef(false)
  const onStepRef = useRef(onStep)
  useLayoutEffect(() => { onStepRef.current = onStep })

  // Nach jedem Seitenwechsel (auch beim Springen über Kalender) wieder auf die mittlere Seite
  useLayoutEffect(() => {
    const el = ref.current
    if (el) el.scrollLeft = el.clientWidth
    stepped.current = false
  }, [pageKey])

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const settle = () => {
      if (touching.current || stepped.current) return
      const w = el.clientWidth
      const idx = Math.round(el.scrollLeft / w)
      if (Math.abs(el.scrollLeft - idx * w) > 2) return
      if (idx === 1) return
      stepped.current = true
      onStepRef.current(idx === 0 ? -1 : 1)
    }
    const onScroll = () => {
      clearTimeout(timer.current)
      timer.current = window.setTimeout(settle, 90)
    }
    const onTouchStart = () => { touching.current = true }
    const onTouchEnd = () => {
      touching.current = false
      onScroll()
    }

    // Breite ändert sich (Drehen): mittlere Seite halten
    let width = el.clientWidth
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === width) return
      width = el.clientWidth
      el.scrollLeft = width
    })
    ro.observe(el)

    // Maus: ziehen statt nur Mausrad/Trackpad
    let drag: { x: number; left: number; moved: boolean } | null = null
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return
      drag = { x: e.clientX, left: el.scrollLeft, moved: false }
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!drag) return
      const dx = e.clientX - drag.x
      if (!drag.moved && Math.abs(dx) < 6) return
      if (!drag.moved) {
        drag.moved = true
        touching.current = true
        el.style.scrollSnapType = 'none'
      }
      el.scrollLeft = drag.left - dx
    }
    const onPointerUp = (e: PointerEvent) => {
      if (!drag) return
      const moved = drag.moved
      const dx = e.clientX - drag.x
      drag = null
      if (!moved) return
      touching.current = false
      el.style.scrollSnapType = ''
      const w = el.clientWidth
      // Schon ein Viertel gezogen reicht für die Nachbarseite
      const target = Math.abs(dx) > w * 0.22 ? (dx < 0 ? 2 : 0) : 1
      el.scrollTo({ left: target * w, behavior: 'smooth' })
      // Danach kein Antippen auslösen
      const block = (ev: Event) => { ev.stopPropagation(); ev.preventDefault() }
      el.addEventListener('click', block, { capture: true, once: true })
      setTimeout(() => el.removeEventListener('click', block, { capture: true }), 0)
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    el.addEventListener('scrollend', onScroll)
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    el.addEventListener('touchcancel', onTouchEnd, { passive: true })
    el.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      clearTimeout(timer.current)
      ro.disconnect()
      el.removeEventListener('scroll', onScroll)
      el.removeEventListener('scrollend', onScroll)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
      el.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [])

  return (
    <div ref={ref} className={`snap-pager ${className ?? ''}`}>
      <div className="snap-page side" aria-hidden>{prev}</div>
      <div className="snap-page">{current}</div>
      <div className="snap-page side" aria-hidden>{next}</div>
    </div>
  )
}
