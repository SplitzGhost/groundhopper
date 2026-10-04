// Bereitet das Hopper-Bild aus inspiration/hopper/ für die App auf:
// zuschneiden, verkleinern, in Bereiche zerlegen (Haut, Haare, Shirt, Hose, Stutzen, Schuhe, Mund, Augen)
// und die Augen entfernen (die zeichnet die App je nach gewählter Augenform neu).
//
// Ausgabe:
//   src/assets/hopper/base.png    – Bild ohne Augen
//   src/assets/hopper/labels.png  – Bereich je Pixel im Rotkanal (siehe REGION)
//   src/data/hopperBase.json      – Größe, Augenpositionen, Lage von Shirt und Brust
// Aufruf: node tools/hopper-base.ts [Quelle.png] [--debug]

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { PNG } from 'pngjs'

const SRC_DIR = new URL('../inspiration/hopper/', import.meta.url)
const srcName = process.argv.find((a) => a.endsWith('.png')) ?? readdirSync(SRC_DIR).find((f) => f.endsWith('.png'))!
const DEBUG = process.argv.includes('--debug')

/** Bereichsnummern – identisch in src/lib/hopper/paint.ts */
const REGION = { none: 0, skin: 1, hair: 2, shirt: 3, collar: 4, cuff: 5, shorts: 6, socks: 7, shoes: 8, mouth: 9, eye: 10, sleeve: 11 } as const
type Region = (typeof REGION)[keyof typeof REGION]

const src = PNG.sync.read(readFileSync(new URL(srcName, SRC_DIR)))
const W0 = src.width
const H0 = src.height

// ---------- Zuschnitt auf die Figur ----------

let minX = W0, minY = H0, maxX = 0, maxY = 0
for (let y = 0; y < H0; y++) for (let x = 0; x < W0; x++) {
  if (src.data[(y * W0 + x) * 4 + 3] > 100) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
}
const PAD = 6
minX = Math.max(0, minX - PAD); minY = Math.max(0, minY - PAD)
maxX = Math.min(W0 - 1, maxX + PAD); maxY = Math.min(H0 - 1, maxY + PAD)

// ---------- Verkleinern (Flächenmittel, vormultipliziertes Alpha) ----------

const SCALE = 0.68
const W = Math.round((maxX - minX + 1) * SCALE)
const H = Math.round((maxY - minY + 1) * SCALE)
const img = new Float32Array(W * H * 4)
const SUB = 3
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  let r = 0, g = 0, b = 0, a = 0
  for (let sy = 0; sy < SUB; sy++) for (let sx = 0; sx < SUB; sx++) {
    const fx = Math.min(W0 - 1, Math.floor(minX + (x + (sx + 0.5) / SUB) / SCALE))
    const fy = Math.min(H0 - 1, Math.floor(minY + (y + (sy + 0.5) / SUB) / SCALE))
    const i = (fy * W0 + fx) * 4
    const al = src.data[i + 3] / 255
    r += src.data[i] * al; g += src.data[i + 1] * al; b += src.data[i + 2] * al; a += al
  }
  const o = (y * W + x) * 4
  const n = SUB * SUB
  img[o + 3] = a / n
  if (a > 0) { img[o] = r / a; img[o + 1] = g / a; img[o + 2] = b / a }
}

const idx = (x: number, y: number) => y * W + x
const px = (x: number, y: number) => {
  const o = idx(x, y) * 4
  return [img[o], img[o + 1], img[o + 2], img[o + 3]] as const
}

// Fransen der Freistellung (gelbe/rote Säume am Rand) entfernen: Randpixel mit untypischer Farbe ausblenden
for (let pass = 0; pass < 2; pass++) {
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const o = idx(x, y) * 4
    if (img[o + 3] < 0.05) continue
    let edge = false
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (img[(idx(x + dx, y + dy)) * 4 + 3] < 0.05) edge = true
    if (!edge) continue
    const [r, g, b] = px(x, y)
    const sat = (Math.max(r, g, b) - Math.min(r, g, b)) / Math.max(1, Math.max(r, g, b))
    const yellowRed = sat > 0.55 && r > 150
    if (yellowRed) img[o + 3] = 0
    else img[o + 3] *= 0.75
  }
}

// ---------- Bereiche ----------

const labels = new Uint8Array(W * H)
const hsv = (r: number, g: number, b: number) => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
  return { v: mx / 255, s: mx ? (mx - mn) / mx : 0 }
}

// Grobe Höhen (relativ) – Kopf oben, Beine unten; aus dem Bild abgelesen
const yr = (y: number) => y / H
/** Unterhalb davon gibt es kein Haar (Schatten an Kinn, Ohr und Hals sind Haut) */
const HAIR_MAX = 0.31

for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const [r, g, b, a] = px(x, y)
  if (a < 0.08) continue
  const { v, s } = hsv(r, g, b)
  let L: Region
  if (s < 0.16 && v > 0.45) {
    // weiß/grau: Kleidung (oder Zähne im Mund – später korrigiert)
    const t = yr(y)
    L = t < 0.665 ? REGION.shirt : t < 0.805 ? REGION.shorts : t < 0.907 ? REGION.socks : REGION.shoes
  } else if (v < 0.3) {
    L = REGION.eye // schwarz: Augen bzw. Mundlinie
  } else {
    // Haut oder Haar: Haar ist brauner (weniger Blau im Verhältnis zu Rot) und dunkler
    // Haut: B/R um 0.52; Haar meist um 0.40 (Glanzstellen höher – die räumt die Nachbearbeitung auf)
    const br = b / Math.max(1, r)
    // Oben am Kopf (über den Ohren) sind auch gelbliche Glanzlichter Haar: Haut hat G/R um 0.70
    const gr = g / Math.max(1, r)
    const top = yr(y) < 0.28
    L = yr(y) < HAIR_MAX && (br < (top ? 0.475 : 0.465) || (top && gr > 0.735)) ? REGION.hair : REGION.skin
  }
  labels[idx(x, y)] = L
}

// Haar/Haut aufräumen (nur im Kopfbereich): kleine Haarinseln im Gesicht → Haut,
// kleine Hautinseln zwischen den Strähnen (Glanzlichter) → Haar, dann glätten
function cleanHair() {
  const head = (i: number) => (i / W | 0) < H * HAIR_MAX
  for (const c of components((i) => labels[i] === REGION.hair)) if (c.length < 260) for (const i of c) labels[i] = REGION.skin
  // Haut im Kopfbereich, die nicht zum Gesicht (samt Ohren) gehört, ist ein Glanzlicht im Haar
  const skinParts = components((i) => labels[i] === REGION.skin)
  const face = skinParts.find((c) => c.some((i) => head(i)))
  const faceSet = new Set(face)
  for (const c of skinParts) if (c !== face) for (const i of c) if (head(i)) labels[i] = REGION.hair
  for (const c of components((i) => labels[i] === REGION.skin && head(i))) if (c.length < 1400) for (const i of c) labels[i] = REGION.hair
  // Gesichtspixel, die nur über einen dünnen Saum am Haar hängen: Hautpixel im Kopf, die überwiegend von Haar umgeben sind
  for (let pass = 0; pass < 3; pass++) for (let y = 2; y < H * HAIR_MAX; y++) for (let x = 2; x < W - 2; x++) {
    const i = idx(x, y)
    if (labels[i] !== REGION.skin || !faceSet.has(i)) continue
    let hair = 0, bg = 0
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const j = idx(Math.min(W - 1, Math.max(0, x + dx)), Math.min(H - 1, Math.max(0, y + dy)))
      if (labels[j] === REGION.hair) hair++
      else if (img[j * 4 + 3] < 0.08) bg++
    }
    if (hair + bg > 50) labels[i] = REGION.hair
  }
  for (let pass = 0; pass < 2; pass++) {
    const next = labels.slice()
    for (let y = 2; y < H * HAIR_MAX; y++) for (let x = 2; x < W - 2; x++) {
      const i = idx(x, y)
      if (labels[i] !== REGION.hair && labels[i] !== REGION.skin) continue
      let hair = 0, n = 0
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const l = labels[idx(x + dx, y + dy)]
        if (l === REGION.hair) hair++
        if (l === REGION.hair || l === REGION.skin) n++
      }
      if (n) next[i] = hair / n > 0.5 ? REGION.hair : REGION.skin
    }
    labels.set(next)
  }
  // Heller Saum um die Frisur (Kantenglättung der Freistellung) gehört zum Haar
  for (let y = 1; y < H * 0.27; y++) for (let x = 1; x < W - 1; x++) {
    const i = idx(x, y)
    if (labels[i] === REGION.skin && neighbors(i, 5, (j) => img[j * 4 + 3] < 0.08)) labels[i] = REGION.hair
  }
}

// Augen: die beiden größten schwarzen Flächen im Gesicht; kleine schwarze Reste → Mund
function components(pred: (i: number) => boolean) {
  const seen = new Uint8Array(W * H)
  const out: number[][] = []
  for (let i = 0; i < W * H; i++) {
    if (seen[i] || !pred(i)) continue
    const comp: number[] = []
    const stack = [i]
    seen[i] = 1
    while (stack.length) {
      const j = stack.pop()!
      comp.push(j)
      const x = j % W, y = (j / W) | 0
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
        const k = idx(nx, ny)
        if (!seen[k] && pred(k)) { seen[k] = 1; stack.push(k) }
      }
    }
    out.push(comp)
  }
  return out.sort((a, b) => b.length - a.length)
}
cleanHair()
const dark = components((i) => labels[i] === REGION.eye)
const eyes = dark.slice(0, 2).map((c) => {
  const xs = c.map((i) => i % W), ys = c.map((i) => (i / W) | 0)
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2, w: Math.max(...xs) - Math.min(...xs) + 1, h: Math.max(...ys) - Math.min(...ys) + 1, px: c }
}).sort((a, b) => a.x - b.x)
for (const c of dark.slice(2)) for (const i of c) labels[i] = REGION.mouth

// Ohren: Ohrmuscheln sind schattig und sehen haarähnlich aus – seitlich unterhalb der Frisur ist alles Haut
{
  const cx = (eyes[0].x + eyes[1].x) / 2
  const reach = (eyes[1].x - eyes[0].x) * 0.95
  for (let y = Math.floor(H * 0.27); y < H * HAIR_MAX; y++) for (let x = 0; x < W; x++) {
    const i = idx(x, y)
    if (labels[i] === REGION.hair && Math.abs(x - cx) > reach) labels[i] = REGION.skin
  }
}

// Mund: dunkle Linie + graue Zähne zwischen den Augen unterhalb
const mouthTop = Math.max(...eyes.map((e) => e.y + e.h / 2))
const faceL = eyes[0].x - eyes[0].w, faceR = eyes[1].x + eyes[1].w
for (let y = Math.round(mouthTop); y < Math.round(mouthTop + eyes[0].h * 1.4); y++) for (let x = Math.round(faceL); x < faceR; x++) {
  const i = idx(x, y)
  if (labels[i] === REGION.shirt) labels[i] = REGION.mouth
}

// Augen entfernen: Augenpixel (+ 2 px Rand) mit Hautfarbe aus der Umgebung füllen
for (const e of eyes) {
  // Zeilenweise: Farbe links und rechts neben dem Auge (gemittelt über ein paar Pixel) linear verbinden
  const rx = e.w / 2 + 8, ry = e.h / 2 + 8
  const sample = (x: number, y: number) => {
    const acc = [0, 0, 0]
    let n = 0
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const i = idx(Math.round(x + dx), Math.round(y + dy))
      if (labels[i] !== REGION.skin) continue
      for (let k = 0; k < 3; k++) acc[k] += img[i * 4 + k]
      n++
    }
    return n ? acc.map((v) => v / n) : null
  }
  for (let y = Math.round(e.y - ry); y <= e.y + ry; y++) {
    const half = rx * Math.sqrt(Math.max(0, 1 - ((y - e.y) / ry) ** 2))
    if (half < 1) continue
    const xl = e.x - half - 3, xr = e.x + half + 3
    const cl = sample(xl, y), cr = sample(xr, y)
    if (!cl || !cr) continue
    for (let x = Math.round(e.x - half); x <= e.x + half; x++) {
      const i = idx(x, y)
      if (labels[i] === REGION.hair) continue
      const t = (x - xl) / (xr - xl)
      const d = Math.abs(x - e.x) / half
      const blend = d > 0.8 ? (1 - d) / 0.2 : 1
      const o = i * 4
      for (let k = 0; k < 3; k++) img[o + k] = img[o + k] * (1 - blend) + (cl[k] * (1 - t) + cr[k] * t) * blend
      labels[i] = REGION.skin
    }
  }
}

// Shirt-Umriss: Kragen (V-Ausschnitt) und Ärmelsaum
const shirtPx: number[] = []
for (let i = 0; i < W * H; i++) if (labels[i] === REGION.shirt) shirtPx.push(i)
const sxs = shirtPx.map((i) => i % W), sys = shirtPx.map((i) => (i / W) | 0)
const shirt = { x0: Math.min(...sxs), x1: Math.max(...sxs), y0: Math.min(...sys), y1: Math.max(...sys) }
function neighbors(i: number, r: number, test: (j: number) => boolean) {
  const x = i % W, y = (i / W) | 0
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const nx = x + dx, ny = y + dy
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
    if (test(idx(nx, ny))) return true
  }
  return false
}
const shirtH = shirt.y1 - shirt.y0
const midX = (shirt.x0 + shirt.x1) / 2
// Rumpfbreite unten am Shirt (dort gibt es keine Ärmel) – alles außerhalb davon ist Ärmel
const lowRows = shirtPx.filter((i) => (i / W | 0) > shirt.y0 + shirtH * 0.8)
const torso = { x0: Math.min(...lowRows.map((i) => i % W)), x1: Math.max(...lowRows.map((i) => i % W)) }
for (const i of shirtPx) {
  const x = i % W, y = (i / W) | 0
  const t = (y - shirt.y0) / shirtH
  // Kragen: Shirt nahe der Haut am Hals (oberes Viertel, mittig)
  if (t < 0.3 && Math.abs(x - midX) < shirtH * 0.28 && neighbors(i, 6, (j) => labels[j] === REGION.skin)) labels[i] = REGION.collar
  // Ärmelsaum: Shirt nahe der Haut der Arme (seitlich, mittlere Höhe)
  else if (t > 0.25 && t < 0.75 && Math.abs(x - midX) > (shirt.x1 - shirt.x0) * 0.3 && neighbors(i, 7, (j) => labels[j] === REGION.skin)) labels[i] = REGION.cuff
  else if (x < torso.x0 - 1 || x > torso.x1 + 1) labels[i] = REGION.sleeve
}

// ---------- Ausgabe ----------

const OUT = new URL('../src/assets/hopper/', import.meta.url)
mkdirSync(OUT, { recursive: true })
const base = new PNG({ width: W, height: H })
const lab = new PNG({ width: W, height: H })
for (let i = 0; i < W * H; i++) {
  const o = i * 4
  base.data[o] = Math.round(img[o]); base.data[o + 1] = Math.round(img[o + 1]); base.data[o + 2] = Math.round(img[o + 2])
  base.data[o + 3] = Math.round(img[o + 3] * 255)
  lab.data[o] = labels[i]; lab.data[o + 1] = 0; lab.data[o + 2] = 0; lab.data[o + 3] = 255
}
writeFileSync(new URL('base.png', OUT), PNG.sync.write(base))
writeFileSync(new URL('labels.png', OUT), PNG.sync.write(lab))

// Bezugshelligkeit je Bereich (Median) – die App rechnet Schattierungen relativ dazu
const lum = (o: number) => 0.299 * img[o] + 0.587 * img[o + 1] + 0.114 * img[o + 2]
const ref: Record<string, number> = {}
for (const [name, id] of Object.entries(REGION)) {
  const ls: number[] = []
  for (let i = 0; i < W * H; i++) if (labels[i] === id && img[i * 4 + 3] > 0.5) ls.push(lum(i * 4))
  ls.sort((a, b) => a - b)
  if (ls.length) ref[name] = Math.round(ls[Math.floor(ls.length * 0.6)])
}

const meta = {
  width: W,
  height: H,
  eyes: eyes.map((e) => ({ x: Math.round(e.x * 10) / 10, y: Math.round(e.y * 10) / 10, w: e.w, h: e.h })),
  shirt,
  torso,
  ref,
}
writeFileSync(new URL('../src/data/hopperBase.json', import.meta.url), JSON.stringify(meta, null, 2) + '\n')
console.log(meta)

if (DEBUG) {
  const COLORS: Record<number, [number, number, number]> = {
    0: [240, 240, 240], 1: [230, 170, 130], 2: [120, 70, 30], 3: [60, 120, 255], 4: [255, 200, 0], 5: [0, 200, 120],
    6: [200, 40, 40], 7: [160, 0, 200], 8: [40, 40, 40], 9: [255, 0, 150], 10: [0, 0, 0], 11: [120, 180, 255],
  }
  const dbg = new PNG({ width: W * 2, height: H })
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = idx(x, y)
    const c = COLORS[labels[i]]
    const a = img[i * 4 + 3]
    const o1 = (y * W * 2 + x) * 4
    const o2 = (y * W * 2 + x + W) * 4
    for (let k = 0; k < 3; k++) {
      dbg.data[o1 + k] = labels[i] ? c[k] : 240
      dbg.data[o2 + k] = img[i * 4 + k] * a + 240 * (1 - a)
    }
    dbg.data[o1 + 3] = 255
    dbg.data[o2 + 3] = 255
  }
  writeFileSync(process.env.TEMP + '/hopper-labels.png', PNG.sync.write(dbg))
}
