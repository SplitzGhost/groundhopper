// Baut aus dem Stadion-Steckbrief (data/stadiumInfo.ts) ein 3D-Modell.
//
// Grundriss: abgerundetes Rechteck um das Spielfeld (x = Längsachse, z = zur Kamera, y = oben).
// Die Tribüne ist ein Querschnitt-Profil (Bande, Sitzstufen, Logen, Umgang, Fassade), das entlang
// der Kontur extrudiert wird. Die Kontur ist in Blöcke geteilt: Sitzbereiche, Treppen und Mundlöcher.
// `mono` liefert ein weißes Architekturmodell für noch nicht gesammelte Stadien.

import * as THREE from 'three'
import type { Stadium } from '../../shared/types.ts'
import { clubInfo } from '../../data/clubs.ts'
import { stadiumSpec, type Facade, type StadiumSpec } from '../../data/stadiumInfo.ts'
import { MeshBuilder, type UV, type V3 } from './builder.ts'
import * as T from './textures.ts'

export type Mat =
  | 'solid' | 'seats' | 'facade' | 'glass' | 'entrance' | 'roof' | 'roofClear'
  | 'light' | 'led' | 'floor' | 'net' | 'plaza' | 'foliage'

// ---------- Farben ----------

type RGB = [number, number, number]
function rgb(hex: string): RGB {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const toHex = ([r, g, b]: RGB) =>
  '#' + [r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('')
/** f < 1 abdunkeln, f > 1 aufhellen */
function shade(color: string, f: number): string {
  const c = rgb(color)
  if (f <= 1) return toHex([c[0] * f, c[1] * f, c[2] * f])
  const t = Math.min(1, f - 1)
  return toHex([c[0] + (255 - c[0]) * t, c[1] + (255 - c[1]) * t, c[2] + (255 - c[2]) * t])
}
function mix(a: string, b: string, t: number): string {
  const x = rgb(a)
  const y = rgb(b)
  return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t])
}
const luminance = (c: string) => {
  const [r, g, b] = rgb(c)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

interface Palette {
  seats: string[]
  aisle: string
  vom: string
  wall: string
  walk: string
  boxes: string
  ribbon: string
  back: string
  cap: string
  facade: string
  band: string
  plinth: string
  roof: string
  roofUnder: string
  roofClear: string
  fascia: string
  truss: string
  plaza: string
  plinthSide: string
  trees: string[]
  trunk: string
  feature: string
  light: string
  screen: string
  steel: string
  mono: boolean
}

const FACADES: Record<Facade, string> = {
  concrete: '#d9dde3',
  glass: '#9fb6cc',
  brick: '#b4634b',
  metal: '#c6ccd4',
  club: '#000',
  shell: '#000',
  lattice: '#eef1f4',
}

function palette(stadium: Stadium, spec: StadiumSpec, mono: boolean): Palette {
  if (mono) {
    const w = '#eef0f3'
    return {
      seats: [w, '#f3f5f7', w], aisle: '#dfe3e8', vom: '#c4cad2', wall: '#d8dce2', walk: '#e3e6ea',
      boxes: '#d3d8de', ribbon: '#e6e9ed', back: '#e6e9ec', cap: '#e2e5e9', facade: '#eceff2', band: '#dfe3e8',
      plinth: '#e8ebee', roof: '#fbfbfc', roofUnder: '#dadee4', roofClear: '#eef2f6', fascia: '#d8dce2',
      truss: '#f1f3f5', plaza: '#eef0f2', plinthSide: '#d7dbe0', trees: ['#f5f6f8', '#eff1f4', '#f8f9fa'],
      trunk: '#dde0e5', feature: '#eceff2', light: '#ffffff', screen: '#e3e7ec', steel: '#d9dde2', mono: true,
    }
  }
  const club = clubInfo(stadium.teams[0].name)
  // Sehr helle Erkennungsfarben gehen auf Weiß unter – dann die Zweitfarbe für Akzente
  const accent = luminance(club.primary) > 0.85 ? club.secondary : club.primary
  const facade = spec.facade === 'club' || spec.facade === 'shell'
    ? mix(club.primary, '#ffffff', spec.facade === 'shell' ? 0.86 : 0.12)
    : FACADES[spec.facade]
  // Schwarze Sitze wirken wie Löcher – zu Anthrazit aufhellen
  const seat = luminance(club.primary) < 0.16 ? '#3d434c' : club.primary
  const upper = shade(seat, 1.1)
  return {
    seats: spec.tiers === 3 ? [seat, upper, seat] : [seat, upper],
    aisle: '#c8cdd4',
    vom: '#1b2028',
    wall: '#28303a',
    walk: '#b9bfc7',
    boxes: '#33475e',
    ribbon: accent,
    back: '#d2d6dc',
    cap: '#c3c8cf',
    facade,
    band: spec.facade === 'club' ? '#ffffff' : accent,
    plinth: '#e7e9ec',
    roof: '#f6f7f9',
    roofUnder: '#8f98a4',
    roofClear: '#dbe7f2',
    fascia: mix(accent, '#1c232c', 0.45),
    truss: '#e9ecf0',
    plaza: '#e6e8eb',
    plinthSide: '#c6cbd2',
    trees: ['#5c9a4b', '#6aa957', '#4f8b43', '#77b062'],
    trunk: '#7b5e47',
    feature: spec.features?.includes('pylons') ? club.primary : '#e9ecf0',
    light: '#fff7da',
    screen: '#8fb8ff',
    steel: '#8d96a3',
    mono: false,
  }
}

// ---------- Grundriss ----------

interface Contour { a: number; b: number; r: number }
const offset = (c: Contour, d: number): Contour => ({ a: c.a + d, b: c.b + d, r: c.r + d })

interface Point { x: number; z: number; nx: number; nz: number }

/** Punkt und Außennormale auf der Kontur. Stücke: 0 rechts (+x), 1 Ecke vorn rechts, 2 vorn (+z), … 6 hinten (−z) */
function at(c: Contour, piece: number, t: number): Point {
  const ax = c.a - c.r
  const bz = c.b - c.r
  const lerp = (u: number, v: number) => u + (v - u) * t
  switch (piece) {
    case 0: return { x: c.a, z: lerp(-bz, bz), nx: 1, nz: 0 }
    case 2: return { x: lerp(ax, -ax), z: c.b, nx: 0, nz: 1 }
    case 4: return { x: -c.a, z: lerp(bz, -bz), nx: -1, nz: 0 }
    case 6: return { x: lerp(-ax, ax), z: -c.b, nx: 0, nz: -1 }
    default: {
      const k = (piece - 1) / 2
      const ang = (k + t) * (Math.PI / 2)
      const nx = Math.cos(ang)
      const nz = Math.sin(ang)
      const cx = k === 0 || k === 3 ? ax : -ax
      const cz = k <= 1 ? bz : -bz
      return { x: cx + c.r * nx, z: cz + c.r * nz, nx, nz }
    }
  }
}

/** Gleichmäßig verteilte Punkte entlang einer Kontur (Bäume, Rippen) */
function along(c: Contour, spacing: number): Point[] {
  const out: Point[] = []
  for (let p = 0; p < 8; p++) {
    const len = p % 2 ? (Math.PI / 2) * c.r : 2 * ((p % 4 === 0 ? c.b : c.a) - c.r)
    const n = Math.max(len > 0.5 ? 1 : 0, Math.round(len / spacing))
    for (let i = 0; i < n; i++) out.push(at(c, p, (i + 0.5) / n))
  }
  return out
}

type SegKind = 'seat' | 'aisle' | 'vom'
interface Sample { piece: number; t: number; seg: SegKind | null }

/** Stützstellen entlang der Innenkontur, in Blöcke (Sitze, Mundloch, Treppe) geteilt.
 *  Bei offenen Ecken (englischer Stil) entsteht pro Tribüne ein eigener Lauf. */
function runsFor(inner: Contour, depth: number, open: boolean): Sample[][] {
  const runs: Sample[][] = []
  let cur: Sample[] = []
  for (let p = 0; p < 8; p++) {
    const corner = p % 2 === 1
    if (corner && open) {
      if (cur.length) {
        cur.push({ piece: p - 1, t: 1, seg: null })
        runs.push(cur)
        cur = []
      }
      continue
    }
    const len = corner ? (Math.PI / 2) * (inner.r + depth * 0.5) : 2 * ((p % 4 === 0 ? inner.b : inner.a) - inner.r)
    if (len < 0.5) continue
    const blocks = Math.max(1, Math.round(len / 13))
    const bl = len / blocks
    const aisle = Math.min(0.3, 1.3 / bl)
    const vom = Math.min(0.24, 2.4 / bl)
    const cuts: [number, SegKind][] = [[0, 'seat'], [0.5 - vom / 2, 'vom'], [0.5 + vom / 2, 'seat'], [1 - aisle, 'aisle']]
    for (let bi = 0; bi < blocks; bi++) {
      cuts.forEach(([s, kind], ci) => {
        const next = cuts[ci + 1]?.[0] ?? 1
        const sub = corner && kind === 'seat' ? Math.max(1, Math.round(((next - s) * bl) / 3.5)) : 1
        for (let k = 0; k < sub; k++) cur.push({ piece: p, t: (bi + s + ((next - s) * k) / sub) / blocks, seg: kind })
      })
    }
  }
  if (cur.length) runs.push(cur)
  return runs
}

// ---------- Tribünenprofil ----------

type EdgeKind = 'wall' | 'tread' | 'riser' | 'walk' | 'boxes' | 'ribbon' | 'back' | 'cap' | 'band' | 'facade' | 'plinth' | 'shell'
interface Edge { kind: EdgeKind; tier: number; row: number }

interface Profile {
  /** Querschnitt (Abstand von der Innenkontur, Höhe) */
  pts: [number, number][]
  edges: Edge[]
  rows: number[]
  seatEnd: number
  top: number
  out: number
}

const ROW = 0.85
const RISE = [0.36, 0.5, 0.6]
const WALL = 1.25

function tierRows(spec: StadiumSpec, depth: number): number[] {
  const frac = spec.tiers === 1 ? [1] : spec.tiers === 2 ? [0.54, 0.46] : [0.38, 0.3, 0.32]
  return frac.map((f) => Math.max(5, Math.round((depth * f) / ROW)))
}

/** Querschnitt für einen Höhenfaktor f (Tribünen unterschiedlich hoch, Topologie bleibt gleich) */
function profile(rows: number[], f: number, shell: boolean): Profile {
  const pts: [number, number][] = [[0, 0]]
  const edges: Edge[] = []
  let d = 0
  let h = 0
  const go = (nd: number, nh: number, kind: EdgeKind, tier = 0, row = 0) => {
    d = nd
    h = nh
    pts.push([d, h])
    edges.push({ kind, tier, row })
  }
  go(0, WALL, 'wall')
  rows.forEach((n, tier) => {
    if (tier > 0) {
      // Umgang, Logen mit Glasfront, LED-Band
      go(d + 1.6 * f, h, 'walk', tier)
      go(d, h + 2.9 * f, 'boxes', tier)
      go(d, h + 1.0 * f, 'ribbon', tier)
    }
    for (let r = 0; r < n; r++) {
      go(d + ROW * f, h, 'tread', tier, r)
      go(d, h + RISE[tier] * f, 'riser', tier, r)
    }
  })
  const seatEnd = d
  go(d, h + 1.6, 'back')
  const top = h
  go(d + 3.5, h, 'cap')
  const out = d
  if (shell) {
    // Luftkissenhülle: nach außen gewölbt
    for (let k = 1; k <= 6; k++) {
      const t = k / 6
      go(out + 4.2 * Math.sin(Math.PI * (0.1 + t * 0.8)) - 0.6 * t, top * (1 - t), 'shell')
    }
  } else {
    go(d, top - 2.2, 'band')
    go(d, 3.2, 'facade')
    go(d, 0, 'plinth')
  }
  return { pts, edges, rows, seatEnd, top, out }
}

// ---------- Materialien ----------

const matCache = new Map<string, THREE.Material>()
function cached<M extends THREE.Material>(key: string, make: () => M): M {
  let m = matCache.get(key) as M | undefined
  if (!m) {
    m = make()
    matCache.set(key, m)
  }
  return m
}

function materials(facade: Facade, ledColor: string, floor: THREE.Texture, floorKey: string): Record<Mat, THREE.Material> {
  const side = THREE.DoubleSide
  const std = (key: string, p: THREE.MeshStandardMaterialParameters) =>
    cached(key, () => new THREE.MeshStandardMaterial({ vertexColors: true, side, roughness: 0.85, ...p }))
  return {
    solid: std('solid', {}),
    seats: std('seats', { map: T.seatTexture(), roughness: 0.72 }),
    facade: std(`facade-${facade}`, {
      map: T.facadeTexture(facade),
      roughness: facade === 'metal' ? 0.42 : facade === 'shell' ? 0.35 : 0.85,
      metalness: facade === 'metal' ? 0.35 : 0,
    }),
    glass: std('glass', { map: T.facadeTexture('glass'), roughness: 0.12, metalness: 0.55, envMapIntensity: 1.5 }),
    entrance: std('entrance', { map: T.entranceTexture() }),
    roof: std('roof', { map: T.roofTexture(), roughness: 0.5 }),
    roofClear: cached('roofClear', () => new THREE.MeshStandardMaterial({
      vertexColors: true, side, transparent: true, opacity: 0.42, roughness: 0.15, metalness: 0.1, depthWrite: false,
    })),
    light: cached('light', () => new THREE.MeshBasicMaterial({ vertexColors: true })),
    led: cached(`led-${ledColor}`, () => new THREE.MeshBasicMaterial({ vertexColors: true, map: T.ledTexture(ledColor), side })),
    floor: cached(floorKey, () => new THREE.MeshStandardMaterial({ map: floor, roughness: 0.92 })),
    net: cached('net', () => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.4, depthWrite: false, side })),
    plaza: std('plaza', { map: T.plazaTexture(), roughness: 0.95 }),
    foliage: std('foliage', { flatShading: true, roughness: 0.9 }),
  }
}

const SHADOWS: Record<Mat, { cast: boolean; receive: boolean }> = {
  solid: { cast: true, receive: true },
  seats: { cast: true, receive: true },
  facade: { cast: true, receive: true },
  glass: { cast: true, receive: true },
  entrance: { cast: true, receive: true },
  roof: { cast: true, receive: true },
  roofClear: { cast: false, receive: false },
  light: { cast: false, receive: false },
  led: { cast: false, receive: false },
  floor: { cast: false, receive: true },
  net: { cast: false, receive: false },
  plaza: { cast: false, receive: true },
  foliage: { cast: true, receive: true },
}

// ---------- Modell ----------

export interface StadiumModel {
  group: THREE.Group
  /** Stichprobe aller Eckpunkte – für Bildausschnitt und Schatten */
  points: Float32Array
  center: THREE.Vector3
  radius: number
}

export function buildStadium(stadium: Stadium, mono = false): StadiumModel {
  const spec = stadiumSpec(stadium.id)
  const pal = palette(stadium, spec, mono)
  const mb = new MeshBuilder<Mat>()
  const rand = T.rng(stadium.id)

  // Größe: Kapazität bestimmt Tiefe der Ränge
  const cap = Math.min(spec.capacity, 95000) / 95000
  const depth = (12 + 9 * spec.tiers) * (0.8 + cap * 0.48)
  const rows = tierRows(spec, depth)
  const sides = spec.sides ?? [1, 1, 1, 1]
  const shell = spec.facade === 'shell'
  const open = spec.shape === 'box'

  const track = spec.shape === 'track'
  const a = T.PITCH_HL + (track ? 36 : 7)
  const b = T.PITCH_HW + (track ? 13 : 7)
  const r = spec.shape === 'bowl' ? b * 0.92 : track ? b : spec.shape === 'arena' ? 10 : 0
  const inner: Contour = { a, b, r }

  /** Höhenfaktor an einer Stelle: Seiten weich überblendet, bei offenen Ecken je Tribüne fest */
  const sideAt = (p: Point, piece: number) => {
    if (open) return [sides[1], sides[2], sides[3], sides[0]][piece / 2]
    const w = [Math.max(0, -p.nz), Math.max(0, p.nx), Math.max(0, p.nz), Math.max(0, -p.nx)]
    const sum = w[0] + w[1] + w[2] + w[3] || 1
    return (w[0] * sides[0] + w[1] * sides[1] + w[2] * sides[2] + w[3] * sides[3]) / sum
  }
  const roofed = (p: Point) => {
    switch (spec.roof) {
      case 'none': return false
      case 'main': return p.nz < -0.55
      case 'sides': return Math.abs(p.nz) > 0.55
      default: return true
    }
  }

  const fMax = Math.max(...sides)
  const maxProfile = profile(rows, fMax, shell)
  const outer = offset(inner, maxProfile.out)
  let roofTop = 0
  let standTop = 0

  const pos = (p: Point, d: number, h: number): V3 => [p.x + p.nx * d, h, p.z + p.nz * d]
  const facadeMat: Mat = spec.facade === 'glass' ? 'glass' : 'facade'
  const [tileW, tileH] = T.FACADE_TILE[spec.facade]
  const dist = (u: V3, v: V3) => Math.hypot(u[0] - v[0], u[1] - v[1], u[2] - v[2])

  // ---------- Tribünen ----------

  const runs = runsFor(inner, depth, open)
  const roofFronts: V3[] = []
  let allRoofed = !open

  for (const run of runs) {
    const closed = !open
    const info = run.map((s) => {
      const p = at(inner, s.piece, s.t)
      const f = sideAt(p, s.piece)
      const prof = profile(rows, f, shell)
      return { s, p, f, prof, P: prof.pts.map(([d, h]) => pos(p, d, h)), roof: roofed(p) && f > 0.05 }
    })
    const U: number[] = info[0].P.map(() => 0)
    const segCount = closed ? info.length : info.length - 1

    for (let i = 0; i < segCount; i++) {
      const A = info[i]
      const B = info[(i + 1) % info.length]
      const seg = A.s.seg ?? 'seat'
      if (A.f < 0.05 && B.f < 0.05) continue
      standTop = Math.max(standTop, A.prof.top)

      const vomFrom = Math.floor(rows[0] * 0.3)
      const vomTo = Math.floor(rows[0] * 0.62)
      A.prof.edges.forEach((e, k) => {
        const a0 = A.P[k], a1 = A.P[k + 1], b0 = B.P[k], b1 = B.P[k + 1]
        const u0 = U[k]
        const u1 = u0 + dist(a0, b0)
        const u0t = U[k + 1]
        const u1t = u0t + dist(a1, b1)
        const isVom = seg === 'vom' && e.tier === 0 && e.row >= vomFrom && e.row < vomTo
        switch (e.kind) {
          case 'tread':
          case 'riser': {
            if (seg === 'aisle' || isVom) {
              const c = isVom ? pal.vom : e.kind === 'riser' ? shade(pal.aisle, 0.84) : pal.aisle
              mb.quad('solid', a0, b0, b1, a1, c)
            } else {
              const c = e.kind === 'riser' ? shade(pal.seats[e.tier], 0.72) : pal.seats[e.tier]
              const s = 0.5
              mb.quad('seats', a0, b0, b1, a1, c, [[u0 / s, 0], [u1 / s, 0], [u1t / s, 1], [u0t / s, 1]])
            }
            break
          }
          case 'ribbon':
            if (pal.mono) mb.quad('solid', a0, b0, b1, a1, pal.ribbon)
            else mb.quad('led', a0, b0, b1, a1, '#ffffff', [[u0 / 16, 0], [u1 / 16, 0], [u1 / 16, 1], [u0 / 16, 1]])
            break
          case 'boxes':
            mb.quad(pal.mono ? 'solid' : 'glass', a0, b0, b1, a1, pal.boxes,
              [[u0 / 1.8, a0[1] / 3.6], [u1 / 1.8, b0[1] / 3.6], [u1 / 1.8, b1[1] / 3.6], [u0 / 1.8, a1[1] / 3.6]])
            break
          case 'facade':
          case 'shell':
            mb.quad(facadeMat, a0, b0, b1, a1, pal.facade,
              [[u0 / tileW, a0[1] / tileH], [u1 / tileW, b0[1] / tileH], [u1t / tileW, b1[1] / tileH], [u0t / tileW, a1[1] / tileH]])
            break
          case 'plinth':
            mb.quad('entrance', a0, b0, b1, a1, pal.plinth, [[u0 / 12, a0[1] / 3.2], [u1 / 12, b0[1] / 3.2], [u1 / 12, b1[1] / 3.2], [u0 / 12, a1[1] / 3.2]])
            break
          default: {
            const c = { wall: pal.wall, walk: pal.walk, back: pal.back, cap: pal.cap, band: pal.band }[e.kind]
            mb.quad('solid', a0, b0, b1, a1, c)
          }
        }
      })
      for (let k = 0; k < U.length; k++) U[k] += dist(A.P[k], B.P[k])

      // ---------- Dach ----------
      if (A.roof && B.roof) {
        const roofPart = (X: typeof A) => {
          const { prof, p } = X
          const cover = spec.roof === 'closed' ? 0.92 : 0.8
          const dBack = prof.out + 0.9
          const dFront = prof.seatEnd * (1 - cover)
          const hBack = prof.top + 0.7
          const hFront = hBack + (dBack - dFront) * 0.09
          const lerpD = (t: number) => dBack + (dFront - dBack) * t
          const lerpH = (t: number) => hBack + (hFront - hBack) * t
          const mid = 0.6
          const fas = 1 - 1.2 / Math.max(4, dBack - dFront)
          return {
            back: pos(p, dBack, hBack), backLow: pos(p, dBack, hBack - 1.3),
            mid: pos(p, lerpD(mid), lerpH(mid)), midLow: pos(p, lerpD(mid), lerpH(mid) - 1.3),
            fas: pos(p, lerpD(fas), lerpH(fas)), front: pos(p, dFront, hFront),
            frontLow: pos(p, dFront, hFront - 1.5), fasLow: pos(p, lerpD(fas), lerpH(fas) - 1.5),
            light: pos(p, dFront + 0.4, hFront - 1.9), hFront, dFront, p,
          }
        }
        const ra = roofPart(A)
        const rb = roofPart(B)
        roofTop = Math.max(roofTop, ra.hFront)
        const roofMat: Mat = shell ? 'facade' : 'roof'
        const roofCol = shell ? pal.facade : pal.roof
        const rUv = (u: number, d: number): UV => shell ? [u / tileW, d / tileH] : [u / 6, d / 4]
        const uA = U[0] - dist(A.P[0], B.P[0])
        const uB = U[0]
        mb.quad(roofMat, ra.back, rb.back, rb.mid, ra.mid, roofCol,
          [rUv(uA, 0), rUv(uB, 0), rUv(uB, 12), rUv(uA, 12)])
        mb.quad('solid', ra.backLow, rb.backLow, rb.midLow, ra.midLow, pal.roofUnder)
        mb.quad('solid', ra.back, rb.back, rb.backLow, ra.backLow, shell ? pal.facade : pal.band)
        mb.quad('solid', ra.mid, rb.mid, rb.midLow, ra.midLow, pal.roofUnder)
        mb.quad('roofClear', ra.mid, rb.mid, rb.fas, ra.fas, pal.roofClear)
        mb.quad('solid', ra.fas, rb.fas, rb.front, ra.front, pal.fascia)
        mb.quad('solid', ra.front, rb.front, rb.frontLow, ra.frontLow, pal.fascia)
        mb.quad('solid', ra.fasLow, rb.fasLow, rb.frontLow, ra.frontLow, pal.roofUnder)
        // Dachträger über den Treppen
        if (seg === 'aisle' && !shell) {
          const up = (v: V3, dy: number): V3 => [v[0], v[1] + dy, v[2]]
          mb.beam('solid', up(ra.back, 0.45), up(ra.mid, 0.45), 0.55, 0.9, pal.truss)
          mb.beam('solid', up(ra.mid, 0.45), up(ra.fas, 0.45), 0.4, 0.7, pal.steel)
        }
        // Flutlicht unter der Dachkante
        if (seg === 'seat' && i % 2 === 0) {
          const m: V3 = [(ra.light[0] + rb.light[0]) / 2, (ra.light[1] + rb.light[1]) / 2, (ra.light[2] + rb.light[2]) / 2]
          mb.box('light', m[0], m[1], m[2], 1.6, 0.5, 1.6, pal.light)
        }
        roofFronts.push(ra.front)
      } else if (A.f > 0.05) {
        allRoofed = false
      }
    }

    // Stirnseiten offener Tribünen
    if (open) {
      for (const X of [info[0], info[info.length - 1]]) {
        if (X.f < 0.05) continue
        const shape2 = X.prof.pts.map(([d, h]) => new THREE.Vector2(d, h))
        const tris = THREE.ShapeUtils.triangulateShape(shape2, [])
        for (const [i0, i1, i2] of tris) mb.poly('solid', [X.P[i0], X.P[i1], X.P[i2]], pal.cap)
        if (X.roof) {
          const cover = 0.8
          const dBack = X.prof.out + 0.9
          const dFront = X.prof.seatEnd * (1 - cover)
          const hBack = X.prof.top + 0.7
          const hFront = hBack + (dBack - dFront) * 0.09
          mb.quad('solid', pos(X.p, dBack, hBack), pos(X.p, dFront, hFront), pos(X.p, dFront, hFront - 1.5), pos(X.p, dBack, hBack - 1.3), pal.roofUnder)
        }
      }
    }
  }

  // Geschlossenes Dach: Glaskuppel über dem Spielfeld
  if (spec.roof === 'closed' && allRoofed && roofFronts.length > 3) {
    const cy = roofFronts.reduce((s, v) => s + v[1], 0) / roofFronts.length + 4
    const c: V3 = [0, cy, 0]
    for (let i = 0; i < roofFronts.length; i++) {
      mb.poly('roofClear', [c, roofFronts[i], roofFronts[(i + 1) % roofFronts.length]], pal.roofClear)
    }
    for (const fx of [-0.5, 0, 0.5]) mb.beam('solid', [fx * a, cy - 0.3, -b], [fx * a, cy - 0.3, b], 0.6, 0.6, pal.truss)
    mb.beam('solid', [-a, cy - 0.3, 0], [a, cy - 0.3, 0], 0.6, 0.6, pal.truss)
  }

  // ---------- Innenraum ----------

  const floorSpec = { a, b, r, track, mono }
  const floorTex = T.floorTexture(floorSpec)
  const floorKey = `floor-${a}-${b}-${r}-${track}-${mono}`
  const floorPts: Point[] = []
  for (let p = 0; p < 8; p++) {
    const n = p % 2 ? 10 : 2
    for (let i = 0; i < n; i++) floorPts.push(at(inner, p, i / n))
  }
  const fuv = (x: number, z: number): UV => [(x + a) / (2 * a), 1 - (z + b) / (2 * b)]
  for (let i = 0; i < floorPts.length; i++) {
    const p0 = floorPts[i]
    const p1 = floorPts[(i + 1) % floorPts.length]
    mb.poly('floor', [[0, 0, 0], [p1.x, 0, p1.z], [p0.x, 0, p0.z]], '#ffffff', [fuv(0, 0), fuv(p1.x, p1.z), fuv(p0.x, p0.z)])
  }

  // Werbebanden rund ums Feld
  const bx = T.PITCH_HL + 4.2
  const bz = T.PITCH_HW + 3.4
  const ring: [number, number][] = [[-bx, -bz], [bx, -bz], [bx, bz], [-bx, bz]]
  let ub = 0
  for (let i = 0; i < 4; i++) {
    const [x0, z0] = ring[i]
    const [x1, z1] = ring[(i + 1) % 4]
    const len = Math.hypot(x1 - x0, z1 - z0)
    const quadPts: [V3, V3, V3, V3] = [[x0, 0, z0], [x1, 0, z1], [x1, 0.95, z1], [x0, 0.95, z0]]
    if (pal.mono) mb.quad('solid', ...quadPts, '#f4f5f7')
    else mb.quad('led', ...quadPts, '#ffffff', [[ub / 16, 0], [(ub + len) / 16, 0], [(ub + len) / 16, 1], [ub / 16, 1]])
    ub += len
  }

  // Tore mit Netz
  for (const s of [-1, 1]) {
    const x = s * T.PITCH_HL
    const white = pal.mono ? '#ffffff' : '#fdfdfd'
    mb.beam('solid', [x, 0, -3.66], [x, 2.44, -3.66], 0.16, 0.16, white)
    mb.beam('solid', [x, 0, 3.66], [x, 2.44, 3.66], 0.16, 0.16, white)
    mb.beam('solid', [x, 2.44, -3.66], [x, 2.44, 3.66], 0.16, 0.16, white)
    const xb = x + s * 2
    const net = '#ffffff'
    mb.quad('net', [x, 2.44, -3.66], [x, 2.44, 3.66], [xb, 1.6, 3.66], [xb, 1.6, -3.66], net)
    mb.quad('net', [xb, 1.6, -3.66], [xb, 1.6, 3.66], [xb, 0, 3.66], [xb, 0, -3.66], net)
    mb.quad('net', [x, 2.44, -3.66], [xb, 1.6, -3.66], [xb, 0, -3.66], [x, 0, -3.66], net)
    mb.quad('net', [x, 2.44, 3.66], [xb, 1.6, 3.66], [xb, 0, 3.66], [x, 0, 3.66], net)
  }

  // Trainerbänke vor der Haupttribüne
  for (const sx of [-1, 1]) {
    mb.box('solid', sx * 8, 0, -(T.PITCH_HW + 2.2), 7, 1.5, 1.6, pal.mono ? '#e4e7eb' : '#2c3542')
  }

  // ---------- Anzeigetafeln hinter den Toren ----------

  if (spec.capacity >= 25000) {
    for (const piece of [0, 4]) {
      const p = at(inner, piece, 0.5)
      const f = sideAt(p, piece)
      if (f < 0.05) continue
      const prof = profile(rows, f, shell)
      const rot = Math.atan2(p.nx, p.nz)
      const hasRoof = roofed(p)
      const dFront = prof.seatEnd * 0.2
      const d = hasRoof ? dFront + 1.2 : prof.seatEnd - 0.5
      const h = hasRoof ? prof.top + 0.7 + (prof.out + 0.9 - dFront) * 0.09 - 8.4 : prof.top + 0.3
      const c = pos(p, d, h)
      mb.box('solid', c[0], c[1], c[2], 13, 6.4, 0.9, pal.mono ? '#e2e6eb' : '#1a2029', rot)
      const face = (u: number, v: number): V3 => {
        const tx = -p.nz, tz = p.nx
        return [c[0] + tx * u - p.nx * 0.47, c[1] + v, c[2] + tz * u - p.nz * 0.47]
      }
      mb.quad(pal.mono ? 'solid' : 'light', face(-6, 0.5), face(6, 0.5), face(6, 5.9), face(-6, 5.9), pal.screen)
      if (!hasRoof) mb.beam('solid', pos(p, d, 0), pos(p, d, h), 0.8, 0.8, pal.steel)
    }
  }

  // ---------- Besonderheiten ----------

  const top = Math.max(roofTop, standTop)
  const cornerAt = (k: number, off: number) => at(offset(outer, off), 2 * k + 1, 0.5)

  for (const feat of spec.features ?? []) {
    if (feat === 'pylons') {
      for (const sz of [-1, 1]) {
        for (const fx of [-0.62, -0.2, 0.2, 0.62]) {
          const x = fx * outer.a
          const z = sz * (outer.b + 4)
          const h = top + 16
          mb.box('solid', x, 0, z, 2.6, h, 2.6, pal.feature)
          mb.beam('solid', [x, h - 0.6, z], [x, top + 0.8, sz * (outer.b - depth * 0.6)], 0.25, 0.25, pal.steel)
          mb.beam('solid', [x, h - 0.6, z], [x, 0, z + sz * 16], 0.25, 0.25, pal.steel)
        }
      }
    }
    if (feat === 'cornerTowers') {
      for (let k = 0; k < 4; k++) {
        const p = cornerAt(k, open ? -maxProfile.out * 0.45 : 2)
        const h = top + 14
        mb.box('solid', p.x, 0, p.z, 2, h, 2, pal.mono ? pal.feature : '#e3e7ec')
        mb.box(pal.mono ? 'solid' : 'light', p.x, h, p.z, 2.6, 2.4, 2.6, pal.light)
      }
    }
    if (feat === 'masts') {
      for (let k = 0; k < 4; k++) {
        const p = cornerAt(k, 9)
        const h = top * 1.9 + 8
        mb.beam('solid', [p.x, 0, p.z], [p.x, h, p.z], 1.3, 1.3, pal.mono ? pal.feature : '#9aa3ae')
        const rot = Math.atan2(-p.x, -p.z)
        mb.box('solid', p.x, h - 1, p.z, 8, 4.6, 1, pal.mono ? pal.feature : '#5f6874', rot)
        const fx = Math.sin(rot), fz = Math.cos(rot)
        mb.box(pal.mono ? 'solid' : 'light', p.x + fx * 0.55, h - 0.6, p.z + fz * 0.55, 7.2, 3.8, 0.2, pal.light, rot)
      }
    }
    if (feat === 'towers') {
      // Rampentürme (San Siro): große Türme tragen an den Enden das rote Trägergitter
      const ia = inner.a + maxProfile.out * 0.45
      const ib = inner.b + maxProfile.out * 0.45
      const ea = outer.a + 7
      const eb = outer.b + 7
      const gy = top + 4
      const towerPos: [number, number, number][] = []
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        towerPos.push([sx * ea, sz * ib, 6], [sx * ia, sz * eb, 6])
      }
      for (const sz of [-1, 1]) towerPos.push([0, sz * (outer.b + 4.5), 3.6])
      for (const [x, z, rad] of towerPos) {
        const h = rad > 5 ? gy - 1.5 : top - 3
        const cyl = new THREE.CylinderGeometry(rad, rad, h, 24)
        mb.geometry('solid', cyl, pal.mono ? pal.feature : '#d3d7dc', new THREE.Matrix4().makeTranslation(x, h / 2, z))
        cyl.dispose()
        // Spiralrampe
        const helix = new THREE.CatmullRomCurve3(Array.from({ length: 49 }, (_, i) => {
          const t = i / 48
          const ang = t * Math.PI * 2 * 3.5
          return new THREE.Vector3(x + Math.cos(ang) * (rad + 0.7), t * h, z + Math.sin(ang) * (rad + 0.7))
        }))
        const tube = new THREE.TubeGeometry(helix, 160, 0.55, 5, false)
        mb.geometry('solid', tube, pal.mono ? '#e6e9ed' : '#bfc5cc')
        tube.dispose()
      }
      const girder = pal.mono ? '#e9ecef' : '#d42a2a'
      for (const sz of [-1, 1]) mb.beam('solid', [-ea, gy, sz * ib], [ea, gy, sz * ib], 2.2, 3.2, girder)
      for (const sx of [-1, 1]) mb.beam('solid', [sx * ia, gy, -eb], [sx * ia, gy, eb], 2.2, 3.2, girder)
    }
    if (feat === 'marathon') {
      const x = -(outer.a + 7)
      const z = -outer.b * 0.25
      const h = top + 32
      const col = spec.facade === 'brick' && !pal.mono ? '#b0614a' : pal.mono ? pal.feature : '#dde1e6'
      mb.box('solid', x, 0, z, 4.4, h, 4.4, col)
      mb.box('solid', x, h, z, 5.4, 1.2, 5.4, shade(col, 0.9))
      mb.box('solid', x, h + 1.2, z, 1.2, 5, 1.2, shade(col, 0.95))
    }
    if (feat === 'arch') {
      const zArch = -(inner.b + maxProfile.out * 0.55)
      const curve = new THREE.CatmullRomCurve3(Array.from({ length: 25 }, (_, i) => {
        const t = i / 24
        return new THREE.Vector3((t - 0.5) * 2 * outer.a * 0.98, Math.sin(t * Math.PI) * (top + 24), zArch)
      }))
      const tube = new THREE.TubeGeometry(curve, 80, 1.4, 10, false)
      mb.geometry('solid', tube, pal.mono ? '#f4f5f7' : '#f2f4f7')
      tube.dispose()
      for (let k = 1; k < 12; k++) {
        const t = k / 12
        const pt = curve.getPoint(t)
        if (pt.y < top + 3) continue
        mb.beam('solid', [pt.x, pt.y, pt.z], [pt.x, top + 2, -(inner.b + maxProfile.seatEnd * 0.3)], 0.18, 0.18, pal.steel)
      }
    }
    if (feat === 'ribs') {
      for (const p of along(offset(inner, maxProfile.out), 7.5)) {
        const base: V3 = [p.x + p.nx * 4.5, 0, p.z + p.nz * 4.5]
        const midP: V3 = [p.x + p.nx * 3.2, top * 0.6, p.z + p.nz * 3.2]
        const end: V3 = [p.x - p.nx * 1.5, top + 3.5, p.z - p.nz * 1.5]
        const col = pal.mono ? '#e8ebee' : '#e5e7ea'
        mb.beam('solid', base, midP, 1.1, 1.1, col)
        mb.beam('solid', midP, end, 1.1, 1.1, col)
      }
    }
    if (feat === 'arcades') {
      const p = at(inner, 2, 0.5)
      const prof = profile(rows, sideAt(p, 2), shell)
      const zf = inner.b + prof.out + 0.08
      for (let x = -inner.a * 0.8; x <= inner.a * 0.8; x += 6.5) {
        const pts: V3[] = [[x - 2, 0, zf], [x + 2, 0, zf]]
        for (let k = 0; k <= 8; k++) {
          const ang = (k / 8) * Math.PI
          pts.push([x + Math.cos(ang) * 2, 4.4 + Math.sin(ang) * 2, zf])
        }
        mb.poly('solid', pts, pal.mono ? '#d3d8de' : '#3e4652')
      }
    }
  }

  // ---------- Vorplatz als Modellplatte mit Bäumen ----------

  const plate = offset(outer, 16)
  const platePts: Point[] = []
  for (let p = 0; p < 8; p++) {
    const n = p % 2 ? 12 : 2
    for (let i = 0; i < n; i++) platePts.push(at(plate, p, i / n))
  }
  const plateY = -0.04
  for (let i = 0; i < platePts.length; i++) {
    const p0 = platePts[i]
    const p1 = platePts[(i + 1) % platePts.length]
    mb.poly('plaza', [[0, plateY, 0], [p1.x, plateY, p1.z], [p0.x, plateY, p0.z]], pal.plaza,
      [[0, 0], [p1.x / 4, p1.z / 4], [p0.x / 4, p0.z / 4]])
    mb.quad('solid', [p0.x, plateY, p0.z], [p1.x, plateY, p1.z], [p1.x, -3, p1.z], [p0.x, -3, p0.z], pal.plinthSide)
  }

  const canopy = new THREE.IcosahedronGeometry(1, 1)
  const trunk = new THREE.CylinderGeometry(0.22, 0.32, 1, 6)
  for (const p of along(offset(outer, 8.5), 8)) {
    if (rand() < 0.3) continue
    const j = (rand() - 0.5) * 3
    const x = p.x + p.nx * j + p.nz * (rand() - 0.5) * 2
    const z = p.z + p.nz * j - p.nx * (rand() - 0.5) * 2
    const s = 2.3 + rand() * 1.4
    const th = 2.6 + rand() * 1.2
    mb.geometry('solid', trunk, pal.trunk, new THREE.Matrix4().makeScale(1, th, 1).setPosition(x, th / 2, z))
    mb.geometry('foliage', canopy, pal.trees[Math.floor(rand() * pal.trees.length)],
      new THREE.Matrix4().makeScale(s, s * 1.15, s).setPosition(x, th + s * 0.85, z), true)
  }
  canopy.dispose()
  trunk.dispose()

  // ---------- Zusammensetzen ----------

  const mats = materials(spec.facade, pal.ribbon, floorTex, floorKey)
  const group = mb.build(mats, (k) => SHADOWS[k])
  const points = mb.points()
  const box = new THREE.Box3().setFromArray(points)
  const center = box.getCenter(new THREE.Vector3())
  const radius = box.getBoundingSphere(new THREE.Sphere()).radius
  return { group, points, center, radius }
}

/** Geometrien freigeben (Materialien und Texturen werden geteilt und bleiben) */
export function disposeModel(model: StadiumModel) {
  model.group.traverse((o) => {
    if (o instanceof THREE.Mesh) o.geometry.dispose()
  })
}
