// Kleines Trikot in Vereinsfarben und -muster, optional mit Wappen auf der Brust.

import { memo, useId } from 'react'
import type { KitPattern } from '../data/clubs.ts'

const BODY = 'M30 10 L40 6 Q50 12 60 6 L70 10 L92 24 L84 42 L74 37 L74 92 Q50 96 26 92 L26 37 L16 42 L8 24 Z'

function patternShapes(pattern: KitPattern, detail: string) {
  switch (pattern) {
    case 'stripes':
      return [32, 44, 56, 68].map((x) => <rect key={x} x={x - 4} y="0" width="7" height="100" fill={detail} />)
    case 'sleeves':
      return <>
        <path d="M30 10 L8 24 L16 42 L26 37 L28 18 Z" fill={detail} />
        <path d="M70 10 L92 24 L84 42 L74 37 L72 18 Z" fill={detail} />
      </>
    case 'band':
      return <rect x="0" y="38" width="100" height="13" fill={detail} />
    case 'vband':
      return <rect x="43" y="0" width="14" height="100" fill={detail} />
    case 'sash':
      return <path d="M66 6 L80 14 L36 96 L22 90 Z" fill={detail} />
    case 'halves':
      return <rect x="50" y="0" width="50" height="100" fill={detail} />
    case 'diagonal':
      return <path d="M0 0 L100 0 L100 22 L0 78 Z" fill={detail} />
    case 'cross':
      return <><rect x="44" y="0" width="12" height="100" fill={detail} /><rect x="0" y="36" width="100" height="11" fill={detail} /></>
    default:
      return null
  }
}

interface Props {
  body: string
  detail: string
  pattern: KitPattern
  crest?: string | null
  label?: string
  className?: string
}

export const Jersey = memo(function Jersey({ body, detail, pattern, crest, label, className }: Props) {
  const id = useId().replace(/:/g, '')
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden>
      <defs>
        <clipPath id={`j${id}`}><path d={BODY} /></clipPath>
        <linearGradient id={`js${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.22" />
        </linearGradient>
      </defs>
      <path d={BODY} fill={body} />
      <g clipPath={`url(#j${id})`}>
        {patternShapes(pattern, detail)}
        {/* Ärmelbündchen und Kragen */}
        <path d="M8 24 L16 42" stroke={pattern === 'sleeves' ? body : detail} strokeWidth="5" />
        <path d="M92 24 L84 42" stroke={pattern === 'sleeves' ? body : detail} strokeWidth="5" />
        <path d="M40 6 Q50 20 60 6" fill="none" stroke={detail === body ? '#00000033' : detail} strokeWidth="4" />
        {/* Falten und Licht */}
        <path d="M38 60 Q44 70 40 88 M62 58 Q57 70 61 88" fill="none" stroke="#000" strokeOpacity="0.07" strokeWidth="2" />
        <rect width="100" height="100" fill={`url(#js${id})`} />
      </g>
      <path d={BODY} fill="none" stroke="#000" strokeOpacity="0.14" strokeWidth="1" strokeLinejoin="round" />
      {crest ? (
        <image href={crest} x="54" y="24" width="13" height="13" preserveAspectRatio="xMidYMid meet" />
      ) : label ? (
        <text x="50" y="62" textAnchor="middle" fontSize="13" fontWeight="800" fill={detail === body ? '#fff' : detail}
          style={{ fontFamily: 'var(--font-rounded)', letterSpacing: '-0.5px' }}>{label}</text>
      ) : null}
    </svg>
  )
})
