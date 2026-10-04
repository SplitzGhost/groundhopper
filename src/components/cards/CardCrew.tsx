// Die Hopper auf der Sammelkarte: Sie stehen komplett hinter der Karte, nur der Kopf schaut über die Kante –
// bei ein oder zwei Hoppern seitlich (schräg geneigt), ab dem dritten auch oben. Ort, Neigung und
// Blickrichtung sind je Karte zufällig, bleiben aber für dieselbe Karte immer gleich.

import { memo, useEffect, useRef, useState, type CSSProperties } from 'react'
import type { CrewMember } from '../../state/crew.ts'
import type { HopperLook } from '../../lib/hopper/look.ts'
import { EYE_POINT, FIG_H, FIG_W, NECK } from '../../lib/hopper/figure.ts'

const engine = () => import('../../lib/hopper/paint.ts')

/** Links, rechts und zweimal oben */
const MAX = 4
/** Breite der Figur in cqw (Prozent der Kartenbreite) */
const FW = 22
const FH = (FW * FIG_H) / FIG_W
const PX = FW / FIG_W
/** Abstand vom Augenpunkt bis zum Scheitel in cqw */
const CROWN = EYE_POINT.y * PX
/** Unterhalb des Halses ist nichts zu sehen – Schultern und Trikot bleiben immer hinter der Karte */
const NECK_CLIP = `polygon(-100% -100%, 200% -100%, 200% ${(NECK / FIG_H) * 100}%, -100% ${(NECK / FIG_H) * 100}%)`
/** Halsansatz relativ zum Augenpunkt (cqw): halbe Breite und Abstand nach unten */
const NECK_HALF = 82 * PX
const NECK_DOWN = (NECK - EYE_POINT.y) * PX

type Edge = 'top' | 'left' | 'right'

interface Pose {
  edge: Edge
  /** Lage entlang der Kante (0–1) */
  t: number
  /** Wie weit die Augen über die Kante hinausragen (cqw, negativ = noch hinter der Karte) */
  out: number
  /** Neigung der Figur in Grad (positiv = im Uhrzeigersinn) */
  tilt: number
  flip: boolean
}

// ---------- Zufall (fest je Karte) ----------

function rng(seed: string) {
  let h = 1779033703
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353) >>> 0
  return () => {
    h = (h + 0x6d2b79f5) >>> 0
    let t = h
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const between = (r: () => number, a: number, b: number) => a + (b - a) * r()

function pose(edge: Edge, t: number, r: () => number): Pose {
  const flip = r() < 0.5
  // Oben: Haare und Augen über der Kante, Kinn noch dahinter
  if (edge === 'top') return { edge, t, out: between(r, 3, 5), tilt: between(r, -12, 12), flip }
  // Seitlich: Kopf schräg um die Kante geneigt, der Halsansatz bleibt knapp hinter der Karte
  const lean = between(r, 40, 52)
  const rad = (lean * Math.PI) / 180
  const neck = NECK_HALF * Math.cos(rad) - NECK_DOWN * Math.sin(rad)
  return { edge, t, out: -neck - 0.6, tilt: (edge === 'right' ? 1 : -1) * lean, flip }
}

/** 1–2 Hopper nur an den Seiten, ab dem dritten auch oben */
function poses(seed: string, n: number): Pose[] {
  const r = rng(seed)
  const first: Edge = r() < 0.5 ? 'left' : 'right'
  const edges = ([first, first === 'left' ? 'right' : 'left', 'top', 'top'] as Edge[]).slice(0, n)
  const topT = r() < 0.5 ? [between(r, 0.22, 0.38), between(r, 0.62, 0.78)] : [between(r, 0.62, 0.78), between(r, 0.22, 0.38)]
  let tops = 0
  return edges.map((edge) => {
    let t: number
    if (edge === 'left' || edge === 'right') t = between(r, 0.2, 0.75)
    else t = n === 3 ? between(r, 0.3, 0.7) : topT[tops++]
    return pose(edge, t, r)
  })
}

// ---------- Darstellung ----------

/** Lage des Augenpunkts am Kartenrand */
function anchor(p: Pose): CSSProperties {
  switch (p.edge) {
    case 'top': return { left: `${p.t * 100}%`, top: `${-p.out}cqw` }
    case 'left': return { left: `${-p.out}cqw`, top: `${p.t * 100}%` }
    case 'right': return { left: `calc(100% + ${p.out}cqw)`, top: `${p.t * 100}%` }
  }
}

const pct = (v: number, of: number) => `${(v / of) * 100}%`

const Peeker = memo(function Peeker({ look, kit, pose: p, index }: { look: HopperLook; kit: string | null; pose: Pose; index: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [loaded, setLoaded] = useState(false)
  const lookJson = JSON.stringify(look)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let cancelled = false
    let body: HTMLCanvasElement | null = null

    // In Layoutgröße × Pixeldichte zeichnen – nie größer gestreckt, daher scharf
    const draw = () => {
      if (!body) return
      const dpr = Math.min(window.devicePixelRatio || 1, 3)
      const w = Math.round(el.clientWidth * dpr)
      const h = Math.round(el.clientHeight * dpr)
      if (!w || !h) return
      if (el.width !== w || el.height !== h) {
        el.width = w
        el.height = h
      }
      const g = el.getContext('2d')!
      g.clearRect(0, 0, w, h)
      g.imageSmoothingEnabled = true
      g.imageSmoothingQuality = 'high'
      g.drawImage(body, 0, 0, w, h)
    }

    const ro = new ResizeObserver(draw)
    ro.observe(el)
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      io.disconnect()
      engine().then(async (m) => {
        // Arme braucht es nicht – die sind unterhalb des Halses und damit immer hinter der Karte
        const parts = await m.hopperParts(JSON.parse(lookJson) as HopperLook, kit)
        if (cancelled) return
        body = parts.body
        draw()
        setLoaded(true)
      }).catch(() => undefined)
    }, { rootMargin: '240px' })
    io.observe(el)
    return () => {
      cancelled = true
      io.disconnect()
      ro.disconnect()
    }
  }, [lookJson, kit])

  const style = {
    ...anchor(p),
    rotate: `${p.tilt}deg`,
    // Zum Erscheinen schiebt sich der Kopf entlang der Figur hinter der Karte hervor
    '--hy': `${CROWN + Math.max(p.out, 0) + 4}cqw`,
    '--i': index,
  } as CSSProperties
  return (
    <span className={`mc-peek ${loaded ? 'loaded' : ''}`} style={style}>
      <span className="mc-peek-slide">
        <canvas ref={ref} className="mc-peek-fig" style={{
          width: `${FW}cqw`,
          height: `${FH}cqw`,
          left: `${-EYE_POINT.x * PX}cqw`,
          top: `${-EYE_POINT.y * PX}cqw`,
          transformOrigin: `${pct(EYE_POINT.x, FIG_W)} ${pct(EYE_POINT.y, FIG_H)}`,
          scale: p.flip ? '-1 1' : undefined,
          clipPath: NECK_CLIP,
        }} />
      </span>
    </span>
  )
})

export const CardCrew = memo(function CardCrew({ crew, seed }: { crew: CrewMember[]; seed: string }) {
  const shown = crew.slice(0, MAX)
  const spots = poses(seed + '|' + shown.map((m) => m.key).join(','), shown.length)
  return (
    <span className="mc-crew" aria-hidden>
      {shown.map((m, i) => spots[i] && <Peeker key={m.key} look={m.look} kit={m.kit} pose={spots[i]} index={i} />)}
    </span>
  )
})
