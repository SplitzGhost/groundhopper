// Erzeugt aus dem Stadion-Steckbrief eine vereinfachte 3D-Szene (Schrägansicht von oben)
// als Liste fertiger 2D-Polygone. Gerendert wird sie von components/StadiumArt.tsx.
//
// Aufbau: Grundriss ist ein abgerundetes Rechteck um das Spielfeld. Tribünen sind ein Ring
// zwischen Innen- und Außenkontur (gleich breit, weil beide Kontur-Rechtecke um die Tiefe
// versetzt sind), unterteilt in Segmente. Jedes Segment liefert Sitzfläche, Außenwand,
// Innenwand und ggf. Dach. Gezeichnet wird von hinten nach vorn (Maleralgorithmus),
// abgewandte Flächen fallen weg. Licht kommt von links oben.

import type { Stadium } from '../shared/types.ts'
import { clubInfo } from '../data/clubs.ts'
import { stadiumSpec, type StadiumSpec } from '../data/stadiumInfo.ts'

export interface Shape {
  d: string
  fill: string
  opacity?: number
  stroke?: string
  strokeWidth?: number
  /** Musterfüllung (Gitterfassade) als zweite Ebene */
  pattern?: 'lattice' | 'lattice-light'
  /** Weich gezeichneter Schatten */
  blur?: boolean
  glow?: boolean
}

export interface Scene {
  viewBox: string
  shapes: Shape[]
}

type V3 = [number, number, number]
type V2 = [number, number]

// ---------- Kamera ----------

const YAW = (-15 * Math.PI) / 180
const ELEV = (34 * Math.PI) / 180
const COS_Y = Math.cos(YAW)
const SIN_Y = Math.sin(YAW)
const SIN_E = Math.sin(ELEV)
const COS_E = Math.cos(ELEV)
/** Blickrichtung zur Kamera (Kamerakoordinaten: x rechts, y nach vorn, z hoch) */
const VIEW: V3 = [0, COS_E, SIN_E]
const LIGHT: V3 = norm([-0.5, 0.32, 0.8])

function norm(v: V3): V3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/** Grundriss-Vektor in Kamerakoordinaten drehen */
const toCam = (v: V3): V3 => [v[0] * COS_Y - v[1] * SIN_Y, v[0] * SIN_Y + v[1] * COS_Y, v[2]]

function project([x, y, z]: V3): V2 {
  const [cx, cy] = toCam([x, y, z])
  return [cx, cy * SIN_E - z * COS_E]
}
const depth = ([x, y]: V3 | V2) => x * SIN_Y + y * COS_Y

// ---------- Farben ----------

function rgb(hex: string): V3 {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const hex = ([r, g, b]: V3) =>
  '#' + [r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('')

/** f < 1 abdunkeln, f > 1 aufhellen */
function shade(color: string, f: number): string {
  const c = rgb(color)
  if (f <= 1) return hex([c[0] * f, c[1] * f, c[2] * f])
  const t = Math.min(1, f - 1)
  return hex([c[0] + (255 - c[0]) * t, c[1] + (255 - c[1]) * t, c[2] + (255 - c[2]) * t])
}
export function mix(a: string, b: string, t: number): string {
  const x = rgb(a)
  const y = rgb(b)
  return hex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t])
}
const luminance = (c: string) => {
  const [r, g, b] = rgb(c)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

/** Helligkeit einer Fläche mit Normalen n (Grundriss-Koordinaten) */
function lit(color: string, n: V3, amount = 1): string {
  const d = dot(norm(toCam(n)), LIGHT)
  return shade(color, 1 + (d - 0.55) * 0.55 * amount)
}

const visible = (n: V3) => dot(toCam(n), VIEW) > 0.02

// ---------- Grundriss: abgerundetes Rechteck ----------

interface Contour { a: number; b: number; r: number }

/** Stützstelle auf der Kontur: Stück (Kante/Ecke) und Position darin */
interface Sample {
  piece: number
  t: number
  /** Ecke? (für offene Ecken bei englischen Stadien) */
  corner: boolean
}

// Reihenfolge im Uhrzeigersinn von oben gesehen: rechte Kante, Ecke vorn rechts, vordere Kante …
// (y zeigt nach vorn zur Kamera)
const PIECES = 8

function samplesFor(edgeLong: number, edgeShort: number, corner: number): Sample[] {
  const list: Sample[] = []
  for (let p = 0; p < PIECES; p++) {
    const isCorner = p % 2 === 1
    const n = isCorner ? corner : p % 4 === 0 ? edgeShort : edgeLong
    for (let i = 0; i < n; i++) list.push({ piece: p, t: i / n, corner: isCorner })
  }
  return list
}

/** Punkt und Außennormale auf der Kontur */
function at(c: Contour, s: { piece: number; t: number }): { p: V2; n: V2 } {
  const ax = c.a - c.r
  const by = c.b - c.r
  const lerp = (u: number, v: number) => u + (v - u) * s.t
  switch (s.piece) {
    case 0: return { p: [c.a, lerp(-by, by)], n: [1, 0] }
    case 2: return { p: [lerp(ax, -ax), c.b], n: [0, 1] }
    case 4: return { p: [-c.a, lerp(by, -by)], n: [-1, 0] }
    case 6: return { p: [lerp(-ax, ax), -c.b], n: [0, -1] }
    default: {
      const corner = (s.piece - 1) / 2 // 0 vorn rechts, 1 vorn links, 2 hinten links, 3 hinten rechts
      const angle = (corner + s.t) * (Math.PI / 2)
      const cx = corner === 0 || corner === 3 ? ax : -ax
      const cy = corner <= 1 ? by : -by
      const n: V2 = [Math.cos(angle), Math.sin(angle)]
      return { p: [cx + c.r * n[0], cy + c.r * n[1]], n }
    }
  }
}


const path = (pts: V2[]) => 'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L') + 'Z'
const line = (pts: V2[]) => 'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')

// ---------- Paletten ----------

interface Palette {
  seat: string
  seatUpper: string
  band: string
  facade: string
  accent: string
  roof: string
  fascia: string
  grass: [string, string]
  apron: string
  track: string
  innerWall: string
  feature: string
  lines: string
  light: string
  mono: boolean
}

const FACADES: Record<StadiumSpec['facade'], string> = {
  concrete: '#d7dbe1',
  glass: '#a9bfd4',
  brick: '#b0614a',
  metal: '#c3c9d1',
  club: '#000',
  shell: '#000',
  lattice: '#eef1f4',
}

function palette(stadium: Stadium, spec: StadiumSpec, mono: boolean): Palette {
  if (mono) {
    return {
      seat: '#e4e8ee', seatUpper: '#e9ecf1', band: '#cfd5dd', facade: '#dde2e8', accent: '#d3d9e1',
      roof: '#f6f7f9', fascia: '#d5dae2', grass: ['#e2e6eb', '#dce1e7'], apron: '#d6dbe2', track: '#d9dee5',
      innerWall: '#c9cfd8', feature: '#e6e9ee', lines: '#f8f9fb', light: '#ffffff', mono: true,
    }
  }
  const club = clubInfo(stadium.teams[0].name)
  // Sehr helle Erkennungsfarben auf weißem Dach gehen unter – dann die Zweitfarbe für Akzente
  const accent = luminance(club.primary) > 0.85 ? club.secondary : club.primary
  const facade = spec.facade === 'club' || spec.facade === 'shell'
    ? mix(club.primary, '#ffffff', spec.facade === 'shell' ? 0.08 : 0.18)
    : FACADES[spec.facade]
  // Schwarze Sitze wirken in der kleinen Grafik wie Löcher – zu Anthrazit aufhellen
  const seat = luminance(club.primary) < 0.16 ? '#3b4049' : club.primary
  return {
    seat,
    seatUpper: shade(seat, 1.1),
    band: '#27303c',
    facade,
    accent,
    roof: '#f4f6f9',
    fascia: mix(accent, '#1d2530', 0.15),
    grass: ['#5bb660', '#4ea955'],
    apron: '#3f9449',
    track: '#c9573f',
    innerWall: '#26303b',
    feature: spec.features?.includes('pylons') ? club.primary : '#e9ecf0',
    lines: '#ffffff',
    light: '#fff7d6',
    mono: false,
  }
}

// ---------- Szene ----------

const PITCH_HL = 52.5
const PITCH_HW = 34

interface Face { depth: number; shape: Shape }

export function buildScene(stadium: Stadium, mono = false): Scene {
  const spec = stadiumSpec(stadium.id)
  const pal = palette(stadium, spec, mono)
  const faces: Face[] = []
  const roofFaces: Face[] = []
  const backFeatures: Face[] = []
  const frontFeatures: Face[] = []
  const ground: Shape[] = []
  const all: V2[] = []

  const P = (v: V3) => {
    const p = project(v)
    all.push(p)
    return p
  }
  const poly = (pts: V3[]) => path(pts.map(P))

  // Größe: Kapazität bestimmt Tiefe und Höhe der Ränge
  const cap = Math.min(spec.capacity, 95000) / 95000
  const scale = 0.82 + cap * 0.45
  const depthD = (9 + 6 * spec.tiers) * scale
  const baseH = (4.5 + 5 * spec.tiers) * scale
  const sides = spec.sides ?? [1, 1, 1, 1]

  // Innenkontur je Bauform
  const track = spec.shape === 'track'
  const a = PITCH_HL + (track ? 36 : 6)
  const b = PITCH_HW + (track ? 13 : 6)
  const r = spec.shape === 'bowl' ? b * 0.92 : track ? b : spec.shape === 'arena' ? 9 : 0
  const inner: Contour = { a, b, r }
  const outer: Contour = { a: a + depthD, b: b + depthD, r: r + depthD }
  const open = spec.shape === 'box'
  const samples = samplesFor(10, 6, open ? 2 : 7)

  /** Höhenfaktor an einer Stelle: Seiten weich überblendet (bei offenen Ecken je Tribüne fest) */
  const sideAt = (n: V2, piece: number) => {
    if (open) {
      if (piece % 2 === 1) return 0
      return [sides[1], sides[2], sides[3], sides[0]][piece / 2]
    }
    const w = [Math.max(0, -n[1]), Math.max(0, n[0]), Math.max(0, n[1]), Math.max(0, -n[0])]
    const sum = w[0] + w[1] + w[2] + w[3] || 1
    return (w[0] * sides[0] + w[1] * sides[1] + w[2] * sides[2] + w[3] * sides[3]) / sum
  }
  const roofed = (n: V2) => {
    switch (spec.roof) {
      case 'none': return false
      case 'main': return n[1] < -0.55
      case 'sides': return Math.abs(n[1]) > 0.55
      default: return true
    }
  }

  // Stützstellen vorberechnen
  const pts = samples.map((s) => {
    const i = at(inner, s)
    const o = at(outer, s)
    const f = sideAt(i.n, s.piece)
    return { s, i: i.p, o: o.p, n: i.n, h: baseH * f, f, roof: roofed(i.n) && f > 0 }
  })

  const hIn = 1.4

  // ---------- Boden ----------

  const outerRing: V3[] = samples.map((s) => {
    const { p } = at({ a: outer.a + 3, b: outer.b + 3, r: outer.r + 3 }, s)
    return [p[0], p[1], 0]
  })
  ground.push({ d: poly(outerRing.map(([x, y]) => [x + 3, y + 4, 0])), fill: '#0b1a33', opacity: pal.mono ? 0.12 : 0.22, blur: true })

  const innerFloor: V3[] = samples.map((s) => [...at(inner, s).p, 0] as V3)
  ground.push({ d: poly(innerFloor), fill: pal.apron })

  if (spec.shape === 'track') {
    // Wie eine echte 400-m-Bahn: das Feld passt zwischen die Kurven, hinter den Toren bleiben die Halbkreise
    const trackOuter = { a: a - 1, b: b - 1, r: b - 1 }
    const trackInner = { a: PITCH_HL + 26, b: PITCH_HW + 3, r: PITCH_HW + 3 }
    const ring = (c: Contour) => samples.map((s) => [...at(c, s).p, 0] as V3)
    ground.push({ d: poly(ring(trackOuter)), fill: pal.track })
    ground.push({ d: poly(ring(trackInner)), fill: pal.apron })
    for (const k of [0.33, 0.66]) {
      const c = { a: trackInner.a + (trackOuter.a - trackInner.a) * k, b: trackInner.b + (trackOuter.b - trackInner.b) * k, r: 0 }
      c.r = c.b
      ground.push({ d: poly(ring(c)), fill: 'none', stroke: '#ffffff', strokeWidth: 0.25, opacity: 0.55 })
    }
  }

  // Spielfeld mit Mähstreifen
  const stripes = 12
  for (let k = 0; k < stripes; k++) {
    const x0 = -PITCH_HL + (2 * PITCH_HL * k) / stripes
    const x1 = -PITCH_HL + (2 * PITCH_HL * (k + 1)) / stripes
    ground.push({ d: poly([[x0, -PITCH_HW, 0], [x1, -PITCH_HW, 0], [x1, PITCH_HW, 0], [x0, PITCH_HW, 0]]), fill: pal.grass[k % 2] })
  }
  const lw = 0.45
  const L = (pts3: V3[], closed = true) =>
    ground.push({ d: closed ? poly(pts3) : line(pts3.map(P)), fill: 'none', stroke: pal.lines, strokeWidth: lw, opacity: 0.9 })
  const rect = (x0: number, y0: number, x1: number, y1: number) =>
    L([[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]])
  rect(-PITCH_HL, -PITCH_HW, PITCH_HL, PITCH_HW)
  L([[0, -PITCH_HW, 0], [0, PITCH_HW, 0]], false)
  L(Array.from({ length: 28 }, (_, k) => {
    const t = (k / 28) * Math.PI * 2
    return [9.15 * Math.cos(t), 9.15 * Math.sin(t), 0] as V3
  }))
  for (const sgn of [-1, 1]) {
    rect(sgn * PITCH_HL, -20.15, sgn * (PITCH_HL - 16.5), 20.15)
    rect(sgn * PITCH_HL, -9.15, sgn * (PITCH_HL - 5.5), 9.15)
    // Tor als kleiner Rahmen
    ground.push({
      d: line([[sgn * PITCH_HL, -3.66, 0], [sgn * PITCH_HL, -3.66, 2.44], [sgn * PITCH_HL, 3.66, 2.44], [sgn * PITCH_HL, 3.66, 0]].map((v) => P(v as V3))),
      fill: 'none', stroke: '#ffffff', strokeWidth: 0.6,
    })
  }

  // ---------- Tribünen ----------

  const tierStops: [number, number, 'seat' | 'upper' | 'band'][] = spec.tiers === 1
    ? [[0, 1, 'seat']]
    : spec.tiers === 2
      ? [[0, 0.47, 'seat'], [0.47, 0.54, 'band'], [0.54, 1, 'upper']]
      : [[0, 0.3, 'seat'], [0.3, 0.35, 'band'], [0.35, 0.63, 'upper'], [0.63, 0.68, 'band'], [0.68, 1, 'seat']]

  const lerp2 = (u: V2, v: V2, t: number): V2 => [u[0] + (v[0] - u[0]) * t, u[1] + (v[1] - u[1]) * t]

  pts.forEach((p0, idx) => {
    const p1 = pts[idx + 1] ?? pts[0]
    if (p0.f <= 0 || (p1.f <= 0 && !open)) return
    if (open && p0.s.corner) return
    const q1 = open && (samples[idx + 1] ?? samples[0]).corner ? { ...p1, i: at(inner, { piece: p0.s.piece, t: 1 }).p, o: at(outer, { piece: p0.s.piece, t: 1 }).p, h: p0.h, n: p0.n, roof: p0.roof, f: p0.f } : p1
    const n: V2 = [(p0.n[0] + q1.n[0]) / 2, (p0.n[1] + q1.n[1]) / 2]
    const nl = Math.hypot(n[0], n[1]) || 1
    const nn: V2 = [n[0] / nl, n[1] / nl]
    const H0 = p0.h
    const H1 = q1.h
    const d = depth([(p0.o[0] + q1.o[0]) / 2, (p0.o[1] + q1.o[1]) / 2])
    const wallTop0 = H0 + (p0.roof ? 2 : 0)
    const wallTop1 = H1 + (q1.roof ? 2 : 0)

    // Innenwand mit Bandenwerbung
    const nIn: V3 = [-nn[0], -nn[1], 0]
    if (visible(nIn)) {
      faces.push({ depth: d - 40, shape: { d: poly([[...p0.i, 0], [...q1.i, 0], [...q1.i, hIn], [...p0.i, hIn]]), fill: lit(pal.innerWall, nIn, 0.4) } })
    }

    // Sitzflächen, je Rang
    const rise = (H0 + H1) / 2 - hIn
    const nSeat: V3 = [-nn[0] * rise, -nn[1] * rise, depthD]
    if (visible(nSeat)) {
      for (const [f0, f1, kind] of tierStops) {
        const c = kind === 'band' ? pal.band : kind === 'upper' ? pal.seatUpper : pal.seat
        const z = (h: number, f: number) => hIn + (h - hIn) * f
        faces.push({
          depth: d - 20 + f0,
          shape: {
            d: poly([
              [...lerp2(p0.i, p0.o, f0), z(H0, f0)], [...lerp2(q1.i, q1.o, f0), z(H1, f0)],
              [...lerp2(q1.i, q1.o, f1), z(H1, f1)], [...lerp2(p0.i, p0.o, f1), z(H0, f1)],
            ]),
            fill: lit(c, nSeat, 0.8),
          },
        })
      }
    }

    // Außenwand
    const nOut: V3 = [nn[0], nn[1], 0]
    if (visible(nOut)) {
      const wall: V3[] = [[...p0.o, 0], [...q1.o, 0], [...q1.o, wallTop1], [...p0.o, wallTop0]]
      faces.push({ depth: d, shape: { d: poly(wall), fill: lit(pal.facade, nOut), pattern: spec.facade === 'shell' ? 'lattice-light' : spec.facade === 'lattice' ? 'lattice' : undefined } })
      // Akzentband in Vereinsfarbe knapp unter der Oberkante
      if (spec.facade !== 'club' && spec.facade !== 'shell' && !pal.mono) {
        faces.push({
          depth: d + 0.1,
          shape: { d: poly([[...p0.o, wallTop0 - 2.4], [...q1.o, wallTop1 - 2.4], [...q1.o, wallTop1 - 1.4], [...p0.o, wallTop0 - 1.4]]), fill: lit(pal.accent, nOut, 0.6) },
        })
      }
      if (spec.features?.includes('ribs')) {
        for (const t of [0.25, 0.75]) {
          const o = lerp2(p0.o, q1.o, t)
          const out: V2 = [o[0] + nn[0] * 1.6, o[1] + nn[1] * 1.6]
          faces.push({ depth: d + 0.2, shape: { d: poly([[...o, 0], [...out, 0], [...out, wallTop0 + 0.6], [...o, wallTop0 + 0.6]]), fill: lit(shade(pal.facade, 1.12), nOut) } })
        }
      }
      if (spec.features?.includes('arcades') && nn[1] > 0.7) {
        const archH = Math.min(H0, H1) * 0.55
        const shapeArch: V3[] = []
        for (let k = 0; k <= 8; k++) {
          const ang = Math.PI - (k / 8) * Math.PI
          const t = 0.5 + Math.cos(ang) * 0.32
          const o = lerp2(p0.o, q1.o, t)
          shapeArch.push([...o, archH * 0.62 + Math.sin(ang) * archH * 0.38])
        }
        const l0 = lerp2(p0.o, q1.o, 0.18)
        const l1 = lerp2(p0.o, q1.o, 0.82)
        faces.push({ depth: d + 0.2, shape: { d: poly([[...l0, 0], ...shapeArch, [...l1, 0]]), fill: lit('#5b6573', nOut, 0.3) } })
      }
    }

    // Stirnseiten bei offenen Ecken
    if (open) {
      const ends: [V2, V2, number, V2][] = []
      const prev = pts[idx - 1] ?? pts[pts.length - 1]
      if (prev.s.corner || prev.f <= 0) ends.push([p0.i, p0.o, H0, tangent(p0.s.piece, -1)])
      if ((samples[idx + 1] ?? samples[0]).corner || p1.f <= 0) ends.push([q1.i, q1.o, H1, tangent(p0.s.piece, 1)])
      for (const [ip, op, h, tn] of ends) {
        const nEnd: V3 = [tn[0], tn[1], 0]
        if (!visible(nEnd)) continue
        faces.push({
          depth: d + 0.3,
          shape: { d: poly([[...ip, 0], [...op, 0], [...op, h + (p0.roof ? 2 : 0)], [...ip, hIn]]), fill: lit(shade(pal.facade, 0.92), nEnd) },
        })
      }
    }

    // Dach
    if (p0.roof) {
      const cover = spec.roof === 'closed' ? 0.8 : 0.7
      const zr0 = wallTop0
      const zr1 = wallTop1
      const ro0: V2 = [p0.o[0] + nn[0] * 1.2, p0.o[1] + nn[1] * 1.2]
      const ro1: V2 = [q1.o[0] + nn[0] * 1.2, q1.o[1] + nn[1] * 1.2]
      const ri0 = lerp2(p0.o, p0.i, cover)
      const ri1 = lerp2(q1.o, q1.i, cover)
      const nTop: V3 = [nn[0] * 0.08, nn[1] * 0.08, 1]
      roofFaces.push({ depth: d, shape: { d: poly([[...ro0, zr0], [...ro1, zr1], [...ri1, zr1 + 0.6], [...ri0, zr0 + 0.6]]), fill: lit(pal.roof, nTop, 0.5), opacity: 0.97 } })
      if (visible(nIn)) {
        roofFaces.push({
          depth: d + 0.1,
          shape: { d: poly([[...ri0, zr0 + 0.6], [...ri1, zr1 + 0.6], [...ri1, zr1 - 0.9], [...ri0, zr0 - 0.9]]), fill: lit(pal.fascia, nIn, 0.4) },
        })
        // Flutlicht an der Dachkante
        if (!pal.mono && idx % 2 === 0) {
          const m = lerp2(ri0, ri1, 0.5)
          const [x, y] = P([...m, zr0 - 0.2])
          roofFaces.push({ depth: d + 0.2, shape: { d: `M${(x - 0.7).toFixed(1)} ${y.toFixed(1)}h1.4`, fill: 'none', stroke: pal.light, strokeWidth: 0.7, glow: true } })
        }
      }
      // Vorderkante des Dachs (zur Kamera)
      if (visible(nOut)) {
        roofFaces.push({ depth: d + 0.05, shape: { d: poly([[...ro0, zr0], [...ro1, zr1], [...ro1, zr1 - 0.7], [...ro0, zr0 - 0.7]]), fill: lit(shade(pal.roof, 0.88), nOut, 0.5) } })
      }
    }
  })

  // Geschlossenes Dach: Glasfläche über dem Spielfeld
  if (spec.roof === 'closed') {
    const cover = 0.8
    const hole: V3[] = pts.map((p) => [...lerp2(p.o, p.i, cover), p.h + 2.6] as V3)
    roofFaces.push({ depth: 9999, shape: { d: poly(hole), fill: pal.mono ? '#eef1f5' : '#d8e6f3', opacity: 0.42, stroke: '#ffffff', strokeWidth: 0.4 } })
    const zMid = baseH + 2.6
    for (const x of [-0.5, 0, 0.5]) {
      roofFaces.push({ depth: 10000, shape: { d: line([[x * a, -b, zMid], [x * a, b, zMid]].map((v) => P(v as V3))), fill: 'none', stroke: '#ffffff', strokeWidth: 0.35, opacity: 0.7 } })
    }
  }

  // ---------- Besonderheiten ----------

  const pushFeature = (pos: V2, shapes: Shape[]) => {
    const list = depth(pos) < 0 ? backFeatures : frontFeatures
    for (const s of shapes) list.push({ depth: depth(pos), shape: s })
  }
  /** Senkrechter Quader (Pylon, Turm) */
  const pillar = (pos: V2, w: number, h: number, color: string, z0 = 0): Shape[] => {
    const out: Shape[] = []
    const hw = w / 2
    const corners: V2[] = [[pos[0] - hw, pos[1] - hw], [pos[0] + hw, pos[1] - hw], [pos[0] + hw, pos[1] + hw], [pos[0] - hw, pos[1] + hw]]
    const normals: V3[] = [[0, -1, 0], [1, 0, 0], [0, 1, 0], [-1, 0, 0]]
    for (let k = 0; k < 4; k++) {
      if (!visible(normals[k])) continue
      const c0 = corners[k]
      const c1 = corners[(k + 1) % 4]
      out.push({ d: poly([[...c0, z0], [...c1, z0], [...c1, h], [...c0, h]]), fill: lit(color, normals[k]) })
    }
    out.push({ d: poly(corners.map((c) => [...c, h] as V3)), fill: lit(color, [0, 0, 1]) })
    return out
  }
  const topRoof = baseH * Math.max(...sides) + 2
  /** Punkt außen an einer Ecke (0 vorn rechts, 1 vorn links, 2 hinten links, 3 hinten rechts) */
  const cornerAt = (k: number, off: number): V2 =>
    at({ a: outer.a + off, b: outer.b + off, r: outer.r + off }, { piece: 2 * k + 1, t: 0.5 }).p

  for (const f of spec.features ?? []) {
    if (f === 'pylons') {
      for (const sy of [-1, 1]) {
        for (const fx of [-0.62, -0.2, 0.2, 0.62]) {
          const pos: V2 = [fx * outer.a, sy * (outer.b + 2.5)]
          const h = topRoof + 9
          pushFeature(pos, pillar(pos, 2.2, h, pal.feature))
          const roofPt: V3 = [fx * outer.a, sy * (outer.b - depthD * 0.55), topRoof]
          frontFeatures.push({ depth: 9000, shape: { d: line([P([pos[0], pos[1], h]), P(roofPt)]), fill: 'none', stroke: shade(pal.feature, 0.8), strokeWidth: 0.35 } })
        }
      }
    }
    if (f === 'cornerTowers' || f === 'masts' || f === 'towers') {
      for (let k = 0; k < 4; k++) {
        const pos = cornerAt(k, f === 'masts' ? 7 : f === 'towers' ? 3 : open ? -depthD * 0.4 : 2)
        if (f === 'towers') {
          pushFeature(pos, cylinder(pos, 5.5, topRoof + 5, pal.mono ? pal.feature : '#cfd3d8'))
        } else if (f === 'cornerTowers') {
          const h = topRoof + 12
          pushFeature(pos, [...pillar(pos, 1.8, h, pal.mono ? pal.feature : '#e3e7ec'),
            ...(pal.mono ? [] : [{ d: path([P([pos[0], pos[1], h + 1.6]), P([pos[0] + 0.1, pos[1], h])]), fill: 'none', stroke: pal.light, strokeWidth: 1.6, glow: true }])])
        } else {
          const h = topRoof * 2.1 + 6
          const top = P([pos[0], pos[1], h])
          pushFeature(pos, [
            { d: line([P([pos[0], pos[1], 0]), top]), fill: 'none', stroke: pal.mono ? '#cdd3db' : '#8d97a5', strokeWidth: 0.7 },
            { d: `M${(top[0] - 2.2).toFixed(1)} ${(top[1] - 1.6).toFixed(1)}h4.4v2.2h-4.4Z`, fill: pal.mono ? '#eef1f4' : pal.light, glow: !pal.mono },
          ])
        }
      }
      if (f === 'towers' && !pal.mono) {
        // Rotes Dachgerüst
        // Rotes Dachgerüst: Ring über dem Dach, Träger zu den Türmen
        const ringC: Contour = { a: outer.a - depthD * 0.25, b: outer.b - depthD * 0.25, r: outer.r - depthD * 0.25 }
        const ringPts = samples.map((sm) => P([...at(ringC, sm).p, topRoof + 1.4]))
        frontFeatures.push({ depth: 9000, shape: { d: path(ringPts), fill: 'none', stroke: '#d92a2a', strokeWidth: 1.5 } })
        for (let k = 0; k < 4; k++) {
          const t = cornerAt(k, 3)
          const ri = at(ringC, { piece: 2 * k + 1, t: 0.5 }).p
          frontFeatures.push({ depth: 9001, shape: { d: line([P([...t, topRoof + 5]), P([...ri, topRoof + 1.4])]), fill: 'none', stroke: '#d92a2a', strokeWidth: 1.5 } })
        }
      }
    }
    if (f === 'marathon') {
      const pos: V2 = [-(outer.a + 4), -outer.b * 0.2]
      const h = topRoof + 28
      pushFeature(pos, pillar(pos, 3.2, h, spec.facade === 'brick' && !pal.mono ? '#b0614a' : pal.mono ? pal.feature : '#dde1e6'))
    }
    if (f === 'arch') {
      const archPts: V2[] = []
      for (let k = 0; k <= 24; k++) {
        const t = k / 24
        const x = (t - 0.5) * 2 * outer.a * 0.95
        archPts.push(P([x, -outer.b + depthD * 0.35, Math.sin(t * Math.PI) * (topRoof + 14)]))
      }
      frontFeatures.push({ depth: 9000, shape: { d: line(archPts), fill: 'none', stroke: pal.mono ? '#e9ecf0' : '#f2f4f7', strokeWidth: 1.6 } })
      frontFeatures.push({ depth: 9001, shape: { d: line(archPts), fill: 'none', stroke: pal.mono ? '#cfd5dd' : '#9aa5b3', strokeWidth: 0.3 } })
    }
  }

  function cylinder(pos: V2, rad: number, h: number, color: string): Shape[] {
    // Seitenfläche als Band zwischen linker und rechter Silhouette, Deckel als Ellipse
    const ring = (z: number) => Array.from({ length: 20 }, (_, k) => {
      const t = (k / 20) * Math.PI * 2
      return [pos[0] + Math.cos(t) * rad, pos[1] + Math.sin(t) * rad, z] as V3
    })
    const bottom = ring(0).map(P)
    const top = ring(h).map(P)
    const xs = [...bottom, ...top]
    const minX = Math.min(...xs.map((p) => p[0]))
    const maxX = Math.max(...xs.map((p) => p[0]))
    const c = project([pos[0], pos[1], 0])
    const ct = project([pos[0], pos[1], h])
    const ry = rad * SIN_E
    const side = `M${minX.toFixed(1)} ${ct[1].toFixed(1)}L${minX.toFixed(1)} ${c[1].toFixed(1)}A${((maxX - minX) / 2).toFixed(1)} ${ry.toFixed(1)} 0 0 0 ${maxX.toFixed(1)} ${c[1].toFixed(1)}L${maxX.toFixed(1)} ${ct[1].toFixed(1)}Z`
    const shapes: Shape[] = [
      { d: side, fill: lit(color, [0.3, 1, 0]) },
      { d: path(top), fill: lit(color, [0, 0, 1]) },
    ]
    // Rampen als Schrägstreifen
    for (let k = 1; k < 4; k++) {
      const y0 = c[1] - ((ct[1] - c[1]) * -k) / 4
      shapes.push({ d: `M${minX.toFixed(1)} ${(y0 + 1.5).toFixed(1)}L${maxX.toFixed(1)} ${(y0 - 1.5).toFixed(1)}`, fill: 'none', stroke: shade(color, 0.78), strokeWidth: 0.5 })
    }
    return shapes
  }

  // ---------- Zusammensetzen ----------

  const byDepth = (x: Face, y: Face) => x.depth - y.depth
  const shapes: Shape[] = [
    ...ground,
    ...backFeatures.sort(byDepth).map((f) => f.shape),
    ...faces.sort(byDepth).map((f) => f.shape),
    ...roofFaces.sort(byDepth).map((f) => f.shape),
    ...frontFeatures.sort(byDepth).map((f) => f.shape),
  ]

  const xs = all.map((p) => p[0])
  const ys = all.map((p) => p[1])
  const pad = 6
  const minX = Math.min(...xs) - pad
  const minY = Math.min(...ys) - pad
  const w = Math.max(...xs) - minX + pad
  const h = Math.max(...ys) - minY + pad
  return { viewBox: `${minX.toFixed(1)} ${minY.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`, shapes }
}

/** Richtung entlang einer Kante (für Stirnseiten offener Tribünen) */
function tangent(piece: number, dir: -1 | 1): V2 {
  const t: V2 = piece === 0 ? [0, 1] : piece === 2 ? [-1, 0] : piece === 4 ? [0, -1] : [1, 0]
  return [t[0] * dir, t[1] * dir]
}

const cache = new Map<string, Scene>()

export function sceneFor(stadium: Stadium, mono = false): Scene {
  const key = stadium.id + (mono ? ':mono' : '')
  let s = cache.get(key)
  if (!s) {
    s = buildScene(stadium, mono)
    cache.set(key, s)
  }
  return s
}
