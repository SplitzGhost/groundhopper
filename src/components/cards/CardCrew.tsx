// Die Hopper auf der Sammelkarte. Seitlich stehen sie halb hinter der Kartenkante und lehnen sich mit dem
// Oberkörper vor die Karte (Kopf, Trikot und Arme vorn, Hüfte und Beine dahinter). Ab drei Hoppern kann einer
// auch oben hinter der Karte hervorschauen. Ort und Pose sind je Karte zufällig, bleiben aber für dieselbe
// Karte immer gleich. Die Arme sind eigene Bilder und werden gedreht (winken, jubeln, aufstützen).
//
// Jede Karte zeigt die Hopper in zwei Ebenen: „back“ liegt hinter der Karte (ganze Figur, nur außerhalb der
// Karte sichtbar), „front“ davor (nur der Oberkörper bis zur Trikotkante).

import { memo, useEffect, useRef, useState, type CSSProperties } from 'react'
import type { CrewMember } from '../../state/crew.ts'
import type { HopperLook } from '../../lib/hopper/look.ts'
import type { HopperParts } from '../../lib/hopper/paint.ts'
import { ARMS, EYE_POINT, FIG_H, FIG_W, WAIST } from '../../lib/hopper/figure.ts'

const engine = () => import('../../lib/hopper/paint.ts')

/** Links, rechts und zweimal oben */
const MAX = 4
/** Breite der Figur in cqw (Prozent der Kartenbreite) */
const FW = 22
const FH = (FW * FIG_H) / FIG_W
/** Abstand vom Augenpunkt bis zum Scheitel in cqw */
const CROWN = (EYE_POINT.y / FIG_W) * FW
/** Vorn wird der Körper an der Trikotkante abgeschnitten (Anteil unten in %) */
const WAIST_CUT = ((FIG_H - WAIST) / FIG_H) * 100

type Edge = 'top' | 'left' | 'right'
export type CrewLayer = 'back' | 'front'

interface Pose {
  edge: Edge
  /** Lage entlang der Kante (0–1) */
  t: number
  /** Wie weit die Augen über die Kante hinausragen (cqw, negativ = über der Karte) */
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
const raise = (arm: 0 | 1, deg: number) => (arm === 0 ? deg : -deg)

function pose(edge: Edge, t: number, r: () => number): Pose {
  const flip = r() < 0.5
  if (edge === 'top') {
    const kind = r()
    const tilt = between(r, -11, 11)
    // nur spähen
    if (kind < 0.4) return { edge, t, out: between(r, 2.2, 4), tilt, arms: [between(r, 0, 8), -between(r, 0, 8)], wave: null, flip }
    // winken
    if (kind < 0.75) {
      const w = r() < 0.5 ? 0 : 1
      const up = between(r, 128, 142)
      return { edge, t, out: between(r, 6, 7.5), tilt, arms: w === 0 ? [up, -4] : [4, -up], wave: w, flip }
    }
    // jubeln: beide Arme hoch
    return { edge, t, out: between(r, 7, 8.5), tilt: tilt * 0.5, arms: [between(r, 122, 136), -between(r, 122, 136)], wave: null, flip }
  }
  // Seitlich: oben zur Kartenmitte geneigt, Augen schon über der Karte
  const s = edge === 'right' ? -1 : 1
  // Arm zur Kartenmitte hin (rechte Kante: im ungespiegelten Bild der linke Arm)
  const inner: 0 | 1 = (edge === 'right') !== flip ? 0 : 1
  const outer: 0 | 1 = inner === 0 ? 1 : 0
  const arms: [number, number] = [between(r, 0, 10), -between(r, 0, 10)]
  let wave: 0 | 1 | null = null
  const kind = r()
  if (kind < 0.35) {
    // winkt nach außen
    arms[outer] = raise(outer, between(r, 115, 135))
    wave = outer
  } else if (kind < 0.65) {
    // stützt sich mit dem inneren Arm auf die Karte
    arms[inner] = raise(inner, between(r, 55, 80))
  } else if (kind < 0.8) {
    // winkt über der Karte
    arms[inner] = raise(inner, between(r, 120, 140))
    wave = inner
  }
  return { edge, t, out: -between(r, 4, 6.5), tilt: s * between(r, 8, 17), arms, wave, flip }
}

/** 1–2 Hopper nur an den Seiten, ab dem dritten auch oben */
function poses(seed: string, n: number): Pose[] {
  const r = rng(seed)
  const first: Edge = r() < 0.5 ? 'left' : 'right'
  const edges: Edge[] = [first, first === 'left' ? 'right' : 'left', 'top', 'top'].slice(0, n) as Edge[]
  const topT = r() < 0.5 ? [between(r, 0.22, 0.38), between(r, 0.62, 0.78)] : [between(r, 0.62, 0.78), between(r, 0.22, 0.38)]
  let tops = 0
  return edges.map((edge) => {
    let t: number
    // Links unten und rechts oben – dort liegen die Wappen nicht
    if (edge === 'left') t = between(r, 0.46, 0.66)
    else if (edge === 'right') t = between(r, 0.27, 0.45)
    else t = n === 3 ? between(r, 0.32, 0.68) : topT[tops++]
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

/** Woher der Hopper beim Erscheinen kommt: oben hinter der Karte hoch, seitlich von außen herein */
function entrance(p: Pose): CSSProperties {
  if (p.edge === 'top') return { '--hy': `${p.out + CROWN + 3}cqw` } as CSSProperties
  return { '--hx': `${p.edge === 'right' ? 12 : -12}cqw`, '--ho': 0 } as CSSProperties
}

const pct = (v: number, of: number) => `${(v / of) * 100}%`

const Peeker = memo(function Peeker({ look, kit, pose: p, index, layer }: {
  look: HopperLook; kit: string | null; pose: Pose; index: number; layer: CrewLayer
}) {
  const figRef = useRef<HTMLSpanElement>(null)
  const bodyRef = useRef<HTMLCanvasElement>(null)
  const armRefs = useRef<(HTMLCanvasElement | null)[]>([])
  const [loaded, setLoaded] = useState(false)
  const lookJson = JSON.stringify(look)
  // Hinten bei seitlichen Hoppern nur der Körper (Beine neben der Karte), Arme sind vorn
  const arms = p.edge === 'top' || layer === 'front'
  const cut = p.edge !== 'top' && layer === 'front'

  useEffect(() => {
    const fig = figRef.current
    if (!fig) return
    let cancelled = false
    let parts: HopperParts | null = null

    // Jede Leinwand in ihrer Layoutgröße × Pixeldichte – nie größer gestreckt, daher scharf
    const paintInto = (el: HTMLCanvasElement | null | undefined, src: HTMLCanvasElement) => {
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
        const res = await m.hopperParts(JSON.parse(lookJson) as HopperLook, kit)
        if (cancelled) return
        parts = res
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

  const style = { ...anchor(p), ...entrance(p), rotate: `${p.tilt}deg`, '--i': index } as CSSProperties
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
          {arms && ARMS.map((b, k) => (
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
          <canvas ref={bodyRef} className="mc-peek-body" style={cut ? { clipPath: `inset(0 0 ${WAIST_CUT}% 0)` } : undefined} />
        </span>
      </span>
    </span>
  )
})

export const CardCrew = memo(function CardCrew({ crew, seed, layer }: { crew: CrewMember[]; seed: string; layer: CrewLayer }) {
  const shown = crew.slice(0, MAX)
  const spots = poses(seed + '|' + shown.map((m) => m.key).join(','), shown.length)
  return (
    <span className={`mc-crew ${layer}`} aria-hidden>
      {shown.map((m, i) => spots[i] && (layer === 'back' || spots[i].edge !== 'top') && (
        <Peeker key={m.key} look={m.look} kit={m.kit} pose={spots[i]} index={i} layer={layer} />
      ))}
    </span>
  )
})
