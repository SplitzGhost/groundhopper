// Die Hopper auf der Sammelkarte: Sie stehen hinter der Karte und schauen am Rand hervor – oben über die
// Kante, seitlich oder an einer Ecke, mal nur spähend, mal winkend oder jubelnd. Ort und Pose sind je Karte
// zufällig, bleiben aber für dieselbe Karte immer gleich. Die Arme sind eigene Bilder und werden gedreht.

import { memo, useEffect, useRef, useState, type CSSProperties } from 'react'
import type { CrewMember } from '../../state/crew.ts'
import type { HopperLook } from '../../lib/hopper/look.ts'
import type { HopperParts } from '../../lib/hopper/paint.ts'
import { ARMS, EYE_POINT, FIG_H, FIG_W } from '../../lib/hopper/figure.ts'

const engine = () => import('../../lib/hopper/paint.ts')

/** Mehr Plätze gibt der Kartenrand nicht her */
const MAX = 4
/** Breite der Figur in cqw (Prozent der Kartenbreite) */
const FW = 17
const FH = (FW * FIG_H) / FIG_W
/** Abstand vom Augenpunkt bis zum Scheitel in cqw */
const CROWN = (EYE_POINT.y / FIG_W) * FW

type Edge = 'top' | 'left' | 'right' | 'tl' | 'tr'

interface Pose {
  edge: Edge
  /** Lage entlang der Kante (0–1) */
  t: number
  /** Wie weit die Augen über die Kante hinausragen (cqw) */
  out: number
  /** Neigung der Figur in Grad (positiv = im Uhrzeigersinn) */
  tilt: number
  /** Armwinkel links und rechts in Grad (0 = hängend, angehoben: links positiv, rechts negativ) */
  arms: [number, number]
  /** Welcher Arm winkt */
  wave: 0 | 1 | null
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
  if (edge === 'top') {
    const kind = r()
    const tilt = between(r, -11, 11)
    // nur spähen
    if (kind < 0.4) return { edge, t, out: between(r, 1.6, 3), tilt, arms: [between(r, 0, 8), -between(r, 0, 8)], wave: null, flip }
    // winken
    if (kind < 0.75) {
      const w = r() < 0.5 ? 0 : 1
      const up = between(r, 128, 142)
      return { edge, t, out: between(r, 4.5, 5.5), tilt, arms: w === 0 ? [up, -4] : [4, -up], wave: w, flip }
    }
    // jubeln: beide Arme hoch
    return { edge, t, out: between(r, 5.5, 6.5), tilt: tilt * 0.5, arms: [between(r, 122, 136), -between(r, 122, 136)], wave: null, flip }
  }
  if (edge === 'left' || edge === 'right') {
    const s = edge === 'right' ? 1 : -1
    // Der Arm zur Kante hin winkt manchmal (rechte Kante: rechter Arm, im Bild ungespiegelt)
    const waving = r() < 0.5
    const outer = (edge === 'right') !== flip ? 1 : 0
    const arms: [number, number] = [between(r, 0, 10), -between(r, 0, 10)]
    if (waving) arms[outer] = outer === 0 ? between(r, 110, 130) : -between(r, 110, 130)
    return { edge, t, out: between(r, 0.5, 2), tilt: s * between(r, 22, 32), arms, wave: waving ? outer : null, flip }
  }
  const s = edge === 'tr' ? 1 : -1
  return { edge, t, out: between(r, 1.5, 3), tilt: s * between(r, 38, 48), arms: [between(r, 0, 10), -between(r, 0, 10)], wave: null, flip }
}

/** Plätze am Rand: jede Kante höchstens einmal, oben auch zweimal (mit Abstand) */
function poses(seed: string, n: number): Pose[] {
  const r = rng(seed)
  const edges: Edge[] = ['top', 'top', 'left', 'right', 'tl', 'tr']
  // Oben ist der schönste Platz – der Besitzer landet dort öfter
  const order = edges.map((e, i) => ({ e, k: r() + (e === 'top' && i === 0 ? -0.35 : 0) })).sort((a, b) => a.k - b.k).map((x) => x.e)
  const out: Pose[] = []
  for (const edge of order) {
    if (out.length >= n) break
    // Ecken nicht zusammen mit der angrenzenden Seite (die Figuren würden sich überlappen)
    if (edge === 'tl' && out.some((p) => p.edge === 'left' || (p.edge === 'top' && p.t < 0.4))) continue
    if (edge === 'tr' && out.some((p) => p.edge === 'right' || (p.edge === 'top' && p.t > 0.6))) continue
    if ((edge === 'left' && out.some((p) => p.edge === 'tl')) || (edge === 'right' && out.some((p) => p.edge === 'tr'))) continue
    let t: number
    if (edge === 'top') {
      const other = out.find((p) => p.edge === 'top')
      t = other ? (other.t < 0.5 ? between(r, 0.62, 0.8) : between(r, 0.2, 0.38)) : between(r, 0.22, 0.78)
      if (out.some((p) => (p.edge === 'tl' && t < 0.4) || (p.edge === 'tr' && t > 0.6))) t = 1 - t
    } else if (edge === 'left' || edge === 'right') t = between(r, 0.28, 0.72)
    else t = 0
    out.push(pose(edge, t, r))
  }
  return out
}

// ---------- Darstellung ----------

/** Lage des Augenpunkts am Kartenrand und Drehung */
function anchor(p: Pose): CSSProperties {
  const c = 1.9 // Mitte der abgerundeten Ecke
  const d = p.out * Math.SQRT1_2
  switch (p.edge) {
    case 'top': return { left: `${p.t * 100}%`, top: `${-p.out}cqw` }
    case 'left': return { left: `${-p.out}cqw`, top: `${p.t * 100}%` }
    case 'right': return { left: `calc(100% + ${p.out}cqw)`, top: `${p.t * 100}%` }
    case 'tl': return { left: `${c - d}cqw`, top: `${c - d}cqw` }
    case 'tr': return { left: `calc(100% - ${c - d}cqw)`, top: `${c - d}cqw` }
  }
}

const pct = (v: number, of: number) => `${(v / of) * 100}%`

const Peeker = memo(function Peeker({ look, kit, pose: p, index }: { look: HopperLook; kit: string | null; pose: Pose; index: number }) {
  const figRef = useRef<HTMLSpanElement>(null)
  const bodyRef = useRef<HTMLCanvasElement>(null)
  const armRefs = useRef<(HTMLCanvasElement | null)[]>([])
  const [loaded, setLoaded] = useState(false)
  const lookJson = JSON.stringify(look)

  useEffect(() => {
    const fig = figRef.current
    if (!fig) return
    let cancelled = false
    let parts: HopperParts | null = null

    // Jede Leinwand in ihrer Layoutgröße × Pixeldichte – nie größer gestreckt, daher scharf
    const paintInto = (el: HTMLCanvasElement | null, src: HTMLCanvasElement) => {
      if (!el) return
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
      g.drawImage(src, 0, 0, w, h)
    }
    const draw = () => {
      if (!parts) return
      paintInto(bodyRef.current, parts.body)
      parts.arms.forEach((a, k) => paintInto(armRefs.current[k], a))
    }

    const ro = new ResizeObserver(draw)
    ro.observe(fig)
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      io.disconnect()
      engine().then(async (m) => {
        const p = await m.hopperParts(JSON.parse(lookJson) as HopperLook, kit)
        if (cancelled) return
        parts = p
        draw()
        setLoaded(true)
      }).catch(() => undefined)
    }, { rootMargin: '240px' })
    io.observe(fig)
    return () => {
      cancelled = true
      io.disconnect()
      ro.disconnect()
    }
  }, [lookJson, kit])

  const style = {
    ...anchor(p),
    rotate: `${p.tilt}deg`,
    // so weit nach hinten, dass auch der Scheitel hinter der Karte verschwindet
    '--hide': `${p.out + CROWN + 3}cqw`,
    '--i': index,
  } as CSSProperties
  return (
    <span className={`mc-peek ${loaded ? 'loaded' : ''}`} style={style}>
      <span className="mc-peek-slide">
        <span ref={figRef} className="mc-peek-fig" style={{
          width: `${FW}cqw`,
          height: `${FH}cqw`,
          left: `${(-EYE_POINT.x / FIG_W) * FW}cqw`,
          top: `${(-EYE_POINT.y / FIG_W) * FW}cqw`,
          transformOrigin: `${pct(EYE_POINT.x, FIG_W)} ${pct(EYE_POINT.y, FIG_H)}`,
          scale: p.flip ? '-1 1' : undefined,
        }}>
          {ARMS.map((b, k) => (
            <canvas key={k} ref={(el) => { armRefs.current[k] = el }} className={`mc-peek-arm ${p.wave === k ? 'wave' : ''}`} style={{
              left: pct(b.x, FIG_W),
              top: pct(b.y, FIG_H),
              width: pct(b.w, FIG_W),
              height: pct(b.h, FIG_H),
              transformOrigin: `${pct(b.px - b.x, b.w)} ${pct(b.py - b.y, b.h)}`,
              '--a': `${p.arms[k]}deg`,
              '--sw': k === 0 ? 1 : -1,
            } as CSSProperties} />
          ))}
          <canvas ref={bodyRef} className="mc-peek-body" />
        </span>
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
