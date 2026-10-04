// Bild eines Hoppers als Canvas: Die Figur wird einmal gemalt (lib/hopper/paint.ts) und hier nur noch
// in passender Größe hineinkopiert – schneller als ein Bild zu erzeugen. Der Maler wird erst geladen,
// wenn das Bild ins Blickfeld kommt.

import { memo, useEffect, useRef, useState } from 'react'
import type { HopperLook } from '../lib/hopper/look.ts'
import type { Framing } from '../lib/hopper/paint.ts'

const engine = () => import('../lib/hopper/paint.ts')

interface Props {
  look: HopperLook
  kit: string | null
  framing?: Framing
  /** contain: ganze Figur sichtbar, cover: Fläche ausfüllen (z. B. runde Profilbilder) */
  fit?: 'contain' | 'cover'
  className?: string
  /** Sofort laden statt erst beim Hineinscrollen (Editor) */
  eager?: boolean
}

export const HopperArt = memo(function HopperArt({ look, kit, framing = 'full', fit = 'contain', className = '', eager = false }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [loaded, setLoaded] = useState(false)
  const lookJson = JSON.stringify(look)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let cancelled = false
    let source: HTMLCanvasElement | null = null
    let rect: [number, number, number, number] | null = null

    const draw = () => {
      if (!source || !rect) return
      const box = el.getBoundingClientRect()
      if (!box.width || !box.height) return
      const dpr = Math.min(window.devicePixelRatio || 1, 3)
      const w = Math.round(box.width * dpr)
      const h = Math.round(box.height * dpr)
      if (el.width !== w || el.height !== h) {
        el.width = w
        el.height = h
      }
      const g = el.getContext('2d')!
      g.clearRect(0, 0, w, h)
      const [sx, sy, sw, sh] = rect
      const scale = fit === 'cover' ? Math.max(w / sw, h / sh) : Math.min(w / sw, h / sh)
      const dw = sw * scale
      const dh = sh * scale
      g.imageSmoothingQuality = 'high'
      // Figur unten bündig (steht auf dem Boden), waagerecht mittig
      g.drawImage(source, sx, sy, sw, sh, (w - dw) / 2, fit === 'cover' ? (h - dh) / 2 : h - dh, dw, dh)
    }

    const load = () => {
      engine().then(async (m) => {
        const c = await m.hopperCanvas(JSON.parse(lookJson) as HopperLook, kit)
        if (cancelled) return
        source = c
        rect = m.frameRect(framing)
        draw()
        setLoaded(true)
      }).catch(() => undefined)
    }

    const ro = new ResizeObserver(draw)
    ro.observe(el)
    let io: IntersectionObserver | null = null
    if (eager) load()
    else {
      io = new IntersectionObserver((entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        io?.disconnect()
        load()
      }, { rootMargin: '240px' })
      io.observe(el)
    }
    return () => {
      cancelled = true
      io?.disconnect()
      ro.disconnect()
    }
  }, [lookJson, kit, framing, fit, eager])

  return <canvas ref={ref} className={`hopper-art ${framing} ${loaded ? 'loaded' : ''} ${className}`} aria-hidden />
})
