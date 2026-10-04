// Der Hopper als 3D-Figur: großer runder Kopf, Knopfaugen, kleiner Körper – im Stil weicher Spielfiguren.
// Haare und Bart entstehen aus einer Hülle um den Kopf, deren Dicke je Richtung eine Maske bestimmt:
// Wo keine Haare sind, liegt die Hülle unsichtbar im Kopf. So entstehen saubere Haaransätze und Ponyspitzen.
// Das Trikot ist eine Canvas-Textur auf dem Oberkörper (Muster, Kragen, Wappen).

import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { EYE_COLORS, HAIR_COLORS, SKINS, type HopperLook } from './look.ts'
import type { KitSpec } from './kit.ts'

export interface HopperModel {
  group: THREE.Group
  /** Mittelpunkt und Radius für die Kamera */
  center: THREE.Vector3
  height: number
  dispose(): void
}

// ---------- Maße ----------

const HEAD = new THREE.Vector3(0, 1.5, 0.02)
/** Halbachsen des Kopfes (breiter als hoch, wie bei den Vorbildern) */
const HA = 0.53
const HB = 0.49
const HC = 0.47

const SHORTS = '#2f4f86'
const SHOE = '#f7f7f5'
const SOLE = '#c9d3e2'

// ---------- Hilfen ----------

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function mat(color: THREE.ColorRepresentation, roughness = 0.62, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra })
}

function shade(hex: string, f: number): THREE.Color {
  const c = new THREE.Color(hex)
  return f < 0 ? c.lerp(new THREE.Color('#000000'), -f) : c.lerp(new THREE.Color('#ffffff'), f)
}

/** Punkt auf der Kopfoberfläche in Richtung (x, y) von vorn; liefert Position und Normale */
function onHead(x: number, y: number, lift = 0) {
  const nx = x / HA
  const ny = (y - HEAD.y) / HB
  const nz = Math.sqrt(Math.max(0.0001, 1 - nx * nx - ny * ny))
  const p = new THREE.Vector3(x, y, HEAD.z + nz * HC)
  const n = new THREE.Vector3(nx / HA, ny / HB, nz / HC).normalize()
  return { p: p.addScaledVector(n, lift), n }
}

/** Objekt auf den Kopf setzen, Blickrichtung entlang der Oberflächennormalen */
function placeOnHead(o: THREE.Object3D, x: number, y: number, lift = 0) {
  const { p, n } = onHead(x, y, lift)
  o.position.copy(p)
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n)
  return o
}

/**
 * Hülle um den Kopf: f(d) liefert die Dicke für eine Richtung d (Einheitskugel).
 * 0 = kein Haar (Hülle liegt unsichtbar im Kopf), 1 = `base` über der Haut, darüber wächst sie weiter.
 * `tint` färbt einzelne Stellen dunkler (Strähnen), 1 = volle Haarfarbe.
 */
function shell(thickness: (d: THREE.Vector3) => number, base: number, tint?: (d: THREE.Vector3) => number, w = 112, h = 84): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, w, h)
  const pos = g.attributes.position as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)
  const d = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    d.fromBufferAttribute(pos, i).normalize()
    const t = Math.max(0, thickness(d))
    const s = 0.92 + (0.08 + base) * Math.min(1, t) + base * Math.max(0, t - 1)
    pos.setXYZ(i, d.x * HA * s, d.y * HB * s, d.z * HC * s)
    colors.fill(tint ? tint(d) : 1, i * 3, i * 3 + 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  g.deleteAttribute('normal')
  g.deleteAttribute('uv')
  const merged = mergeVertices(g)
  merged.computeVertexNormals()
  merged.translate(HEAD.x, HEAD.y, HEAD.z)
  return merged
}

// ---------- Frisuren ----------

/** Seitenwinkel: 0 = vorn, ±π = hinten */
const azOf = (d: THREE.Vector3) => Math.atan2(d.x, d.z)

/** Ponyspitzen: Dreieckswelle über den Seitenwinkel; liefert 0 (Lücke) … 1 (Spitze) */
function tips(d: THREE.Vector3, count: number, phase = 0, sharp = 1.4) {
  const x = ((azOf(d) + phase) * count) / Math.PI
  const tri = 1 - Math.abs((((x % 2) + 2) % 2) - 1)
  return Math.pow(tri, sharp)
}

/** Strähnen: feine Rillen entlang der Längengrade, 1 = Strähne, 0 = Rille */
function strands(d: THREE.Vector3, count: number, twist = 0) {
  return Math.pow(Math.abs(Math.cos((azOf(d) + d.y * twist) * count)), 0.35)
}

/**
 * Grundform: Haar oben und hinten. `front` = Haaransatz vorn (d.y), `side` = über den Ohren, `nape` = hinten unten.
 * Liefert 0 … 1 mit kurzer, weicher Kante.
 */
function capMask(d: THREE.Vector3, front: number, side: number, nape: number) {
  const back = smooth(0.2, -0.6, d.z)
  const sideAmt = smooth(0.7, 0.15, Math.abs(d.z)) * smooth(0.35, 0.85, Math.abs(d.x))
  const line = lerp(lerp(front, side, sideAmt), nape, back)
  return smooth(line - 0.01, line + 0.045, d.y)
}

/** Haarlinie vorn mit Pony: Grundlinie, Tiefe der Spitzen, Anzahl, Verschiebung (Seitenscheitel) */
const fringeLine = (d: THREE.Vector3, line: number, depth: number, count: number, phase = 0) =>
  d.z > 0 ? line - depth * tips(d, count, phase) * smooth(0, 0.5, d.z) : line

const strandTint = (d: THREE.Vector3, count: number, twist = 0) => 0.78 + 0.22 * strands(d, count, twist)

function hairGeometries(style: HopperLook['hair']): THREE.BufferGeometry[] {
  switch (style) {
    case 'bald':
      return []
    case 'buzz':
      return [shell((d) => capMask(d, 0.5, 0.25, -0.55), 0.012)]
    case 'short':
      return [
        shell((d) => {
          const m = capMask(d, fringeLine(d, 0.46, 0.2, 6, 0.25), 0.05, -0.62)
          return m * (0.9 + 0.75 * smooth(0.2, 0.95, d.y)) * (0.86 + 0.14 * strands(d, 9, 1.5))
        }, 0.07, (d) => strandTint(d, 9, 1.5)),
        cowlick(),
      ]
    case 'side':
      return [
        shell((d) => {
          // Scheitel links, Haare fallen schräg nach rechts
          const m = capMask(d, fringeLine(d, 0.58 + 0.2 * d.x, 0.14, 4, 0.9), 0.08, -0.62)
          const part = 1 - 0.5 * smooth(0.06, 0, Math.abs(d.x - 0.35)) * smooth(0.5, 0.8, d.y)
          return m * part * (1 + 0.6 * smooth(0.2, 0.9, d.y) * smooth(0.5, -0.3, d.x)) * (0.88 + 0.12 * strands(d, 8, 2.5))
        }, 0.075, (d) => strandTint(d, 8, 2.5)),
      ]
    case 'spiky':
      return [
        shell((d) => capMask(d, fringeLine(d, 0.5, 0.18, 8), 0.1, -0.55) * (0.9 + 0.1 * strands(d, 10)), 0.06, (d) => strandTint(d, 10)),
        ...spikes(),
      ]
    case 'curly': {
      const bumps = (d: THREE.Vector3) => 0.5 + 0.5 * Math.sin(d.x * 19 + 1.3) * Math.sin(d.y * 17) * Math.sin(d.z * 21 + 0.7)
      return [shell((d) => {
        const m = capMask(d, fringeLine(d, 0.44, 0.08, 10), -0.05, -0.62)
        return m * (1.2 + 0.9 * smooth(0, 0.9, d.y) + 0.9 * bumps(d))
      }, 0.07, (d) => 0.8 + 0.2 * bumps(d))]
    }
    case 'afro': {
      const bumps = (d: THREE.Vector3) => 0.5 + 0.5 * Math.sin(d.x * 23) * Math.sin(d.y * 21 + 0.4) * Math.sin(d.z * 25)
      return [shell((d) => {
        const m = capMask(d, 0.5, -0.02, -0.6)
        return m * (1.6 + 3.4 * smooth(-0.3, 0.7, d.y) * smooth(1, 0.4, d.z) + 0.25 * bumps(d))
      }, 0.075, (d) => 0.85 + 0.15 * bumps(d))]
    }
    case 'long':
      return [
        shell((d) => {
          const m = capMask(d, fringeLine(d, 0.42, 0.1, 7), -0.1, -0.75)
          return m * (0.9 + 0.5 * smooth(0.3, 0.95, d.y)) * (0.88 + 0.12 * strands(d, 8))
        }, 0.07, (d) => strandTint(d, 8)),
        ...longHair(),
      ]
    case 'bun': {
      const bun = new THREE.SphereGeometry(0.19, 32, 24)
      bun.translate(HEAD.x, HEAD.y + HB * 0.95, HEAD.z - 0.16)
      setTint(bun, 1)
      return [shell((d) => capMask(d, fringeLine(d, 0.5, 0.05, 6), 0.1, -0.6) * (0.9 + 0.1 * strands(d, 10, -2)), 0.045, (d) => strandTint(d, 10, -2)), bun]
    }
  }
}

/** Einheitliche Vertexfarbe für Teile ohne Strähnen (alle Haarteile teilen ein Material mit Vertexfarben) */
function setTint(g: THREE.BufferGeometry, v: number) {
  const n = g.attributes.position.count
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(v), 3))
  return g
}

/** Gebogene, spitz zulaufende Strähne entlang einer Kurve */
function lock(curve: THREE.Curve<THREE.Vector3>, r0: number, r1 = 0.004): THREE.BufferGeometry {
  const seg = 20
  const radial = 12
  const g = new THREE.TubeGeometry(curve, seg, 1, radial, false)
  const pos = g.attributes.position as THREE.BufferAttribute
  const pts = curve.getSpacedPoints(seg)
  for (let i = 0; i < pos.count; i++) {
    const s = Math.floor(i / (radial + 1))
    const c = pts[Math.min(seg, s)]
    const r = lerp(r0, r1, Math.pow(s / seg, 1.3))
    pos.setXYZ(i, c.x + (pos.getX(i) - c.x) * r, c.y + (pos.getY(i) - c.y) * r, c.z + (pos.getZ(i) - c.z) * r)
  }
  g.computeVertexNormals()
  return setTint(g, 1)
}

/** Kleine Strähne, die oben absteht */
function cowlick(): THREE.BufferGeometry {
  return lock(new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0.0, HEAD.y + HB * 1.08, HEAD.z - 0.06),
    new THREE.Vector3(-0.02, HEAD.y + HB * 1.34, HEAD.z - 0.02),
    new THREE.Vector3(0.1, HEAD.y + HB * 1.3, HEAD.z + 0.06),
  ), 0.04)
}

function spikes(): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = []
  const dirs = [[0, 1, 0.15], [0.42, 0.85, 0.25], [-0.42, 0.85, 0.2], [0.25, 0.8, -0.45], [-0.3, 0.78, -0.5], [0.16, 0.72, 0.62], [-0.22, 0.7, 0.6], [0.65, 0.6, -0.1], [-0.65, 0.6, -0.1]]
  for (const [x, y, z] of dirs) {
    const dir = new THREE.Vector3(x, y, z).normalize()
    const base = new THREE.Vector3(HEAD.x + dir.x * HA * 0.95, HEAD.y + dir.y * HB * 0.95, HEAD.z + dir.z * HC * 0.95)
    const tip = base.clone().addScaledVector(dir, 0.22).add(new THREE.Vector3(0, 0.04, -0.03))
    out.push(lock(new THREE.QuadraticBezierCurve3(base, base.clone().lerp(tip, 0.5).addScaledVector(dir, 0.03), tip), 0.085, 0.01))
  }
  return out
}

/** Lange Haare: hinten bis auf die Schultern, vorn zwei Strähnen neben dem Gesicht */
function longHair(): THREE.BufferGeometry[] {
  const back = new THREE.SphereGeometry(1, 48, 32)
  back.scale(0.5, 0.48, 0.3)
  back.translate(HEAD.x, HEAD.y - 0.32, HEAD.z - 0.2)
  setTint(back, 0.92)
  const out: THREE.BufferGeometry[] = [back]
  for (const side of [-1, 1]) {
    out.push(lock(new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.42, HEAD.y + 0.2, HEAD.z + 0.2),
      new THREE.Vector3(side * 0.5, HEAD.y - 0.1, HEAD.z + 0.08),
      new THREE.Vector3(side * 0.46, HEAD.y - 0.4, HEAD.z - 0.02),
      new THREE.Vector3(side * 0.4, HEAD.y - 0.56, HEAD.z - 0.06),
    ]), 0.075, 0.025))
  }
  return out
}

// ---------- Gesicht ----------

function addFace(group: THREE.Group, look: HopperLook, skin: string) {
  const eyeMat = mat(EYE_COLORS[look.eyes], 0.25)
  const pupilMat = mat('#0d0d10', 0.12)
  const glint = new THREE.MeshBasicMaterial({ color: '#ffffff' })
  for (const side of [-1, 1]) {
    const eye = new THREE.Group()
    const iris = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), eyeMat)
    iris.scale.set(0.074, 0.106, 0.034)
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), pupilMat)
    pupil.scale.set(0.05, 0.074, 0.03)
    pupil.position.set(0, -0.006, 0.012)
    const shine = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), glint)
    shine.scale.set(0.02, 0.026, 0.01)
    shine.position.set(0.02 * side * -1 + 0.012, 0.032, 0.03)
    const shine2 = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), glint)
    shine2.scale.set(0.009, 0.009, 0.006)
    shine2.position.set(-0.018, -0.034, 0.03)
    eye.add(iris, pupil, shine, shine2)
    placeOnHead(eye, side * 0.19, HEAD.y - 0.06, -0.012)
    group.add(eye)

    // Wangen
    const blush = new THREE.Mesh(new THREE.CircleGeometry(0.065, 24), new THREE.MeshBasicMaterial({
      color: '#ff7a7a', transparent: true, opacity: 0.22, depthWrite: false,
    }))
    blush.scale.set(1.25, 0.8, 1)
    placeOnHead(blush, side * 0.29, HEAD.y - 0.19, 0.004)
    group.add(blush)

    // Ohren
    const ear = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), mat(skin))
    ear.scale.set(0.05, 0.1, 0.075)
    ear.position.set(side * HA * 0.98, HEAD.y - 0.06, HEAD.z - 0.02)
    group.add(ear)

    // Augenbrauen
    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.07, 4, 8), mat(HAIR_COLORS[look.hairColor], 0.8))
    placeOnHead(brow, side * 0.19, HEAD.y + 0.085, 0.004)
    brow.rotateZ(Math.PI / 2 + side * 0.12)
    group.add(brow)
  }

  // Mund: kleines, leicht gewelltes Lächeln
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= 12; i++) {
    const t = i / 12
    const x = (t - 0.5) * 0.15
    const y = HEAD.y - 0.215 - 0.03 * Math.sin(t * Math.PI) + 0.004 * Math.sin(t * Math.PI * 4)
    pts.push(onHead(x, y, 0.004).p)
  }
  const mouth = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.011, 8, false), mat('#4a2a24', 0.5))
  group.add(mouth)

  // Nase: kaum sichtbare Wölbung
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), mat(shade(skin, -0.04)))
  nose.scale.set(0.035, 0.028, 0.03)
  placeOnHead(nose, 0, HEAD.y - 0.13, -0.012)
  group.add(nose)
}

function addBeard(group: THREE.Group, look: HopperLook, skin: string) {
  const hair = HAIR_COLORS[look.hairColor]
  if (look.beard === 'none') return
  if (look.beard === 'moustache') {
    for (const side of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, 0.07, 6, 12), mat(hair, 0.8))
      placeOnHead(m, side * 0.05, HEAD.y - 0.175, 0.01)
      m.rotateZ(Math.PI / 2 - side * 0.35)
      group.add(m)
    }
    return
  }
  const full = look.beard === 'full'
  // Kinn und Kiefer, Mundpartie frei
  const g = shell((d) => {
    if (d.z < -0.15) return 0
    // Kinn und Kiefer bis knapp unter die Wangen, an den Seiten als Koteletten hoch zum Haar
    const jaw = smooth(-0.3, -0.42, d.y) * smooth(-0.15, 0.2, d.z)
    const burns = full ? smooth(0.86, 0.94, Math.abs(d.x)) * smooth(0.2, 0.05, d.y) * smooth(-0.1, 0.1, d.z) : 0
    const mouthHole = smooth(0.1, 0.06, Math.hypot(d.x * 0.9, (d.y + 0.47) * 1.3)) * smooth(0.55, 0.85, d.z)
    return Math.max(0, Math.max(jaw, burns) - mouthHole * 1.6) * (full ? 1.6 : 1)
  }, full ? 0.06 : 0.008)
  const color = full ? hair : '#' + shade(hair, 0).lerp(new THREE.Color(skin), 0.62).getHexString()
  group.add(new THREE.Mesh(g, mat(color, 0.9, full ? {} : { transparent: true, opacity: 0.75 })))
}

function addGlasses(group: THREE.Group, look: HopperLook) {
  if (look.glasses === 'none') return
  const sun = look.glasses === 'sun'
  const frame = mat(sun ? '#1d1f24' : '#24262c', 0.35)
  for (const side of [-1, 1]) {
    const lens = new THREE.Group()
    const r = 0.1
    const ring = look.glasses === 'square'
      ? new THREE.Mesh(roundedRing(0.22, 0.17, 0.045, 0.016), frame)
      : new THREE.Mesh(new THREE.TorusGeometry(r, 0.014, 10, 40), frame)
    lens.add(ring)
    if (sun) {
      const glass = new THREE.Mesh(
        look.glasses === 'sun' ? new THREE.CircleGeometry(r, 40) : new THREE.PlaneGeometry(0.2, 0.15),
        mat('#15171c', 0.08, { transparent: true, opacity: 0.88 }),
      )
      lens.add(glass)
    }
    placeOnHead(lens, side * 0.19, HEAD.y - 0.06, 0.05)
    group.add(lens)
    // Bügel vom Rahmen bis zum Ohr
    const from = onHead(side * 0.3, HEAD.y - 0.04, 0.03).p
    const to = new THREE.Vector3(side * HA * 1.0, HEAD.y - 0.02, HEAD.z - 0.02)
    const arm = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(from,
      new THREE.Vector3(side * HA * 1.0, HEAD.y - 0.03, (from.z + to.z) / 2 + 0.08), to), 12, 0.008, 6), frame)
    group.add(arm)
  }
  // Steg: kurzer, gerader Bügel zwischen den Gläsern
  const bridge = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.06, 4, 8), frame)
  placeOnHead(bridge, 0, HEAD.y - 0.035, 0.055)
  bridge.rotateZ(Math.PI / 2)
  group.add(bridge)
}

/** Abgerundetes Rechteck als Rahmen (eckige Brille) */
function roundedRing(w: number, h: number, r: number, t: number): THREE.BufferGeometry {
  const path = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  path.moveTo(x + r, y)
  path.lineTo(x + w - r, y)
  path.quadraticCurveTo(x + w, y, x + w, y + r)
  path.lineTo(x + w, y + h - r)
  path.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  path.lineTo(x + r, y + h)
  path.quadraticCurveTo(x, y + h, x, y + h - r)
  path.lineTo(x, y + r)
  path.quadraticCurveTo(x, y, x + r, y)
  const pts = path.getSpacedPoints(64).map((p) => new THREE.Vector3(p.x, p.y, 0))
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 64, t, 8, true)
}

// ---------- Trikot ----------

const TEX_W = 512
const TEX_H = 256

/** u: 0 = Rücken, 0.5 = Brustmitte; v: 0 = Saum, 1 = Hals (wie auf dem Oberkörper abgerollt) */
function drawJersey(kit: KitSpec, crest: CanvasImageSource | null): HTMLCanvasElement {
  const cv = document.createElement('canvas')
  cv.width = TEX_W
  cv.height = TEX_H
  const g = cv.getContext('2d')!
  const W = TEX_W
  const H = TEX_H
  // Canvas-y wächst nach unten, v nach oben
  const Y = (v: number) => H * (1 - v)
  g.fillStyle = kit.b
  g.fillRect(0, 0, W, H)
  const p = kit.p
  if (p) {
    g.fillStyle = p.c
    switch (p.k) {
      case 'stripes': {
        // n Streifen auf der Vorderseite, symmetrisch zur Brustmitte, rundherum fortgesetzt
        const n = p.n ?? 3
        const period = W / 2 / n
        const sw = period * (p.w ?? 0.5)
        const start = n % 2 ? W / 2 : W / 2 + period / 2
        for (let c = start - Math.ceil(start / period) * period; c < W + period; c += period) g.fillRect(c - sw / 2, 0, sw, H)
        break
      }
      case 'pinstripes': {
        const period = W / 40
        for (let x = W / 2 - period / 2; x > -period; x -= period) g.fillRect(x - 1.5, 0, 3, H)
        for (let x = W / 2 + period / 2; x < W; x += period) g.fillRect(x - 1.5, 0, 3, H)
        break
      }
      case 'hoops': {
        const n = p.n ?? 4
        const top = 0.86
        const period = top / (n + 0.5)
        const hw = period * (p.w ?? 0.5)
        for (let i = 0; i < n; i++) {
          const v0 = top - period * 0.5 - i * period - hw
          g.fillRect(0, Y(v0 + hw), W, hw * H)
        }
        break
      }
      case 'halves':
        g.fillRect(W / 2, 0, W / 2, H)
        break
      case 'sash': {
        const dir = p.dir === 'l' ? -1 : 1
        const w = (p.w ?? 0.2) * H
        g.save()
        g.beginPath()
        // vorn von Schulter zu Hüfte, hinten gespiegelt weiter
        for (const cx of [W / 2, 0, W]) {
          const sx = cx === W / 2 ? dir : -dir
          g.moveTo(cx - sx * W * 0.16 - w / 2, Y(0.98))
          g.lineTo(cx - sx * W * 0.16 + w / 2, Y(0.98))
          g.lineTo(cx + sx * W * 0.16 + w / 2, Y(-0.02))
          g.lineTo(cx + sx * W * 0.16 - w / 2, Y(-0.02))
          g.closePath()
        }
        g.fill()
        g.restore()
        break
      }
      case 'band': {
        const y = p.y ?? 0.6
        const h = p.h ?? 0.16
        g.fillRect(0, Y(y + h / 2), W, h * H)
        break
      }
      case 'vstripe': {
        const w = (p.w ?? 0.22) * W * 0.5
        g.fillRect(W / 2 - w / 2, 0, w, H)
        g.fillRect(-w / 2, 0, w, H)
        g.fillRect(W - w / 2, 0, w, H)
        break
      }
      case 'chevron': {
        g.beginPath()
        g.moveTo(W * 0.25, Y(0.98))
        g.lineTo(W / 2, Y(0.55))
        g.lineTo(W * 0.75, Y(0.98))
        g.lineTo(W * 0.75, Y(0.8))
        g.lineTo(W / 2, Y(0.38))
        g.lineTo(W * 0.25, Y(0.8))
        g.closePath()
        g.fill()
        break
      }
      case 'yoke':
        g.fillRect(0, 0, W, Y(0.74))
        break
      case 'quarters':
        g.fillRect(W / 2, Y(1), W / 2, H * 0.5)
        g.fillRect(0, Y(0.5), W / 2, H * 0.5)
        break
      case 'fade': {
        const grad = g.createLinearGradient(0, Y(0.95), 0, Y(0))
        grad.addColorStop(0, 'rgba(0,0,0,0)')
        grad.addColorStop(1, p.c)
        g.fillStyle = kit.b
        g.fillRect(0, 0, W, H)
        // Verlauf über die Grundfarbe legen
        const tmp = document.createElement('canvas')
        tmp.width = 1
        tmp.height = H
        const tg = tmp.getContext('2d')!
        const tgrad = tg.createLinearGradient(0, 0, 0, H)
        tgrad.addColorStop(0, kit.b)
        tgrad.addColorStop(0.25, kit.b)
        tgrad.addColorStop(1, p.c)
        tg.fillStyle = tgrad
        tg.fillRect(0, 0, 1, H)
        g.drawImage(tmp, 0, 0, W, H)
        break
      }
      case 'cross': {
        const w = (p.w ?? 0.2) * W * 0.5
        g.fillRect(W / 2 - w / 2, 0, w, H)
        g.fillRect(0, Y(0.72), W, H * 0.16)
        break
      }
      case 'diag': {
        g.beginPath()
        if (p.dir === 'l') {
          g.moveTo(W * 0.75, 0); g.lineTo(0, 0); g.lineTo(0, H); g.lineTo(W * 0.25, H)
        } else {
          g.moveTo(W * 0.25, 0); g.lineTo(W, 0); g.lineTo(W, H); g.lineTo(W * 0.75, H)
        }
        g.closePath()
        g.fill()
        break
      }
      case 'checks': {
        // Schachbrett: Felder etwa so breit wie hoch, symmetrisch zur Brustmitte
        const cols = 16
        const cw = W / cols
        const rows = 5
        const ch = (H * 0.9) / rows
        for (let r = 0; r < rows; r++) {
          for (let q = 0; q < cols; q++) if ((q + r) % 2 === 0) g.fillRect(q * cw, H * 0.1 + r * ch, cw, ch)
        }
        break
      }
      case 'tonal': {
        g.globalAlpha = 0.28
        g.lineWidth = 9
        g.strokeStyle = p.c
        for (let x = -H; x < W + H; x += 30) {
          g.beginPath()
          g.moveTo(x, 0)
          g.lineTo(x + H * 0.7, H)
          g.stroke()
        }
        g.globalAlpha = 1
        break
      }
    }
  }

  // Kragen
  const collar = kit.c ?? kit.b
  g.fillStyle = collar
  g.fillRect(0, 0, W, H * 0.05)
  if (kit.cs === 'v') {
    g.beginPath()
    g.moveTo(W / 2 - W * 0.07, 0)
    g.lineTo(W / 2, H * 0.2)
    g.lineTo(W / 2 + W * 0.07, 0)
    g.lineTo(W / 2 + W * 0.045, 0)
    g.lineTo(W / 2, H * 0.14)
    g.lineTo(W / 2 - W * 0.045, 0)
    g.closePath()
    g.fill()
  } else if (kit.cs === 'polo') {
    g.fillRect(W / 2 - 3, 0, 6, H * 0.18)
  }
  // Saum
  g.fillStyle = 'rgba(0,0,0,0.07)'
  g.fillRect(0, H - 6, W, 6)

  // Wappen auf der linken Brust (von vorn rechts)
  if (crest) {
    const s = H * 0.15
    const cx = W * 0.565
    const cy = Y(0.66)
    g.fillStyle = 'rgba(255,255,255,0.0)'
    g.drawImage(crest, cx - s / 2, cy - s / 2, s, s * 1)
  }
  return cv
}

function drawSleeve(kit: KitSpec): HTMLCanvasElement {
  const cv = document.createElement('canvas')
  cv.width = 128
  cv.height = 64
  const g = cv.getContext('2d')!
  g.fillStyle = kit.s ?? (kit.p?.k === 'halves' || kit.p?.k === 'quarters' ? kit.b : kit.b)
  g.fillRect(0, 0, 128, 64)
  if (kit.p?.k === 'hoops' && !kit.s) {
    g.fillStyle = kit.p.c
    g.fillRect(0, 20, 128, 14)
  }
  if (kit.p?.k === 'pinstripes' && !kit.s) {
    g.fillStyle = kit.p.c
    for (let x = 0; x < 128; x += 9) g.fillRect(x, 0, 2, 64)
  }
  // Bündchen unten (v = 0 → Canvas unten)
  g.fillStyle = kit.cu ?? kit.c ?? kit.s ?? kit.b
  g.fillRect(0, 64 - 9, 128, 9)
  return cv
}

function texture(cv: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

// ---------- Körper ----------

/** Oberkörper als Drehkörper; Rücken bei u = 0, Brust bei u = 0.5 */
function torsoGeometry(): THREE.BufferGeometry {
  const prof: [number, number][] = [
    [0.255, 0.5], [0.268, 0.56], [0.272, 0.66], [0.266, 0.78], [0.252, 0.88], [0.226, 0.95], [0.18, 1.0], [0.12, 1.025], [0.095, 1.035],
  ]
  const pts = prof.map(([r, y]) => new THREE.Vector2(r, y))
  const g = new THREE.LatheGeometry(pts, 48, Math.PI, Math.PI * 2)
  // UV v gleichmäßig über die Höhe statt über die Profilpunkte
  const uv = g.attributes.uv as THREE.BufferAttribute
  const pos = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setY(i, (pos.getY(i) - 0.5) / 0.535)
  g.scale(1, 1, 0.8)
  g.computeVertexNormals()
  return g
}

function sleeveGeometry(): THREE.BufferGeometry {
  const prof: [number, number][] = [[0.098, -0.2], [0.104, -0.14], [0.104, -0.05], [0.094, 0.0], [0.07, 0.035], [0.02, 0.05]]
  const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 28)
  const uv = g.attributes.uv as THREE.BufferAttribute
  const pos = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setY(i, (pos.getY(i) + 0.2) / 0.25)
  return g
}

export interface BuildOptions {
  /** Wappen für die Brust (bereits geladen) */
  crest?: CanvasImageSource | null
  /** Pose: 0 = neutral, 1 = winken (rechter Arm hoch) */
  wave?: number
}

export function buildHopper(look: HopperLook, kit: KitSpec, opts: BuildOptions = {}): HopperModel {
  const group = new THREE.Group()
  const skin = SKINS[look.skin]
  const skinMat = mat(skin, 0.58)
  const textures: THREE.Texture[] = []

  // Kopf
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), skinMat)
  head.scale.set(HA, HB, HC)
  head.position.copy(HEAD)
  group.add(head)
  // Kinn minimal nach vorn gerundet
  const chin = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), skinMat)
  chin.scale.set(0.33, 0.25, 0.3)
  chin.position.set(0, HEAD.y - 0.2, HEAD.z + 0.12)
  group.add(chin)

  addFace(group, look, skin)
  addBeard(group, look, skin)

  const hairMat = mat(HAIR_COLORS[look.hairColor], 0.7, { vertexColors: true })
  for (const g of hairGeometries(look.hair)) group.add(new THREE.Mesh(g, hairMat))
  addGlasses(group, look)

  // Hals
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.16, 20), skinMat)
  neck.position.set(0, 1.06, 0)
  group.add(neck)

  // Trikot
  const jerseyTex = texture(drawJersey(kit, opts.crest ?? null))
  textures.push(jerseyTex)
  const jerseyMat = mat('#ffffff', 0.78, { map: jerseyTex })
  const torso = new THREE.Mesh(torsoGeometry(), jerseyMat)
  group.add(torso)
  // Kragen als kleiner Wulst
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 10, 32), mat(kit.c ?? kit.b, 0.7))
  collar.rotation.x = Math.PI / 2
  collar.scale.set(1, 0.85, 1)
  collar.position.set(0, 1.035, 0)
  group.add(collar)

  // Arme
  const sleeveTex = texture(drawSleeve(kit))
  textures.push(sleeveTex)
  const sleeveMat = mat('#ffffff', 0.78, { map: sleeveTex })
  const wave = opts.wave ?? 0
  for (const side of [-1, 1]) {
    const arm = new THREE.Group()
    arm.position.set(side * 0.235, 0.93, 0)
    const sleeve = new THREE.Mesh(sleeveGeometry(), sleeveMat)
    sleeve.scale.set(1, 1, 0.92)
    // Oberarm unter dem Ärmel, Ellbogen knapp unter dem Saum
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.08, 6, 16), skinMat)
    upper.position.y = -0.18
    const elbow = new THREE.Group()
    elbow.position.y = -0.2
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.066, 0.13, 6, 16), skinMat)
    fore.position.y = -0.08
    const hand = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 18), skinMat)
    hand.scale.set(0.082, 0.095, 0.078)
    hand.position.y = -0.25
    const thumb = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), skinMat)
    thumb.scale.set(0.03, 0.045, 0.03)
    thumb.position.set(0, -0.22, 0.07)
    elbow.add(fore, hand, thumb)
    arm.add(sleeve, upper, elbow)
    // Winken: rechter Arm (von vorn links) seitlich hoch, Unterarm nach oben angewinkelt
    const raise = side === -1 ? wave : 0
    arm.rotation.z = side * lerp(0.2, 1.85, raise)
    arm.rotation.x = lerp(0.04, -0.15, raise)
    elbow.rotation.z = side * lerp(0, 1.3, raise)
    group.add(arm)
  }

  // Hose
  const shortsMat = mat(SHORTS, 0.85)
  const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.262, 0.27, 0.16, 32), shortsMat)
  hips.scale.z = 0.8
  hips.position.y = 0.46
  group.add(hips)
  for (const side of [-1, 1]) {
    const legHole = new THREE.Mesh(new THREE.CylinderGeometry(0.128, 0.138, 0.17, 24), shortsMat)
    legHole.scale.z = 0.9
    legHole.position.set(side * 0.125, 0.36, 0)
    group.add(legHole)

    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.072, 0.16, 6, 16), skinMat)
    leg.position.set(side * 0.12, 0.2, 0)
    group.add(leg)

    // Socken & Schuhe
    const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.076, 0.076, 0.06, 18), mat('#ffffff', 0.9))
    sock.position.set(side * 0.12, 0.11, 0)
    group.add(sock)
    const shoe = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), mat(SHOE, 0.5))
    shoe.scale.set(0.11, 0.075, 0.17)
    shoe.position.set(side * 0.125, 0.06, 0.035)
    group.add(shoe)
    const sole = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 28), mat(SOLE, 0.6))
    sole.scale.set(0.106, 0.03, 0.165)
    sole.position.set(side * 0.125, 0.015, 0.035)
    group.add(sole)
  }

  group.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true
      o.receiveShadow = true
    }
  })

  return {
    group,
    center: new THREE.Vector3(0, 1.0, 0),
    height: 2.05,
    dispose() {
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose()
          const m = o.material as THREE.Material
          m.dispose()
        }
      })
      textures.forEach((t) => t.dispose())
    },
  }
}
