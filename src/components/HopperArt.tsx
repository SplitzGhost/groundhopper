// Standbild eines Hoppers. three.js wird erst geladen, wenn das Bild ins Blickfeld kommt.

import { memo, useEffect, useRef, useState } from 'react'
import type { HopperLook } from '../lib/hopper/look.ts'
import type { Framing, SnapSize } from '../lib/hopper/render.ts'

const engine = () => import('../lib/hopper/render.ts')

interface Props {
  look: HopperLook
  kit: string | null
  framing?: Framing
  size?: SnapSize
  turn?: number
  wave?: number
  className?: string
}

export const HopperArt = memo(function HopperArt({ look, kit, framing = 'full', size = 'md', turn = 0, wave = 0, className = '' }: Props) {
  const ref = useRef<HTMLImageElement>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const lookJson = JSON.stringify(look)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let cancelled = false
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      io.disconnect()
      engine()
        .then((m) => m.snapshot(JSON.parse(lookJson) as HopperLook, kit, { framing, size, turn, wave }))
        .then((u) => { if (!cancelled) setUrl(u) })
        .catch(() => undefined)
    }, { rootMargin: '240px' })
    io.observe(el)
    return () => {
      cancelled = true
      io.disconnect()
    }
  }, [lookJson, kit, framing, size, turn, wave])

  return (
    <img ref={ref} className={`hopper-art ${framing} ${loaded ? 'loaded' : ''} ${className}`} src={url ?? undefined}
      alt="" draggable={false} decoding="async" onLoad={() => setLoaded(true)} />
  )
})
