// Vereinfachte 3D-Grafik eines Stadions mit Akzenten in Vereinsfarben.
// `mono`: als weißes Architekturmodell – für noch nicht gesammelte Stadien.

import { memo, useId, useMemo } from 'react'
import { stadiumById } from '../lib/stadiums.ts'
import { sceneFor } from '../lib/stadiumScene.ts'

interface Props {
  stadiumId: string
  mono?: boolean
  className?: string
}

export const StadiumArt = memo(function StadiumArt({ stadiumId, mono = false, className }: Props) {
  const uid = useId().replace(/:/g, '')
  const stadium = stadiumById(stadiumId)
  const scene = useMemo(() => (stadium ? sceneFor(stadium, mono) : null), [stadium, mono])
  if (!scene) return null

  return (
    <svg className={className} viewBox={scene.viewBox} preserveAspectRatio="xMidYMid meet" aria-hidden
      shapeRendering="geometricPrecision">
      <defs>
        <filter id={`blur${uid}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <filter id={`glow${uid}`} x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="0.9" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <pattern id={`lat${uid}`} width="3.2" height="2.2" patternUnits="userSpaceOnUse">
          <path d="M0 1.1L1.6 0L3.2 1.1L1.6 2.2Z" fill="none" stroke="#000" strokeOpacity="0.16" strokeWidth="0.25" />
        </pattern>
        <pattern id={`latl${uid}`} width="3.2" height="2.2" patternUnits="userSpaceOnUse">
          <path d="M0 1.1L1.6 0L3.2 1.1L1.6 2.2Z" fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="0.3" />
        </pattern>
      </defs>
      {scene.shapes.map((s, i) => (
        <g key={i}>
          <path
            d={s.d}
            fill={s.fill}
            fillOpacity={s.stroke && s.fill === 'none' ? undefined : s.opacity}
            strokeOpacity={s.stroke ? s.opacity : undefined}
            stroke={s.stroke ?? s.fill}
            strokeWidth={s.stroke ? s.strokeWidth : 0.15}
            strokeLinejoin="round"
            strokeLinecap="round"
            filter={s.blur ? `url(#blur${uid})` : s.glow ? `url(#glow${uid})` : undefined}
          />
          {s.pattern && <path d={s.d} fill={`url(#${s.pattern === 'lattice' ? 'lat' : 'latl'}${uid})`} />}
        </g>
      ))}
    </svg>
  )
})
