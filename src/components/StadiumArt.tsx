// 3D-Standbild eines Stadions mit Akzenten in Vereinsfarben.
// `mono`: als weißes Architekturmodell – für noch nicht gesammelte Stadien.
// three.js wird erst geladen, wenn das erste Bild sichtbar wird; gerendert wird nur, was ins Bild scrollt.

import { memo, useEffect, useRef, useState } from 'react'
import { stadiumById } from '../lib/stadiums.ts'
import type { SnapSize } from '../lib/stadium3d/render.ts'

const engine = () => import('../lib/stadium3d/render.ts')

interface Props {
  stadiumId: string
  mono?: boolean
  className?: string
  /** sm für kleine Vorschaubilder, lg für Karten */
  size?: SnapSize
}

export const StadiumArt = memo(function StadiumArt({ stadiumId, mono = false, className = '', size = 'lg' }: Props) {
  const ref = useRef<HTMLImageElement>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const stadium = stadiumById(stadiumId)
    const el = ref.current
    if (!stadium || !el) return
    let cancelled = false
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      io.disconnect()
      engine()
        .then((m) => m.snapshot(stadium, mono, size))
        .then((u) => { if (!cancelled) setUrl(u) })
        .catch(() => undefined)
    }, { rootMargin: '240px' })
    io.observe(el)
    return () => {
      cancelled = true
      io.disconnect()
    }
  }, [stadiumId, mono, size])

  return (
    <img ref={ref} className={`stadium-art ${loaded ? 'loaded' : ''} ${className}`} src={url ?? undefined}
      alt="" draggable={false} decoding="async" onLoad={() => setLoaded(true)} />
  )
})
