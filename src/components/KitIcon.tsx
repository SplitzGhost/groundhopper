// Trikot als flaches Symbol (Vorderseite) – für den Kleiderschrank. Zeichnet dieselbe Beschreibung
// wie die Textur am Hopper: Grundfarbe, Muster, Ärmel, Kragen.

import { memo, useId } from 'react'
import type { KitSpec } from '../lib/hopper/kit.ts'

/** Umriss: Körper mit kurzen Ärmeln, Rundhals; Ärmel separat für eigene Farbe */
const BODY = 'M30 14 L41 10 Q50 16 59 10 L70 14 L71 90 Q50 94 29 90 Z'
const SLEEVE_L = 'M30 14 L12 26 Q14 36 19 42 L31 36 Z'
const SLEEVE_R = 'M70 14 L88 26 Q86 36 81 42 L69 36 Z'
const CUFF_L = 'M17 39.5 L31 33 L31 36 L19 42 Z'
const CUFF_R = 'M83 39.5 L69 33 L69 36 L81 42 Z'

function Pattern({ kit }: { kit: KitSpec }) {
  const p = kit.p
  if (!p) return null
  switch (p.k) {
    case 'stripes': {
      const n = p.n ?? 3
      const period = 42 / n
      const w = period * (p.w ?? 0.5)
      const start = n % 2 ? 50 : 50 + period / 2
      const xs: number[] = []
      for (let c = start; c < 75; c += period) xs.push(c)
      for (let c = start - period; c > 25; c -= period) xs.push(c)
      return <>{xs.map((c) => <rect key={c} x={c - w / 2} y={0} width={w} height={100} fill={p.c} />)}</>
    }
    case 'pinstripes':
      return <>{Array.from({ length: 14 }, (_, i) => <rect key={i} x={27 + i * 3.5} y={0} width={0.9} height={100} fill={p.c} />)}</>
    case 'hoops': {
      const n = p.n ?? 4
      const period = 80 / (n + 0.5)
      const h = period * (p.w ?? 0.5)
      return <>{Array.from({ length: n }, (_, i) => <rect key={i} x={0} y={18 + period * 0.5 + i * period} width={100} height={h} fill={p.c} />)}</>
    }
    case 'halves':
      return <rect x={50} y={0} width={50} height={100} fill={p.c} />
    case 'sash': {
      const w = (p.w ?? 0.2) * 70
      return p.dir === 'l'
        ? <polygon points={`${70 - w / 2},8 ${70 + w / 2},8 ${30 + w / 2},96 ${30 - w / 2},96`} fill={p.c} />
        : <polygon points={`${30 - w / 2},8 ${30 + w / 2},8 ${70 + w / 2},96 ${70 - w / 2},96`} fill={p.c} />
    }
    case 'band': {
      const y = p.y ?? 0.6
      const h = (p.h ?? 0.16) * 80
      return <rect x={0} y={92 - y * 80 - h / 2} width={100} height={h} fill={p.c} />
    }
    case 'vstripe': {
      const w = (p.w ?? 0.22) * 42
      return <rect x={50 - w / 2} y={0} width={w} height={100} fill={p.c} />
    }
    case 'chevron':
      return <polygon points="28,12 50,44 72,12 72,26 50,58 28,26" fill={p.c} />
    case 'yoke':
      return <rect x={0} y={0} width={100} height={30} fill={p.c} />
    case 'quarters':
      return <><rect x={50} y={0} width={50} height={52} fill={p.c} /><rect x={0} y={52} width={50} height={50} fill={p.c} /></>
    case 'fade':
      return null
    case 'cross': {
      const w = (p.w ?? 0.2) * 42
      return <><rect x={50 - w / 2} y={0} width={w} height={100} fill={p.c} /><rect x={0} y={28} width={100} height={13} fill={p.c} /></>
    }
    case 'diag':
      return <polygon points={p.dir === 'l' ? '71,0 0,0 0,100 29,100' : '29,0 100,0 100,100 71,100'} fill={p.c} />
    case 'checks':
      return <>{Array.from({ length: 30 }, (_, i) => {
        const col = i % 6
        const row = Math.floor(i / 6)
        return (col + row) % 2 === 0 ? <rect key={i} x={23 + col * 9} y={10 + row * 17} width={9} height={17} fill={p.c} /> : null
      })}</>
    case 'tonal':
      return <>{Array.from({ length: 12 }, (_, i) => <line key={i} x1={i * 9 - 20} y1={0} x2={i * 9 + 30} y2={100} stroke={p.c} strokeWidth={2.4} opacity={0.3} />)}</>
  }
}

export const KitIcon = memo(function KitIcon({ kit, crest, className = '' }: { kit: KitSpec; crest?: string | null; className?: string }) {
  const id = useId().replace(/:/g, '')
  const collar = kit.c ?? kit.b
  const sleeve = kit.s ?? kit.b
  const cuff = kit.cu ?? kit.c ?? sleeve
  return (
    <svg viewBox="0 0 100 100" className={`kit-icon ${className}`} aria-hidden>
      <defs>
        <clipPath id={`b${id}`}><path d={BODY} /></clipPath>
        <linearGradient id={`l${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.16" />
        </linearGradient>
        {kit.p?.k === 'fade' && (
          <linearGradient id={`f${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0.25" stopColor={kit.b} />
            <stop offset="1" stopColor={kit.p.c} />
          </linearGradient>
        )}
      </defs>
      <path d={SLEEVE_L} fill={sleeve} />
      <path d={SLEEVE_R} fill={sleeve} />
      <path d={CUFF_L} fill={cuff} />
      <path d={CUFF_R} fill={cuff} />
      <g clipPath={`url(#b${id})`}>
        <rect width={100} height={100} fill={kit.p?.k === 'fade' ? `url(#f${id})` : kit.b} />
        <Pattern kit={kit} />
        {kit.cs === 'v'
          ? <path d="M41 10 L50 26 L59 10 L55 10 L50 19 L45 10 Z" fill={collar} />
          : <path d="M41 10 Q50 20 59 10 L56 9 Q50 15 44 9 Z" fill={collar} />}
        {kit.cs === 'polo' && <rect x={49} y={12} width={2} height={12} fill={collar} />}
        {crest && <image href={crest} x={56} y={24} width={10} height={10} preserveAspectRatio="xMidYMid meet" />}
      </g>
      {/* Licht und Kontur */}
      <path d={BODY} fill={`url(#l${id})`} />
      <path d={`${BODY} ${SLEEVE_L} ${SLEEVE_R}`} fill="none" stroke="rgba(10,25,50,0.22)" strokeWidth={1.2} strokeLinejoin="round" />
    </svg>
  )
})
