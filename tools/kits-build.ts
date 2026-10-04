// Macht aus den Wikipedia-Rohdaten (.cache/kits/, siehe tools/kits.ts) die Hopper-Trikots in src/data/kits.json.
//
// Für jedes Trikot wird das Wikipedia-Bild nachgebaut (Grundfarbe + Musterbild darüber) und dann vermessen:
// häufigste Farben, Streifen/Ringel (Farbwechsel pro Zeile/Spalte), Hälften, Schärpe, Brustring, Kragen, Ärmel.
// Daraus entsteht eine einfache Beschreibung (KitSpec), die zum Comic-Stil des Hoppers passt.
// Korrekturen von Hand stehen in tools/kits-fix.json und gewinnen immer.
//
// Zusätzlich entsteht .cache/kits/review.json für die Prüfansicht (http://localhost:5173/#hopper/review).
// Aufruf: node tools/kits-build.ts

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { PNG } from 'pngjs'
import type { KitPattern, KitSpec } from '../src/shared/kits.ts'

const DIR = new URL('../.cache/kits/', import.meta.url)
const IMG = new URL('img/', DIR)

interface RawKit { club: string; season: number; ts: string; params: Record<string, string> }
const raw = JSON.parse(readFileSync(new URL('raw.json', DIR), 'utf8')) as Record<string, RawKit>
const fixFile = new URL('kits-fix.json', import.meta.url)
const fixes: Record<string, KitSpec | null> = existsSync(fixFile) ? JSON.parse(readFileSync(fixFile, 'utf8')) : {}

type RGB = [number, number, number]

const hex = (c: RGB) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
const parseHex = (s: string | undefined, fallback: RGB): RGB => {
  const m = (s ?? '').trim().replace(/^#/, '').match(/^([0-9a-f]{6})$/i)
  if (!m) return fallback
  const n = parseInt(m[1], 16)
  return [n >> 16, (n >> 8) & 255, n & 255]
}
const dist = (a: RGB, b: RGB) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

function loadPng(name: string): PNG | null {
  const file = new URL(name.replace(/[^\w.-]/g, '_'), IMG)
  if (!existsSync(file)) return null
  try {
    return PNG.sync.read(readFileSync(file))
  } catch {
    return null
  }
}

/** Wikipedia-Bild nachbauen: Grundfarbe, darüber das Musterbild mit Transparenz */
function composite(base: RGB, pattern: PNG | null, w: number, h: number): RGB[][] {
  const out: RGB[][] = []
  for (let y = 0; y < h; y++) {
    const row: RGB[] = []
    for (let x = 0; x < w; x++) {
      if (!pattern || x >= pattern.width || y >= pattern.height) {
        row.push([...base])
        continue
      }
      const i = (y * pattern.width + x) * 4
      const a = pattern.data[i + 3] / 255
      row.push([0, 1, 2].map((k) => pattern.data[i + k] * a + base[k] * (1 - a)) as RGB)
    }
    out.push(row)
  }
  return out
}

// ---------- Farben zählen ----------

interface Cluster { c: RGB; n: number }

/** Farben grob zusammenfassen (Schattierungen im Musterbild zählen zur selben Farbe) */
function clusters(px: RGB[], tol = 46): Cluster[] {
  const out: Cluster[] = []
  for (const p of px) {
    const hit = out.find((c) => dist(c.c, p) < tol)
    if (hit) {
      // laufender Mittelwert, aber zur häufigsten Farbe hin
      hit.c = hit.c.map((v, k) => v + (p[k] - v) / (hit.n + 1)) as RGB
      hit.n++
    } else out.push({ c: [...p], n: 1 })
  }
  return out.sort((a, b) => b.n - a.n)
}

// ---------- Muster erkennen ----------

/** Bereich der Vorderseite im 38×59-Körperbild (ohne Kragen und Saum) */
const X0 = 3
const X1 = 35
const Y0 = 13
const Y1 = 55

function runs(line: boolean[]): { start: number; len: number }[] {
  const out: { start: number; len: number }[] = []
  let start = -1
  line.forEach((v, i) => {
    if (v && start < 0) start = i
    if (!v && start >= 0) {
      out.push({ start, len: i - start })
      start = -1
    }
  })
  if (start >= 0) out.push({ start, len: line.length - start })
  return out
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

function detect(body: RGB[][]): { base: RGB; second: RGB | null; pattern: KitPattern | undefined; share: number } {
  const px: RGB[] = []
  for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) px.push(body[y][x])
  const cl = clusters(px)
  const total = px.length
  const base = cl[0].c
  const second = cl[1] && cl[1].n / total > 0.05 ? cl[1].c : null
  if (!second) return { base, second: null, pattern: undefined, share: 0 }

  // Maske: näher an der Zweitfarbe als an der Grundfarbe
  const M: boolean[][] = []
  for (let y = Y0; y < Y1; y++) {
    const row: boolean[] = []
    for (let x = X0; x < X1; x++) row.push(dist(body[y][x], second) < dist(body[y][x], base))
    M.push(row)
  }
  const H = M.length
  const W = M[0].length
  const share = M.flat().filter(Boolean).length / (W * H)
  const rowRuns = M.map((r) => runs(r))
  const cols = Array.from({ length: W }, (_, x) => M.map((r) => r[x]))
  const colRuns = cols.map((c) => runs(c))
  const hRuns = avg(rowRuns.map((r) => r.length))
  const vRuns = avg(colRuns.map((r) => r.length))
  const c = hex(second)
  if (DEBUG) {
    console.log('cluster', cl.slice(0, 4).map((x) => hex(x.c) + ':' + x.n), 'hRuns', hRuns.toFixed(2), 'vRuns', vRuns.toFixed(2), 'share', share.toFixed(2))
    for (const r of M) console.log(r.map((v) => (v ? '#' : '.')).join(''))
  }

  const left = avg(M.map((r) => avg(r.slice(0, W / 2 - 2).map(Number))))
  const right = avg(M.map((r) => avg(r.slice(W / 2 + 2).map(Number))))
  const topShare = avg(M.slice(0, 10).flat().map(Number))
  const restShare = avg(M.slice(14).flat().map(Number))

  // Zweitfarbe nur eine Schattierung der Grundfarbe (Struktur, Glanz) → dezentes Muster oder schlicht
  if (dist(base, second) < 95) {
    return { base, second: null, share, pattern: share > 0.2 && dist(base, second) > 60 ? { k: 'tonal', c } : undefined }
  }

  // Typische Zeile/Spalte: Median der Lauf-Anzahl, nur breite Läufe (Schattierungen zählen nicht)
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0
  const rowCount = median(rowRuns.map((r) => r.filter((x) => x.len >= 2).length))
  const colCount = median(colRuns.map((r) => r.filter((x) => x.len >= 2).length))
  const rowWidth = avg(rowRuns.flat().map((r) => r.len))
  const colWidth = avg(colRuns.flat().map((r) => r.len))

  // Senkrechte Streifen: viele Wechsel je Zeile, deutlich weniger je Spalte
  if (hRuns >= 2.3 && hRuns > vRuns * 1.25) {
    if (rowWidth <= 1.8 && share < 0.3) return { base, second, share, pattern: { k: 'pinstripes', c } }
    const n = Math.min(5, Math.max(2, rowCount))
    const w = Math.min(0.7, Math.max(0.3, rowWidth / (W / Math.max(1, rowCount))))
    return { base, second, share, pattern: { k: 'stripes', c, n, w: Math.round(w * 20) / 20 } }
  }
  // Ringel
  if (vRuns >= 2.3 && vRuns > hRuns * 1.25) {
    if (colWidth <= 1.8 && share < 0.3) return { base, second, share, pattern: { k: 'tonal', c } }
    const n = Math.min(6, Math.max(2, colCount))
    return { base, second, share, pattern: { k: 'hoops', c, n, w: 0.5 } }
  }
  // Hälften
  if (Math.abs(left - right) > 0.7) {
    return right > left
      ? { base, second, share, pattern: { k: 'halves', c } }
      : { base: second, second: base, share, pattern: { k: 'halves', c: hex(base) } }
  }
  // Schulterpartie
  if (topShare > 0.7 && restShare < 0.15) return { base, second, share, pattern: { k: 'yoke', c } }
  // Ein Lauf je Zeile, der wandert → Schärpe; der fest in der Mitte steht → Mittelstreifen
  const single = rowRuns.filter((r) => r.length === 1)
  if (single.length > H * 0.6) {
    const centers = rowRuns.map((r, y) => (r.length === 1 ? [y, r[0].start + r[0].len / 2] : null)).filter((x): x is number[] => !!x)
    const n = centers.length
    const my = avg(centers.map((p) => p[0]))
    const mx = avg(centers.map((p) => p[1]))
    const slope = centers.reduce((s, p) => s + (p[0] - my) * (p[1] - mx), 0) / Math.max(1, centers.reduce((s, p) => s + (p[0] - my) ** 2, 0))
    const width = avg(rowRuns.filter((r) => r.length === 1).map((r) => r[0].len)) / W
    if (Math.abs(slope) > 0.25 && n > H * 0.6) {
      return { base, second, share, pattern: { k: 'sash', c, dir: slope > 0 ? 'r' : 'l', w: Math.round(Math.min(0.35, Math.max(0.12, width)) * 20) / 20 } }
    }
    if (Math.abs(mx - W / 2) < 3 && width < 0.5) return { base, second, share, pattern: { k: 'vstripe', c, w: Math.round(width * 20) / 20 } }
  }
  // Brustring: zusammenhängende Zeilen voll in Zweitfarbe
  const full = M.map((r) => avg(r.map(Number)) > 0.75)
  const bandRows = full.map((f, i) => (f ? i : -1)).filter((i) => i >= 0)
  if (bandRows.length >= 3 && bandRows.length < H * 0.5 && bandRows.at(-1)! - bandRows[0] < bandRows.length + 2) {
    const yMid = 1 - ((bandRows[0] + bandRows.at(-1)!) / 2 + Y0) / 59
    return { base, second, share, pattern: { k: 'band', c, y: Math.round(yMid * 20) / 20, h: Math.round((bandRows.length / 59) * 20) / 20 } }
  }
  // Größere Flächen ohne klare Form → dezentes Grafikmuster; kleine Details (Seitenstreifen) weglassen
  if (share > 0.12) return { base, second, share, pattern: { k: 'tonal', c } }
  return { base, second, share, pattern: undefined }
}

/**
 * Kragen: Im Körperbild ist oben ein weißer Rand (Zeilen 0–4) und darunter das weiße Halsloch.
 * Das Loch wird von der Mitte aus gefüllt; seine Tiefe verrät den V-Ausschnitt, der Rand darum die Kragenfarbe.
 */
function collarOf(body: RGB[][], base: RGB): { c: string | null; v: boolean } {
  const white: RGB = [255, 255, 255]
  const hole = new Set<string>()
  const stack: [number, number][] = [[19, 5], [18, 5]]
  while (stack.length) {
    const [x, y] = stack.pop()!
    const key = x + ',' + y
    if (hole.has(key) || x < 8 || x > 29 || y < 5 || y > 22) continue
    if (dist(body[y][x], white) > 40 || dist(base, white) < 40) continue
    hole.add(key)
    stack.push([x + 1, y], [x - 1, y], [x, y + 1])
  }
  const depth = Math.max(0, ...[...hole].map((k) => Number(k.split(',')[1]) - 5))
  const ring: RGB[] = []
  for (let y = 5; y < 24; y++) for (let x = 6; x < 32; x++) {
    if (hole.has(x + ',' + y)) continue
    let near = false
    for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2 && !near; dx++) near = hole.has(x + dx + ',' + (y + dy))
    if (near) ring.push(body[y][x])
  }
  // Umrisslinien (fast schwarz) nur zählen, wenn das Trikot selbst dunkel ist
  const dark = (c: RGB) => c[0] + c[1] + c[2] < 90
  const cl = clusters(ring, 40).filter((c) => !dark(c.c) || dark(base))
  const top = cl.find((c) => dist(c.c, base) > 70 && c.n >= Math.max(4, ring.length * 0.18))
  return { c: top ? hex(top.c) : null, v: depth >= 5 }
}

/**
 * Ärmel: Im 31×59-Bild ist der Ärmel ein Dreieck rechts oben (Schulter rechts, Bündchen an der schrägen
 * Kante links unten). Hauptfarbe nahe der Schulter, Bündchen an der schrägen Kante.
 */
function sleeveOf(arm: RGB[][] | null): { s: string | null; cu: string | null } {
  if (!arm) return { s: null, cu: null }
  const px: RGB[] = []
  for (let y = 10; y < 22; y++) for (let x = 24; x < 30; x++) px.push(arm[y][x])
  const main = clusters(px)[0].c
  // Bündchen: die ersten Pixel rechts der unteren schrägen Kante (x ≈ y − 11)
  const cuffPx: RGB[] = []
  for (let y = 25; y < 33; y++) for (let x = 0; x < 31; x++) {
    const e = x - y + 11
    if (e >= 1 && e <= 4) cuffPx.push(arm[y][x])
  }
  const cuff = cuffPx.length ? clusters(cuffPx)[0].c : main
  return { s: hex(main), cu: dist(cuff, main) > 60 ? hex(cuff) : null }
}

// ---------- Alles zusammen ----------

const DEBUG = process.argv[2] ?? null
const out: Record<string, Record<string, KitSpec>> = {}
const review: { id: string; label: string; base: string; body: string | null; arm: string | null; spec: KitSpec; fixed: boolean; share: number }[] = []
const stats: Record<string, number> = {}

for (const [id, k] of Object.entries(raw).sort(([a], [b]) => a.localeCompare(b))) {
  if (DEBUG && id !== DEBUG) continue
  const p = k.params
  if (!p.pattern_b1 && !p.body1) continue
  const bodyBase = parseHex(p.body1, [255, 255, 255])
  const armBase = parseHex(p.leftarm1, bodyBase)
  const bodyPng = p.pattern_b1 ? loadPng(`Kit_body${p.pattern_b1}.png`) : null
  const armPng = p.pattern_la1 ? loadPng(`Kit_left_arm${p.pattern_la1}.png`) : null
  if (p.pattern_b1 && !bodyPng && !p.body1) continue
  const body = composite(bodyBase, bodyPng, 38, 59)
  const arm = composite(armBase, armPng, 31, 59)

  const d = detect(body)
  const collar = collarOf(body, d.base)
  const sleeve = sleeveOf(arm)
  const spec: KitSpec = { b: hex(d.base) }
  if (d.pattern) spec.p = d.pattern
  if (sleeve.s && dist(parseHex(sleeve.s, d.base), d.base) > 40) spec.s = sleeve.s
  spec.c = collar.c ?? (d.second ? hex(d.second) : undefined)
  if (!spec.c) delete spec.c
  spec.cs = collar.v ? 'v' : 'crew'
  if (sleeve.cu) spec.cu = sleeve.cu
  // Hose und Stutzen: Farben aus der Infobox (Muster dort ignorieren); ohne Angabe wie das Trikot
  const shorts = p.shorts1 ? hex(parseHex(p.shorts1, d.base)) : null
  const socks = p.socks1 ? hex(parseHex(p.socks1, d.base)) : null
  // Ähnliche Farben angleichen (Wikipedia nutzt oft grelle Standardwerte wie #FF0000)
  const near = (c: string | null, to: string) => (c && dist(parseHex(c, d.base), parseHex(to, d.base)) < 90 ? to : c)
  const palette = [hex(d.base), spec.s, spec.c, d.second ? hex(d.second) : null].filter((c): c is string => !!c)
  const snap = (c: string | null) => palette.reduce<string | null>((acc, to) => (acc === c ? near(c, to) : acc), c)
  spec.sh = snap(shorts) ?? hex(d.base)
  spec.so = snap(socks) ?? spec.sh

  const fixed = id in fixes
  // Korrekturen betreffen nur das Trikot – Hose und Stutzen kommen weiter aus den Rohdaten
  const final = fixed ? (fixes[id] ? { sh: spec.sh, so: spec.so, ...fixes[id] } : null) : spec
  if (fixed && final) {
    // an die Farben der Korrektur angleichen
    const pal = [final.b, final.s, final.c, final.p?.c].filter((c): c is string => !!c)
    const to = (c: string | undefined) => (c ? pal.find((q) => dist(parseHex(q, d.base), parseHex(c, d.base)) < 90) ?? c : c)
    final.sh = to(final.sh)
    final.so = to(final.so)
  }
  stats[final?.p?.k ?? 'plain'] = (stats[final?.p?.k ?? 'plain'] ?? 0) + 1
  if (final) (out[k.club] ??= {})[k.season] = final
  review.push({
    id, label: `${k.club} ${k.season}/${String((k.season + 1) % 100).padStart(2, '0')}`, base: hex(bodyBase),
    body: bodyPng ? `Kit_body${p.pattern_b1}.png` : null, arm: armPng ? `Kit_left_arm${p.pattern_la1}.png` : null,
    spec: final ?? spec, fixed, share: Math.round(d.share * 100) / 100,
  })
}

if (DEBUG) {
  console.log(JSON.stringify(review[0]?.spec))
  process.exit(0)
}
writeFileSync(new URL('../src/data/kits.json', import.meta.url), JSON.stringify(out))
writeFileSync(new URL('review.json', DIR), JSON.stringify(review))
console.log(`${review.length} Trikots, ${Object.keys(out).length} Vereine`, stats)
