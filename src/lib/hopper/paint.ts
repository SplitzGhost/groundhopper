// Malt den Hopper aus dem Grundbild (src/assets/hopper/base.png, erzeugt mit tools/hopper-base.ts):
// Jeder Pixel gehört zu einem Bereich (labels.png). Haut, Haare und Kleidung werden umgefärbt, wobei die
// Helligkeit des Originals als Schattierung erhalten bleibt – so bleibt der weiche 3D-Look. Das Trikot ist
// ein flaches Muster, das auf das weiße Shirt gelegt wird; die Augen zeichnet die App je nach Augenform neu.
// Die Arme landen auf eigenen Bildern, damit Karten sie für Posen drehen können (winken, jubeln).

import baseUrl from '../../assets/hopper/base.png'
import labelsUrl from '../../assets/hopper/labels.png'
import META from '../../data/hopperBase.json'
import { EYE_SHAPES, HAIR_COLORS, SKINS, lookKey, type EyeShape, type HopperLook } from './look.ts'
import { kitSpec, loadKits, parseKitId, type KitSpec } from './kit.ts'
import { crestFor } from '../crests.ts'
import { ARMS } from './figure.ts'

const R = { none: 0, skin: 1, hair: 2, shirt: 3, collar: 4, cuff: 5, shorts: 6, socks: 7, shoes: 8, mouth: 9, eye: 10, sleeve: 11, armL: 12, armR: 13 } as const

export const HOPPER_W = META.width
export const HOPPER_H = META.height
/** Seitenverhältnis der ganzen Figur (Breite / Höhe) */
export const HOPPER_ASPECT = META.width / META.height

// ---------- Grundbild laden ----------

interface Base {
  pixels: Uint8ClampedArray
  labels: Uint8Array
  lum: Float32Array
}

let basePromise: Promise<Base> | null = null

function loadImage(src: string, cors = false): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    if (cors) img.crossOrigin = 'anonymous'
    img.onload = () => res(img)
    img.onerror = rej
    img.src = src
  })
}

function imageData(img: HTMLImageElement): ImageData {
  const cv = document.createElement('canvas')
  cv.width = META.width
  cv.height = META.height
  const g = cv.getContext('2d', { willReadFrequently: true })!
  g.drawImage(img, 0, 0)
  return g.getImageData(0, 0, META.width, META.height)
}

function loadBase(): Promise<Base> {
  basePromise ??= Promise.all([loadImage(baseUrl), loadImage(labelsUrl)]).then(([b, l]) => {
    const pixels = imageData(b).data
    const lab = imageData(l).data
    const n = META.width * META.height
    const labels = new Uint8Array(n)
    const lum = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      labels[i] = lab[i * 4]
      lum[i] = 0.299 * pixels[i * 4] + 0.587 * pixels[i * 4 + 1] + 0.114 * pixels[i * 4 + 2]
    }
    return { pixels, labels, lum }
  })
  basePromise.catch(() => { basePromise = null })
  return basePromise
}

// ---------- Farben ----------

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16)
  return [n >> 16, (n >> 8) & 255, n & 255]
}

/**
 * Zielfarbe mit der Schattierung des Originals: f < 1 dunkelt ab, f > 1 hellt zum Weiß hin auf.
 * `shine` dämpft Glanzlichter (auf dunklen Stoffen wirken sie sonst wie Flecken).
 */
function shade(c: number, f: number, shine = 1): number {
  return f <= 1 ? c * f : c + (255 - c) * Math.min(1, (f - 1) * 2.2 * shine)
}

// ---------- Trikotmuster ----------

const S = META.shirt
const T = META.torso
const SHIRT_H = S.y1 - S.y0
const TORSO_W = T.x1 - T.x0
const CX = (T.x0 + T.x1) / 2

/** Flaches Trikot (Rumpf, Ärmel, Kragen, Bündchen, Hose, Stutzen) auf eine eigene Fläche malen */
function drawKit(kit: KitSpec, crest: HTMLImageElement | null): Uint8ClampedArray {
  const cv = document.createElement('canvas')
  cv.width = META.width
  cv.height = META.height
  const g = cv.getContext('2d', { willReadFrequently: true })!
  const Y = (t: number) => S.y0 + SHIRT_H * t
  // Rumpf
  g.fillStyle = kit.b
  g.fillRect(0, 0, META.width, META.height)
  const p = kit.p
  if (p) {
    g.save()
    g.fillStyle = p.c
    g.strokeStyle = p.c
    switch (p.k) {
      case 'stripes': {
        const n = p.n ?? 3
        const period = TORSO_W / n
        const sw = period * (p.w ?? 0.5)
        const first = CX - ((n - 1) / 2) * period
        for (let c = first - period * 3; c < T.x1 + period * 3; c += period) g.fillRect(c - sw / 2, 0, sw, META.height)
        break
      }
      case 'pinstripes': {
        const period = TORSO_W / 11
        for (let c = CX - period * 8; c < CX + period * 8; c += period) g.fillRect(c - 1.6, 0, 3.2, META.height)
        break
      }
      case 'hoops': {
        const n = p.n ?? 4
        const top = 0.14
        const period = (1 - top) / (n + 0.5)
        const h = period * (p.w ?? 0.5)
        for (let i = 0; i < n; i++) g.fillRect(0, Y(top + period * (0.5 + i)), META.width, h * SHIRT_H)
        break
      }
      case 'halves':
        g.fillRect(CX, 0, META.width, META.height)
        break
      case 'sash': {
        const w = (p.w ?? 0.2) * TORSO_W * 1.1
        const l = p.dir === 'l'
        const xa = l ? T.x1 : T.x0
        const xb = l ? T.x0 : T.x1
        g.beginPath()
        g.moveTo(xa - w / 2, Y(0))
        g.lineTo(xa + w / 2, Y(0))
        g.lineTo(xb + w / 2, Y(1))
        g.lineTo(xb - w / 2, Y(1))
        g.closePath()
        g.fill()
        break
      }
      case 'band': {
        const y = 1 - (p.y ?? 0.6)
        const h = p.h ?? 0.16
        g.fillRect(0, Y(y - h / 2), META.width, h * SHIRT_H)
        break
      }
      case 'vstripe': {
        const w = (p.w ?? 0.22) * TORSO_W
        g.fillRect(CX - w / 2, 0, w, META.height)
        break
      }
      case 'cross': {
        const w = (p.w ?? 0.2) * TORSO_W
        g.fillRect(CX - w / 2, 0, w, META.height)
        g.fillRect(0, Y(0.24), META.width, SHIRT_H * 0.17)
        break
      }
      case 'chevron': {
        g.beginPath()
        g.moveTo(T.x0, Y(0.02))
        g.lineTo(CX, Y(0.45))
        g.lineTo(T.x1, Y(0.02))
        g.lineTo(T.x1, Y(0.2))
        g.lineTo(CX, Y(0.63))
        g.lineTo(T.x0, Y(0.2))
        g.closePath()
        g.fill()
        break
      }
      case 'yoke':
        g.fillRect(0, 0, META.width, Y(0.3))
        break
      case 'quarters':
        g.fillRect(CX, 0, META.width, Y(0.5))
        g.fillRect(0, Y(0.5), CX, META.height)
        break
      case 'diag': {
        g.beginPath()
        if (p.dir === 'l') {
          g.moveTo(T.x1, Y(0)); g.lineTo(0, Y(0)); g.lineTo(0, Y(1)); g.lineTo(T.x0, Y(1))
        } else {
          g.moveTo(T.x0, Y(0)); g.lineTo(META.width, Y(0)); g.lineTo(META.width, Y(1)); g.lineTo(T.x1, Y(1))
        }
        g.closePath()
        g.fill()
        break
      }
      case 'checks': {
        const size = TORSO_W / 6
        for (let r = 0; r * size < SHIRT_H; r++) {
          for (let q = -3; q * size < META.width; q++) if ((q + r) % 2 === 0) g.fillRect(T.x0 + q * size, S.y0 + r * size, size, size)
        }
        break
      }
      case 'fade': {
        const grad = g.createLinearGradient(0, Y(0.2), 0, Y(1))
        grad.addColorStop(0, kit.b)
        grad.addColorStop(1, p.c)
        g.fillStyle = grad
        g.fillRect(0, Y(0), META.width, SHIRT_H)
        break
      }
      case 'tonal': {
        g.globalAlpha = 0.24
        g.lineWidth = TORSO_W * 0.045
        for (let x = T.x0 - SHIRT_H; x < T.x1 + SHIRT_H; x += TORSO_W / 7) {
          g.beginPath()
          g.moveTo(x, Y(0))
          g.lineTo(x + SHIRT_H * 0.7, Y(1))
          g.stroke()
        }
        break
      }
    }
    g.restore()
  }
  // Wappen auf der linken Brust (von vorn rechts)
  if (crest) {
    const s = TORSO_W * 0.16
    g.drawImage(crest, CX + TORSO_W * 0.2 - s / 2, Y(0.22), s, s)
  }
  return g.getImageData(0, 0, META.width, META.height).data
}

// ---------- Augen ----------

function drawEyes(g: CanvasRenderingContext2D, shape: EyeShape, scale: number) {
  for (const [n, e] of META.eyes.entries()) {
    const x = e.x * scale
    const y = e.y * scale
    const rw = (e.w / 2) * scale
    const rh = (e.h / 2) * scale
    const right = n === 1
    g.save()
    const ink = g.createLinearGradient(x, y - rh, x, y + rh)
    ink.addColorStop(0, '#3a3438')
    ink.addColorStop(0.55, '#1b181b')
    ink.addColorStop(1, '#0c0a0c')
    g.fillStyle = ink
    g.strokeStyle = '#1b181b'
    g.lineCap = 'round'
    const glint = (gx: number, gy: number, r: number, a = 0.9) => {
      g.fillStyle = `rgba(255,255,255,${a})`
      g.beginPath()
      g.ellipse(gx, gy, r * 0.8, r, -0.3, 0, Math.PI * 2)
      g.fill()
    }
    const oval = (sx = 1, sy = 1, dy = 0) => {
      g.beginPath()
      g.ellipse(x, y + dy * rh, rw * sx, rh * sy, 0, 0, Math.PI * 2)
      g.fill()
    }
    switch (shape) {
      case 'oval':
        oval()
        glint(x + rw * 0.25, y - rh * 0.5, rw * 0.34)
        break
      case 'round':
        oval(1.25, 0.52, 0.12)
        glint(x + rw * 0.35, y - rh * 0.12, rw * 0.32)
        break
      case 'big':
        oval(1.45, 1.08)
        glint(x + rw * 0.45, y - rh * 0.5, rw * 0.45)
        glint(x - rw * 0.45, y + rh * 0.45, rw * 0.22, 0.75)
        break
      case 'happy':
        g.lineWidth = rw * 0.62
        g.beginPath()
        g.arc(x, y + rh * 0.2, rw * 1.05, Math.PI * 1.1, Math.PI * 1.9)
        g.stroke()
        break
      case 'sleepy':
        g.beginPath()
        g.ellipse(x, y + rh * 0.15, rw, rh * 0.7, 0, 0, Math.PI)
        g.closePath()
        g.fill()
        g.lineWidth = rw * 0.28
        g.beginPath()
        g.moveTo(x - rw * 1.2, y + rh * 0.12)
        g.lineTo(x + rw * 1.2, y + rh * 0.12)
        g.stroke()
        break
      case 'lashes': {
        oval(1, 0.92, 0.05)
        glint(x + rw * 0.25, y - rh * 0.4, rw * 0.32)
        g.lineWidth = rw * 0.2
        const side = right ? 1 : -1
        for (const a of [-0.35, 0, 0.35]) {
          const ang = -Math.PI / 2 + side * (0.9 + a)
          const bx = x + Math.cos(ang) * rw * 1.0
          const by = y - rh * 0.55 + Math.sin(ang) * rh * 0.35
          g.beginPath()
          g.moveTo(bx, by)
          g.lineTo(bx + Math.cos(ang) * rw * 0.7, by + Math.sin(ang) * rw * 0.7)
          g.stroke()
        }
        break
      }
      case 'wink':
        if (right) {
          g.lineWidth = rw * 0.55
          g.beginPath()
          g.arc(x, y + rh * 0.25, rw * 1.05, Math.PI * 1.12, Math.PI * 1.88)
          g.stroke()
        } else {
          oval()
          glint(x + rw * 0.25, y - rh * 0.5, rw * 0.34)
        }
        break
      case 'small':
        oval(0.75, 0.45, 0.1)
        glint(x + rw * 0.2, y - rh * 0.05, rw * 0.22)
        break
    }
    g.restore()
  }
}

// ---------- Zusammensetzen ----------

const crestCache = new Map<string, Promise<HTMLImageElement | null>>()
function crestOf(kit: string | null): Promise<HTMLImageElement | null> {
  const ref = kit ? parseKitId(kit) : null
  const src = ref ? crestFor(ref.club, 'sm') : null
  if (!src) return Promise.resolve(null)
  let p = crestCache.get(src)
  if (!p) {
    p = loadImage(src, true).catch(() => null)
    crestCache.set(src, p)
  }
  return p
}

const WHITE: [number, number, number] = [255, 255, 255]

export interface HopperParts {
  /** Figur ohne Arme, so groß wie das Grundbild */
  body: HTMLCanvasElement
  /** Linker und rechter Arm, je an der Stelle ARMS[i] im Grundbild */
  arms: HTMLCanvasElement[]
}

/** Malt den Hopper in voller Auflösung: Körper und beide Arme getrennt */
export async function paintHopper(look: HopperLook, kitId: string | null): Promise<HopperParts> {
  const [base, crest] = await Promise.all([loadBase(), crestOf(kitId), loadKits()])
  const kit = kitSpec(kitId)
  const pattern = drawKit(kit, crest)
  const skin = rgb(SKINS[look.skin])
  const hair = rgb(HAIR_COLORS[look.hairColor])
  const sleeve = rgb(kit.s ?? kit.b)
  const collar = rgb(kit.c ?? kit.b)
  const cuff = rgb(kit.cu ?? kit.c ?? kit.s ?? kit.b)
  const shorts = kit.sh ? rgb(kit.sh) : WHITE
  const socks = kit.so ? rgb(kit.so) : WHITE
  const ref = META.ref

  const cv = document.createElement('canvas')
  cv.width = META.width
  cv.height = META.height
  const g = cv.getContext('2d')!
  const out = g.createImageData(META.width, META.height)
  const armData = ARMS.map((b) => new ImageData(b.w, b.h))
  // Mittlere Hautfarbe am Drehpunkt (für die Kappe)
  const capSum = ARMS.map(() => [0, 0, 0, 0])
  const src = base.pixels
  const n = META.width * META.height
  for (let i = 0; i < n; i++) {
    const a = src[i * 4 + 3]
    if (!a) continue
    const L = base.labels[i]
    let o = out.data
    let j = i * 4
    const arm = L === R.armL ? 0 : L === R.armR ? 1 : -1
    if (arm >= 0) {
      const b = ARMS[arm]
      const x = i % META.width
      const y = (i / META.width) | 0
      o = armData[arm].data
      j = ((y - b.y) * b.w + (x - b.x)) * 4
    }
    o[j + 3] = a
    let c: readonly number[] | null = null
    let f = 1
    let shine = 1
    switch (L) {
      case R.skin: case R.armL: case R.armR: c = skin; f = base.lum[i] / ref.skin; break
      case R.hair: c = hair; f = base.lum[i] / ref.hair; shine = 0.6; break
      case R.shirt: c = [pattern[j], pattern[j + 1], pattern[j + 2]]; f = base.lum[i] / ref.shirt; break
      // Ärmel: eigene Farbe, sonst läuft das Muster weiter (Streifen, Ringel, Schulterpartie …)
      case R.sleeve: c = kit.s ? sleeve : [pattern[j], pattern[j + 1], pattern[j + 2]]; f = base.lum[i] / ref.shirt; break
      case R.collar: c = collar; f = base.lum[i] / ref.shirt; break
      case R.cuff: c = cuff; f = base.lum[i] / ref.shirt; break
      case R.shorts: c = shorts; f = base.lum[i] / ref.shorts; break
      case R.socks: c = socks; f = base.lum[i] / ref.socks; break
    }
    if (!c) {
      o[j] = src[i * 4]; o[j + 1] = src[i * 4 + 1]; o[j + 2] = src[i * 4 + 2]
      continue
    }
    // Auf dunklen Farben wirken Glanzlichter schnell wie Flecken
    const dark = (c[0] + c[1] + c[2]) / 3 < 110
    const s = dark ? shine * 0.5 : shine
    o[j] = shade(c[0], f, s)
    o[j + 1] = shade(c[1], f, s)
    o[j + 2] = shade(c[2], f, s)
    if (arm >= 0 && a > 200) {
      const b = ARMS[arm]
      if (Math.hypot((i % META.width) - b.px, ((i / META.width) | 0) - b.py) < b.r * 1.3) {
        const cs = capSum[arm]
        cs[0] += o[j]; cs[1] += o[j + 1]; cs[2] += o[j + 2]; cs[3]++
      }
    }
  }
  g.putImageData(out, 0, 0)
  drawEyes(g, look.eyes, 1)
  const arms = ARMS.map((b, k) => {
    const c = document.createElement('canvas')
    c.width = b.w
    c.height = b.h
    const ag = c.getContext('2d')!
    ag.putImageData(armData[k], 0, 0)
    // Kappe hinter dem Arm: angehoben schaut sonst eine Lücke zwischen Ärmel und Arm heraus
    const [r, gg, bb, cnt] = capSum[k]
    if (cnt) {
      const col = (f: number) => `rgb(${Math.round((r / cnt) * f)},${Math.round((gg / cnt) * f)},${Math.round((bb / cnt) * f)})`
      const cx = b.px - b.x
      const cy = b.py - b.y
      const grad = ag.createRadialGradient(cx, cy, 0, cx, cy, b.r)
      grad.addColorStop(0, col(1))
      grad.addColorStop(1, col(0.86))
      ag.globalCompositeOperation = 'destination-over'
      ag.fillStyle = grad
      ag.beginPath()
      ag.arc(cx, cy, b.r * 0.92, 0, Math.PI * 2)
      ag.fill()
    }
    return c
  })
  return { body: cv, arms }
}

/** Ganze Figur in Ruhehaltung zeichnen: Arme hinter dem Körper. scale/dx/dy bilden das Grundbild auf g ab. */
export function drawFigure(g: CanvasRenderingContext2D, parts: HopperParts, scale: number, dx: number, dy: number) {
  g.save()
  g.setTransform(scale, 0, 0, scale, dx, dy)
  g.imageSmoothingEnabled = true
  g.imageSmoothingQuality = 'high'
  parts.arms.forEach((c, k) => g.drawImage(c, ARMS[k].x, ARMS[k].y))
  g.drawImage(parts.body, 0, 0)
  g.restore()
}

// ---------- Fertige Figuren ----------

export type Framing = 'full' | 'bust' | 'kit'

/** Bildausschnitt im Grundbild: ganze Figur, quadratisch um den Kopf oder um das Trikot */
export function frameRect(framing: Framing): [number, number, number, number] {
  if (framing === 'bust') return [0, META.width * 0.08, META.width, META.width]
  if (framing === 'kit') {
    const size = S.x1 - S.x0 + 24
    return [S.x0 - 12, S.y0 - 34, size, size]
  }
  return [0, 0, META.width, META.height]
}

// Gemalte Figuren in voller Auflösung, die zuletzt benutzten bleiben im Speicher (je ~5 MB)
const painted = new Map<string, Promise<HopperParts>>()
const KEEP = 12
// Nacheinander malen, mit kurzer Pause dazwischen – viele Karten auf einmal blockieren so die Oberfläche nicht
let queue: Promise<unknown> = Promise.resolve()
const pause = () => new Promise<void>((res) => setTimeout(res, 8))

/** Gemalte Figur (gemeinsam genutzt von allen Bildern mit demselben Aussehen und Trikot) */
export function hopperParts(look: HopperLook, kit: string | null): Promise<HopperParts> {
  const key = lookKey(look) + '|' + (kit ?? 'basic')
  const hit = painted.get(key)
  if (hit) {
    painted.delete(key)
    painted.set(key, hit)
    return hit
  }
  const job = queue.then(async () => {
    await pause()
    return paintHopper(look, kit)
  })
  queue = job.catch(() => undefined)
  job.catch(() => painted.delete(key))
  painted.set(key, job)
  if (painted.size > KEEP) painted.delete(painted.keys().next().value!)
  return job
}

export { EYE_SHAPES }
