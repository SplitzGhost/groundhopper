// Prozedural gezeichnete Texturen für die 3D-Stadien. Die meisten sind hell/grau gehalten und
// werden mit der Vertexfarbe multipliziert – so reicht ein Muster für alle Vereinsfarben.

import * as THREE from 'three'
import type { Facade } from '../../data/stadiumInfo.ts'

const cache = new Map<string, THREE.CanvasTexture>()

function canvasTexture(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = true) {
  let tex = cache.get(key)
  if (tex) return tex
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const g = canvas.getContext('2d')!
  draw(g)
  tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  cache.set(key, tex)
  return tex
}

/** Deterministischer Zufall (gleiches Stadion → gleiches Bild) */
export function rng(seed: string | number) {
  let h = typeof seed === 'number' ? seed : 2166136261
  if (typeof seed === 'string') for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

// ---------- Sitze ----------

/** Ein Sitzplatz (0,5 m breit) je Kachel: Sitzschale, Lehne, Spalt */
export function seatTexture() {
  return canvasTexture('seats', 32, 32, (g) => {
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, 32, 32)
    // Lehne hinten (oben in der Kachel)
    const back = g.createLinearGradient(0, 0, 0, 14)
    back.addColorStop(0, '#c9c9c9')
    back.addColorStop(1, '#f2f2f2')
    g.fillStyle = back
    g.fillRect(2, 0, 28, 14)
    // Schatten unter der nächsten Reihe
    g.fillStyle = 'rgba(0,0,0,0.22)'
    g.fillRect(0, 0, 32, 3)
    // Spalt zwischen den Sitzen
    g.fillStyle = '#9a9a9a'
    g.fillRect(0, 0, 2, 32)
    g.fillRect(30, 0, 2, 32)
    g.fillStyle = '#e4e4e4'
    g.fillRect(4, 22, 24, 3)
  })
}

// ---------- Fassaden ----------

/** Kachelmaße in Metern je Fassadentyp */
export const FACADE_TILE: Record<Facade, [number, number]> = {
  concrete: [6, 3.6],
  glass: [1.8, 3.6],
  brick: [4.5, 3.2],
  metal: [1.2, 3],
  club: [4, 2.4],
  shell: [4.2, 3.4],
  lattice: [3, 3],
}

export function facadeTexture(type: Facade) {
  switch (type) {
    case 'concrete':
      return canvasTexture('f-concrete', 192, 116, (g) => {
        g.fillStyle = '#ffffff'
        g.fillRect(0, 0, 192, 116)
        // Fensterband zwischen den Pfeilern
        const win = g.createLinearGradient(0, 40, 0, 84)
        win.addColorStop(0, '#5d6878')
        win.addColorStop(1, '#8792a2')
        g.fillStyle = win
        g.fillRect(22, 44, 170, 36)
        g.fillStyle = '#d5d5d5'
        for (let x = 22; x < 192; x += 28) g.fillRect(x, 44, 3, 36)
        // Pfeiler mit Schattenkante
        g.fillStyle = '#f0f0f0'
        g.fillRect(0, 0, 20, 116)
        g.fillStyle = '#bdbdbd'
        g.fillRect(19, 0, 3, 116)
        // Geschossdecke
        g.fillStyle = '#cfcfcf'
        g.fillRect(0, 0, 192, 6)
      })
    case 'glass':
      return canvasTexture('f-glass', 64, 128, (g) => {
        const grad = g.createLinearGradient(0, 0, 64, 128)
        grad.addColorStop(0, '#f4f6f8')
        grad.addColorStop(0.5, '#cfd6de')
        grad.addColorStop(1, '#e8ecf0')
        g.fillStyle = grad
        g.fillRect(0, 0, 64, 128)
        g.fillStyle = '#7e8792'
        g.fillRect(0, 0, 3, 128)
        g.fillRect(0, 0, 64, 4)
        g.fillStyle = 'rgba(255,255,255,0.5)'
        g.fillRect(8, 10, 6, 110)
      })
    case 'metal':
      return canvasTexture('f-metal', 64, 64, (g) => {
        for (let x = 0; x < 64; x += 8) {
          const s = g.createLinearGradient(x, 0, x + 8, 0)
          s.addColorStop(0, '#ffffff')
          s.addColorStop(0.5, '#d4d4d4')
          s.addColorStop(1, '#f6f6f6')
          g.fillStyle = s
          g.fillRect(x, 0, 8, 64)
        }
        g.fillStyle = '#b8b8b8'
        g.fillRect(0, 0, 64, 2)
      })
    case 'brick':
      return canvasTexture('f-brick', 240, 170, (g) => {
        g.fillStyle = '#dcdcdc'
        g.fillRect(0, 0, 240, 170)
        g.fillStyle = '#ffffff'
        for (let row = 0; row < 170 / 10; row++) {
          const off = row % 2 ? 10 : 0
          for (let x = -20 + off; x < 240; x += 20) g.fillRect(x + 1, row * 10 + 1, 18, 8)
        }
        // Rundbogenfenster
        g.fillStyle = '#4b525c'
        g.beginPath()
        g.moveTo(90, 150)
        g.lineTo(90, 70)
        g.arc(120, 70, 30, Math.PI, 0)
        g.lineTo(150, 150)
        g.closePath()
        g.fill()
        g.strokeStyle = '#f0f0f0'
        g.lineWidth = 4
        g.stroke()
      })
    case 'club':
      return canvasTexture('f-club', 128, 76, (g) => {
        g.fillStyle = '#ffffff'
        g.fillRect(0, 0, 128, 76)
        g.fillStyle = '#e6e6e6'
        g.fillRect(0, 38, 128, 38)
        g.fillStyle = '#b3b3b3'
        g.fillRect(0, 0, 128, 2)
        g.fillRect(0, 37, 128, 1)
        g.fillRect(0, 0, 2, 76)
      })
    case 'shell':
      return canvasTexture('f-shell', 128, 104, (g) => {
        g.fillStyle = '#c4c4c4'
        g.fillRect(0, 0, 128, 104)
        const cell = (cx: number, cy: number) => {
          const rg = g.createRadialGradient(cx - 10, cy - 10, 4, cx, cy, 46)
          rg.addColorStop(0, '#ffffff')
          rg.addColorStop(1, '#dedede')
          g.fillStyle = rg
          g.beginPath()
          g.moveTo(cx, cy - 50)
          g.lineTo(cx + 62, cy)
          g.lineTo(cx, cy + 50)
          g.lineTo(cx - 62, cy)
          g.closePath()
          g.fill()
        }
        for (const [cx, cy] of [[0, 0], [128, 0], [64, 52], [0, 104], [128, 104]]) cell(cx, cy)
      })
    case 'lattice':
      return canvasTexture('f-lattice', 96, 96, (g) => {
        g.fillStyle = '#ffffff'
        g.fillRect(0, 0, 96, 96)
        g.strokeStyle = '#9aa1ab'
        g.lineWidth = 5
        g.beginPath()
        g.moveTo(-8, -8); g.lineTo(104, 104)
        g.moveTo(104, -8); g.lineTo(-8, 104)
        g.moveTo(40, -8); g.lineTo(104, 56)
        g.moveTo(-8, 40); g.lineTo(56, 104)
        g.moveTo(56, -8); g.lineTo(-8, 56)
        g.moveTo(104, 40); g.lineTo(40, 104)
        g.stroke()
      })
  }
}

/** Sockelzone mit Eingängen: 12 m × 3,2 m */
export function entranceTexture() {
  return canvasTexture('entrance', 240, 64, (g) => {
    g.fillStyle = '#f2f2f2'
    g.fillRect(0, 0, 240, 64)
    for (const x of [24, 132]) {
      g.fillStyle = '#3d4552'
      g.fillRect(x, 18, 84, 46)
      g.fillStyle = '#69737f'
      for (let k = 0; k < 4; k++) g.fillRect(x + 4 + k * 20, 22, 16, 42)
    }
    g.fillStyle = '#cfcfcf'
    g.fillRect(0, 0, 240, 4)
  })
}

// ---------- Dach ----------

/** Dachhaut: 6 m entlang der Tribüne × 4 m Tiefe */
export function roofTexture() {
  return canvasTexture('roof', 96, 64, (g) => {
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, 96, 64)
    g.fillStyle = '#e3e3e3'
    for (let x = 0; x < 96; x += 16) g.fillRect(x, 0, 1, 64)
    g.fillStyle = '#cdcdcd'
    g.fillRect(0, 0, 3, 64)
    g.fillRect(0, 0, 96, 1)
  })
}

// ---------- Werbebanden ----------

/** LED-Bande in Vereinsfarbe: 16 m × 1 m, farbig (nicht eingefärbt) */
export function ledTexture(color: string) {
  return canvasTexture(`led-${color}`, 512, 32, (g) => {
    const r = rng(color)
    let x = 0
    while (x < 512) {
      const w = 60 + Math.floor(r() * 90)
      const dark = r() > 0.5
      g.fillStyle = dark ? color : '#f6f8fb'
      g.fillRect(x, 0, w, 32)
      g.fillStyle = dark ? '#ffffff' : color
      // stilisierter Schriftzug
      let tx = x + 8
      while (tx < x + w - 14) {
        const lw = 4 + Math.floor(r() * 12)
        g.fillRect(tx, 11, lw, 10)
        tx += lw + 3
      }
      g.fillStyle = '#10141a'
      g.fillRect(x + w - 2, 0, 2, 32)
      x += w
    }
  })
}

// ---------- Platz und Rasen ----------

export interface FloorSpec {
  /** Halbe Ausdehnung des Innenraums (Meter) */
  a: number
  b: number
  r: number
  track: boolean
  mono: boolean
}

const PX = 9 // Pixel pro Meter
export const PITCH_HL = 52.5
export const PITCH_HW = 34

/** Innenraum: Rasen mit Mähstreifen und Linien, ggf. Laufbahn. Deckt das Rechteck [-a,a]×[-b,b] ab. */
export function floorTexture(f: FloorSpec) {
  const key = `floor-${f.a}-${f.b}-${f.r}-${f.track}-${f.mono}`
  const w = Math.round(2 * f.a * PX)
  const h = Math.round(2 * f.b * PX)
  return canvasTexture(key, w, h, (g) => {
    const X = (x: number) => (x + f.a) * PX
    const Y = (z: number) => (z + f.b) * PX
    const grass = f.mono ? ['#e3e7e3', '#dce1dc'] : ['#4fae55', '#459e4b']
    const apron = f.mono ? '#d8ddd8' : '#3e8f45'
    const line = f.mono ? '#fbfcfb' : '#f4f8f4'

    g.fillStyle = apron
    g.fillRect(0, 0, w, h)

    const roundRect = (a: number, b: number, r: number) => {
      g.beginPath()
      g.roundRect(X(-a), Y(-b), 2 * a * PX, 2 * b * PX, Math.max(0, r * PX))
    }

    if (f.track) {
      // 400-m-Bahn: Gerade 84 m, Kurvenradius ~37 m, 8 Bahnen
      const inA = PITCH_HL + 26, inB = PITCH_HW + 3
      const outA = inA + 10, outB = inB + 10
      roundRect(outA, outB, outB)
      g.fillStyle = f.mono ? '#e6e2df' : '#c65a40'
      g.fill()
      g.strokeStyle = f.mono ? '#f7f5f3' : 'rgba(255,255,255,0.75)'
      g.lineWidth = 1.2
      for (let k = 1; k < 8; k++) {
        const d = k * 1.25
        roundRect(inA + d, inB + d, inB + d)
        g.stroke()
      }
      roundRect(inA, inB, inB)
      g.fillStyle = apron
      g.fill()
    }

    // Mähstreifen über die gesamte Rasenfläche
    const gx0 = -PITCH_HL - 4, gx1 = PITCH_HL + 4
    const stripes = 14
    for (let k = 0; k < stripes; k++) {
      const x0 = gx0 + ((gx1 - gx0) * k) / stripes
      g.fillStyle = grass[k % 2]
      g.fillRect(X(x0), Y(-PITCH_HW - 3), ((gx1 - gx0) / stripes) * PX + 1, (2 * PITCH_HW + 6) * PX)
    }
    // Leichte Querstreifen für das Karomuster
    g.fillStyle = f.mono ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.035)'
    for (let k = 0; k < 10; k += 2) {
      g.fillRect(X(gx0), Y(-PITCH_HW - 3 + k * 7.4), (gx1 - gx0) * PX, 7.4 * PX)
    }

    // Linien
    g.strokeStyle = line
    g.fillStyle = line
    g.lineWidth = Math.max(1.6, 0.14 * PX)
    const rect = (x0: number, z0: number, x1: number, z1: number) => g.strokeRect(X(x0), Y(z0), (x1 - x0) * PX, (z1 - z0) * PX)
    const circle = (x: number, z: number, r: number, from = 0, to = Math.PI * 2) => {
      g.beginPath()
      g.arc(X(x), Y(z), r * PX, from, to)
      g.stroke()
    }
    const spot = (x: number, z: number) => {
      g.beginPath()
      g.arc(X(x), Y(z), 0.3 * PX, 0, Math.PI * 2)
      g.fill()
    }
    rect(-PITCH_HL, -PITCH_HW, PITCH_HL, PITCH_HW)
    g.beginPath()
    g.moveTo(X(0), Y(-PITCH_HW))
    g.lineTo(X(0), Y(PITCH_HW))
    g.stroke()
    circle(0, 0, 9.15)
    spot(0, 0)
    for (const s of [-1, 1]) {
      const gl = s * PITCH_HL
      rect(Math.min(gl, gl - s * 16.5), -20.16, Math.max(gl, gl - s * 16.5), 20.16)
      rect(Math.min(gl, gl - s * 5.5), -9.16, Math.max(gl, gl - s * 5.5), 9.16)
      spot(gl - s * 11, 0)
      // Teilkreis vor dem Strafraum
      const ang = Math.acos(5.5 / 9.15)
      circle(gl - s * 11, 0, 9.15, s > 0 ? Math.PI - ang : -ang, s > 0 ? Math.PI + ang : ang)
    }
    // Eckviertelkreise: ganze Kreise, auf das Spielfeld beschnitten
    g.save()
    g.beginPath()
    g.rect(X(-PITCH_HL), Y(-PITCH_HW), 2 * PITCH_HL * PX, 2 * PITCH_HW * PX)
    g.clip()
    for (const x of [-PITCH_HL, PITCH_HL]) for (const z of [-PITCH_HW, PITCH_HW]) circle(x, z, 1)
    g.restore()
  }, false)
}

/** Vorplatz: Gehwegplatten, 4 m Kachel */
export function plazaTexture() {
  return canvasTexture('plaza', 64, 64, (g) => {
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, 64, 64)
    g.fillStyle = '#e9e9e9'
    for (let k = 0; k < 64; k += 16) {
      g.fillRect(k, 0, 1, 64)
      g.fillRect(0, k, 64, 1)
    }
  })
}
