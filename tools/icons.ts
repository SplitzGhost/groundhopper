// Erzeugt die App-Icons als PNG (iOS braucht für den Home-Bildschirm ein PNG, kein SVG).
// Zeichnet dasselbe Motiv wie public/favicon.svg – ohne Zusatzpakete, nur mit zlib.
// Aufruf: npm run icons

import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

type Seg = [number, number, number, number]

/** Motiv im 512er-Raster: Stadion-Schale als Ellipse, Tribüne, Flutlichtmasten */
function strokes(): Seg[] {
  const segs: Seg[] = []
  const poly = (pts: [number, number][]) => {
    for (let i = 1; i < pts.length; i++) segs.push([pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]])
  }
  const arc = (cx: number, cy: number, rx: number, ry: number, from: number, to: number, n = 160) =>
    Array.from({ length: n + 1 }, (_, i) => {
      const t = from + ((to - from) * i) / n
      return [cx + rx * Math.cos(t), cy + ry * Math.sin(t)] as [number, number]
    })
  poly(arc(256, 226, 150, 58, 0, Math.PI * 2))
  // Unterer Rand der Schale mit senkrechten Seiten
  poly([[106, 226], [106, 312]])
  poly([[406, 226], [406, 312]])
  poly(arc(256, 312, 150, 58, Math.PI, 0).reverse())
  for (const x of [176, 336]) poly([[x, 128], [x, 168]])
  poly([[256, 116], [256, 162]])
  for (const x of [192, 320]) poly([[x, 280], [x, 338]])
  return segs
}

function distToSeg(px: number, py: number, [x1, y1, x2, y2]: Seg): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t)
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

function render(size: number, rounded: boolean): Buffer {
  const s = size / 512
  const segs = strokes()
  const top = [58, 160, 255]
  const mid = [10, 108, 240]
  const bottom = [0, 73, 184]
  const rows: Buffer[] = []
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4)
    for (let x = 0; x < size; x++) {
      const X = (x + 0.5) / s
      const Y = (y + 0.5) / s
      // Verlauf von oben links nach unten, plus heller Schimmer oben rechts
      const g = clamp01((Y * 0.92 + X * 0.08) / 512)
      let c = g < 0.6 ? mix(top, mid, g / 0.6) : mix(mid, bottom, (g - 0.6) / 0.4)
      const glow = clamp01(1 - Math.hypot(X - 410, Y - 51) / 360) * 0.75
      c = mix(c, [159, 224, 255], glow * glow)
      // Weiße Linien mit weicher Kante
      let d = Infinity
      for (const seg of segs) d = Math.min(d, distToSeg(X, Y, seg))
      const line = clamp01((13 - d) * s + 0.5)
      c = mix(c, [255, 255, 255], line)
      // Abgerundete Ecken nur fürs Favicon; iOS rundet selbst ab
      let alpha = 1
      if (rounded) {
        const r = 114
        const qx = Math.max(Math.abs(X - 256) - (256 - r), 0)
        const qy = Math.max(Math.abs(Y - 256) - (256 - r), 0)
        alpha = clamp01((r - Math.hypot(qx, qy)) * s + 0.5)
      }
      row.writeUInt8(Math.round(c[0]), 1 + x * 4)
      row.writeUInt8(Math.round(c[1]), 2 + x * 4)
      row.writeUInt8(Math.round(c[2]), 3 + x * 4)
      row.writeUInt8(Math.round(alpha * 255), 4 + x * 4)
    }
    rows.push(row)
  }
  return png(size, Buffer.concat(rows))
}

// ---------- minimaler PNG-Kodierer ----------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
function png(size: number, raw: Buffer): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr.writeUInt8(8, 8) // Bittiefe
  ihdr.writeUInt8(6, 9) // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const out = (name: string) => new URL(`../public/${name}`, import.meta.url)
writeFileSync(out('apple-touch-icon.png'), render(180, false))
writeFileSync(out('icon-512.png'), render(512, false))
writeFileSync(out('icon-192.png'), render(192, true))
console.log('Icons geschrieben: apple-touch-icon.png, icon-192.png, icon-512.png')
