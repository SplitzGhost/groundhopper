// Drehbares 3D-Stadion: Wischen dreht mit Schwung, ohne Berührung dreht es sich langsam weiter.
// Tippen ruft `onTap` auf. Bis die Szene steht, liegt das Standbild darunter und wird überblendet.

import { useEffect, useRef, useState } from 'react'
import { stadiumById } from '../lib/stadiums.ts'
import type { LiveStadium } from '../lib/stadium3d/render.ts'
import { StadiumArt } from './StadiumArt.tsx'

const engine = () => import('../lib/stadium3d/render.ts')

/** Leerlaufdrehung in rad/s */
const IDLE_SPEED = 0.09
/** Drehung pro Pixel Wischweg */
const RAD_PER_PX = 0.0085

interface Props {
  stadiumId: string
  mono?: boolean
  className?: string
  onTap?: () => void
}

export function Stadium3D({ stadiumId, mono = false, className = '', onTap }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const tapRef = useRef(onTap)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    tapRef.current = onTap
  }, [onTap])

  useEffect(() => {
    const stadium = stadiumById(stadiumId)
    const canvas = canvasRef.current
    if (!stadium || !canvas) return
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
    let live: LiveStadium | null = null
    let disposed = false
    let raf = 0
    let ro: ResizeObserver | null = null
    let vel = 0
    let prev = performance.now()
    let drag: { x0: number; y0: number; t0: number; x: number; t: number; moved: boolean } | null = null

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(0.05, (now - prev) / 1000)
      prev = now
      if (!live || drag || document.hidden) return
      // Schwung klingt zur Leerlaufdrehung hin ab
      const idle = reduceMotion ? 0 : IDLE_SPEED
      vel = idle + (vel - idle) * Math.exp(-dt * 2.6)
      if (Math.abs(vel) < 1e-4) return
      live.az += vel * dt
      live.render()
    }

    const onDown = (e: PointerEvent) => {
      if (!live) return
      drag = { x0: e.clientX, y0: e.clientY, t0: e.timeStamp, x: e.clientX, t: e.timeStamp, moved: false }
      vel = 0
    }
    const onMove = (e: PointerEvent) => {
      if (!drag || !live) return
      const dx = e.clientX - drag.x
      const dtm = Math.max(1, e.timeStamp - drag.t) / 1000
      if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 6) {
        drag.moved = true
        canvas.setPointerCapture(e.pointerId)
      }
      live.az -= dx * RAD_PER_PX
      // geglättete Wischgeschwindigkeit für den Schwung
      vel = vel * 0.6 + ((-dx * RAD_PER_PX) / dtm) * 0.4
      drag.x = e.clientX
      drag.t = e.timeStamp
      live.render()
    }
    const onUp = (e: PointerEvent) => {
      if (!drag) return
      const tap = !drag.moved && e.timeStamp - drag.t0 < 450
      // Finger stand vor dem Loslassen still → kein Schwung
      if (e.timeStamp - drag.t > 80) vel = 0
      vel = Math.max(-6, Math.min(6, vel))
      drag = null
      if (tap) tapRef.current?.()
    }
    const onCancel = () => {
      drag = null
      vel = 0
    }
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onCancel)

    // Erst nach dem Hochfahren des Sheets bauen – das Modell braucht einen Moment
    const start = setTimeout(() => {
      engine().then((m) => {
        if (disposed) return
        live = new m.LiveStadium(canvas, stadium, mono)
        const size = () => {
          const r = canvas.getBoundingClientRect()
          if (r.width > 0 && r.height > 0) live?.resize(r.width, r.height)
        }
        size()
        ro = new ResizeObserver(size)
        ro.observe(canvas)
        // Kleiner Schwung zum Start
        if (!reduceMotion) {
          live.az = m.DEFAULT_AZ - 0.5
          vel = 1.4
        }
        live.render()
        setReady(true)
        prev = performance.now()
        raf = requestAnimationFrame(tick)
      }).catch(() => undefined)
    }, 380)

    return () => {
      disposed = true
      clearTimeout(start)
      cancelAnimationFrame(raf)
      ro?.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onCancel)
      live?.dispose()
      setReady(false)
    }
  }, [stadiumId, mono])

  return (
    <div className={`stadium-3d ${ready ? 'ready' : ''} ${className}`}>
      <StadiumArt stadiumId={stadiumId} mono={mono} className="stadium-3d-still" />
      {/* Eigene Canvas je Stadion: ein verworfener WebGL-Kontext lässt sich nicht wiederverwenden */}
      <canvas key={`${stadiumId}-${mono}`} ref={canvasRef} className="stadium-3d-canvas" />
    </div>
  )
}
