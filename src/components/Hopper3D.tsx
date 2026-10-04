// Drehbarer Hopper für den Editor: Wischen dreht mit Schwung, danach pendelt er zurück nach vorn
// und wippt leicht. Tippen lässt ihn hüpfen. Bis die Szene steht, liegt das Standbild darunter.

import { useEffect, useRef, useState } from 'react'
import type { HopperLook } from '../lib/hopper/look.ts'
import type { LiveHopper } from '../lib/hopper/render.ts'
import { HopperArt } from './HopperArt.tsx'

const engine = () => import('../lib/hopper/render.ts')

/** Drehung pro Pixel Wischweg */
const RAD_PER_PX = 0.012
/** Grundhaltung: leicht zur Seite gedreht */
const REST = -0.22

interface Props {
  look: HopperLook
  kit: string | null
  className?: string
}

export function Hopper3D({ look, kit, className = '' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const liveRef = useRef<LiveHopper | null>(null)
  const hopRef = useRef(0)
  const [ready, setReady] = useState(false)
  const lookJson = JSON.stringify(look)
  // Aktueller Stand für den Moment, in dem die Engine fertig geladen ist
  const wantRef = useRef({ lookJson, kit })
  wantRef.current = { lookJson, kit }

  const apply = (live: LiveHopper, bounce: boolean) => {
    const { lookJson: l, kit: k } = wantRef.current
    void live.set(JSON.parse(l) as HopperLook, k).then(() => {
      if (liveRef.current !== live) return
      setReady(true)
      if (bounce && hopRef.current === 0) hopRef.current = 0.6
    })
  }

  // Szene einmal aufbauen
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
    let disposed = false
    let raf = 0
    let ro: ResizeObserver | null = null
    let vel = 0
    let prev = performance.now()
    let t0 = prev
    let drag: { x0: number; x: number; t: number; moved: boolean; start: number } | null = null

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const live = liveRef.current
      const dt = Math.min(0.05, (now - prev) / 1000)
      prev = now
      if (!live || document.hidden) return
      if (!drag) {
        // Schwung abklingen lassen, dann sanft zurück zur Grundhaltung
        vel *= Math.exp(-dt * 3.2)
        live.turn += vel * dt
        if (Math.abs(vel) < 0.6) {
          // auf die nächste volle Umdrehung zurückfedern
          const target = REST + Math.round((live.turn - REST) / (Math.PI * 2)) * Math.PI * 2
          live.turn += (target - live.turn) * (1 - Math.exp(-dt * 3))
        }
      }
      live.bob = reduceMotion ? 0 : ((now - t0) / 3200) % 1
      // Hüpfer nach dem Antippen
      if (hopRef.current > 0) hopRef.current = Math.max(0, hopRef.current - dt * 2.2)
      live.hop = Math.sin((1 - hopRef.current) * Math.PI) * (hopRef.current > 0 ? 1 : 0)
      live.render()
    }

    const onDown = (e: PointerEvent) => {
      drag = { x0: e.clientX, x: e.clientX, t: e.timeStamp, moved: false, start: e.timeStamp }
      vel = 0
    }
    const onMove = (e: PointerEvent) => {
      const live = liveRef.current
      if (!drag || !live) return
      const dx = e.clientX - drag.x
      const dtm = Math.max(1, e.timeStamp - drag.t) / 1000
      if (!drag.moved && Math.abs(e.clientX - drag.x0) > 5) {
        drag.moved = true
        canvas.setPointerCapture(e.pointerId)
      }
      live.turn += dx * RAD_PER_PX
      vel = vel * 0.6 + ((dx * RAD_PER_PX) / dtm) * 0.4
      drag.x = e.clientX
      drag.t = e.timeStamp
    }
    const onUp = (e: PointerEvent) => {
      if (!drag) return
      if (!drag.moved && e.timeStamp - drag.start < 400 && hopRef.current === 0) hopRef.current = 1
      if (e.timeStamp - drag.t > 80) vel = 0
      vel = Math.max(-14, Math.min(14, vel))
      drag = null
    }
    const onCancel = () => {
      drag = null
      vel = 0
    }
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onCancel)

    engine().then((m) => {
      if (disposed) return
      const live = new m.LiveHopper(canvas)
      liveRef.current = live
      live.turn = REST - (reduceMotion ? 0 : 1.2)
      vel = reduceMotion ? 0 : 3
      apply(live, false)
      const size = () => {
        const r = canvas.getBoundingClientRect()
        if (r.width > 0 && r.height > 0) live.resize(r.width, r.height)
      }
      size()
      ro = new ResizeObserver(size)
      ro.observe(canvas)
      prev = performance.now()
      t0 = prev
      raf = requestAnimationFrame(tick)
    }).catch(() => undefined)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      ro?.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onCancel)
      liveRef.current?.dispose()
      liveRef.current = null
    }
  }, [])

  // Aussehen oder Trikot geändert → Figur neu bauen, kleiner Hüpfer als Rückmeldung
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (liveRef.current) apply(liveRef.current, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookJson, kit])

  return (
    <div className={`hopper-3d ${ready ? 'ready' : ''} ${className}`}>
      {!ready && <HopperArt look={look} kit={kit} size="lg" turn={REST} className="hopper-3d-still" />}
      <canvas ref={canvasRef} className="hopper-3d-canvas" />
    </div>
  )
}
