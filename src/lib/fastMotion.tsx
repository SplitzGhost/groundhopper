// Ersatz für `motion` aus motion/react, der Bewegungen an iOS abgibt.
//
// Hintergrund: Im Stromsparmodus drosselt iOS alles, was eine Webseite Bild für Bild selbst berechnet, auf 30 fps.
// Motion rechnet Einzelwerte wie x, y, scale und rotate selbst; nur Deckkraft und eine komplette `transform`-Angabe
// gibt es an den Browser (Web Animations) ab – die spielt iOS dann selbst und flüssig ab, auch im Stromsparmodus.
// Dieser Wrapper übersetzt deshalb x/y/scale/rotate in eine `transform`-Angabe – aber nur bei Elementen, deren
// `animate` selbst eine Lage festlegt (sonst wäre der Ruhezustand „none“, und daraus macht Motion scale(0, 0)).
// Elemente, bei denen das nicht sicher geht (Ziehen, Layout-Animationen, Varianten, Motion-Werte im style …),
// bleiben unverändert. Reine Drück-Effekte (whileTap: { scale }) laufen über die CSS-Eigenschaft `scale`.

import { useState, type PointerEvent } from 'react'
import { motion as base } from 'motion/react'

export * from 'motion/react'

type Target = Record<string, unknown>
type Value = number | string

const CONVERTED = ['x', 'y', 'scale', 'scaleX', 'scaleY', 'rotate'] as const
/** Transform-Einzelwerte, die wir nicht übersetzen – kommt einer davon vor, bleibt das Element wie es ist */
const OTHER_TRANSFORMS = new Set(['z', 'translateX', 'translateY', 'translateZ', 'rotateX', 'rotateY', 'rotateZ',
  'skew', 'skewX', 'skewY', 'transformPerspective', 'transform'])
const TARGET_PROPS = ['initial', 'animate', 'exit', 'whileTap', 'whileHover', 'whileFocus', 'whileInView', 'whileDrag'] as const
/** Diese Props übernehmen selbst die Kontrolle über transform */
const BAIL_PROPS = ['drag', 'layout', 'layoutId', 'transformTemplate', 'variants', 'dragControls', 'onUpdate']
const SVG_TAGS = new Set(['svg', 'g', 'path', 'circle', 'rect', 'line', 'ellipse', 'polygon', 'polyline', 'text'])

const isTarget = (t: unknown): t is Target =>
  !!t && typeof t === 'object' && !Array.isArray(t) && typeof (t as { start?: unknown }).start !== 'function'

const hasConverted = (t: Target) => CONVERTED.some((k) => k in t)

/** Länge → `calc(A% + Bpx)`, damit sich Prozent- und Pixelwerte immer gleich aufgebaut mischen lassen */
function length(v: Value): string | null {
  if (typeof v === 'number') return `calc(0% + ${v}px)`
  const m = /^(-?[\d.]+)(px|%)$/.exec(v.trim())
  if (!m) return v.trim() === '0' ? 'calc(0% + 0px)' : null
  return m[2] === '%' ? `calc(${m[1]}% + 0px)` : `calc(0% + ${m[1]}px)`
}

function angle(v: Value): string | null {
  if (typeof v === 'number') return `${v}deg`
  return /^-?[\d.]+deg$/.test(v.trim()) ? v.trim() : null
}

/**
 * Baut aus den Einzelwerten eine transform-Angabe (bei Keyframes eine Liste).
 * Fehlende Werte kommen aus `fallback`, sonst gilt der Ausgangswert (0 bzw. 1).
 * Gibt null zurück, wenn etwas nicht sicher übersetzbar ist.
 */
function buildTransform(t: Target, fallback?: Target): string | string[] | null {
  const pick = (k: string): unknown => {
    if (k in t) return t[k]
    const v = fallback?.[k]
    // Aus `animate` übernommene Keyframes: nur der Endwert
    return Array.isArray(v) ? v[v.length - 1] : v
  }
  const raw: Record<string, unknown> = {}
  for (const k of CONVERTED) raw[k] = pick(k)

  // Keyframe-Listen: alle gleich lang (einzelne Werte werden wiederholt)
  let frames = 1
  for (const v of Object.values(raw)) {
    if (!Array.isArray(v)) continue
    if (v.length === 0 || v.some((x) => x === null || x === undefined)) return null
    if (frames > 1 && v.length !== frames) return null
    frames = v.length
  }
  const at = (k: string, i: number): Value | undefined => {
    const v = raw[k]
    return (Array.isArray(v) ? v[i] : v) as Value | undefined
  }

  const out: string[] = []
  for (let i = 0; i < frames; i++) {
    const x = length(at('x', i) ?? 0)
    const y = length(at('y', i) ?? 0)
    const s = at('scale', i) ?? 1
    const sx = at('scaleX', i) ?? s
    const sy = at('scaleY', i) ?? s
    const r = angle(at('rotate', i) ?? 0)
    if (x === null || y === null || r === null || typeof sx !== 'number' || typeof sy !== 'number') return null
    out.push(`translate(${x}, ${y}) scale(${sx}, ${sy}) rotate(${r})`)
  }
  return frames === 1 ? out[0] : out
}

/** Übergänge für x/y/scale/rotate gelten danach für transform */
function mapTransition(tr: unknown): unknown {
  if (!isTarget(tr)) return tr
  const key = CONVERTED.find((k) => k in tr)
  if (!key) return tr
  const next: Target = { ...tr }
  next.transform ??= tr[key]
  for (const k of CONVERTED) delete next[k]
  return next
}

function convertTarget(t: Target, fallback?: Target): Target | null {
  if (!hasConverted(t)) return t
  const transform = buildTransform(t, fallback)
  if (transform === null) return null
  const next: Target = { ...t, transform }
  for (const k of CONVERTED) delete next[k]
  if ('transition' in t) next.transition = mapTransition(t.transition)
  if (isTarget(t.transitionEnd) && hasConverted(t.transitionEnd)) {
    const end = convertTarget(t.transitionEnd)
    if (!end) return null
    next.transitionEnd = end
  }
  return next
}

/** Neutrale Transformation – Startwert statt „none“ (daraus würde Motion scale(0, 0) machen) */
const IDENTITY = 'translate(calc(0% + 0px), calc(0% + 0px)) scale(1, 1) rotate(0deg)'

/** Ziehen, Layout-Animationen, Varianten usw. – dann bleibt das Element unverändert */
function blocked(props: Target): boolean {
  if (BAIL_PROPS.some((k) => props[k] !== undefined && props[k] !== false)) return true
  const style = props.style
  if (isTarget(style) && Object.keys(style).some((k) => (CONVERTED as readonly string[]).includes(k) || OTHER_TRANSFORMS.has(k))) return true
  for (const p of TARGET_PROPS) {
    const t = props[p]
    if (t === undefined || t === false) continue
    // Variantennamen, Funktionen oder Steuerungen: lieber nichts anfassen
    if (!isTarget(t)) return true
    if (Object.keys(t).some((k) => OTHER_TRANSFORMS.has(k))) return true
  }
  return false
}

/**
 * Umgestellt wird nur, wenn `animate` selbst x/y/scale/rotate festlegt – dann gibt es einen festen Ruhezustand.
 * Elemente, die nur beim Antippen/Ausblenden skalieren, bleiben wie sie sind: Ihr Ruhezustand wäre „none“.
 */
function convertible(props: Target): boolean {
  return !blocked(props) && isTarget(props.animate) && hasConverted(props.animate)
}

/** Neue Props mit transform statt Einzelwerten */
function convertProps(props: Target): Target {
  if (blocked(props)) return props
  const animate = isTarget(props.animate) ? props.animate : undefined
  const next: Target = { ...props }
  for (const p of TARGET_PROPS) {
    const t = props[p]
    if (!isTarget(t)) continue
    // Fehlende Werte: Ausblenden und Antippen behalten den Stand aus `animate`, der Start beginnt neutral
    const converted = convertTarget(t, p === 'animate' || p === 'initial' ? undefined : animate)
    if (!converted) return props
    next[p] = converted
  }
  // Startzustand immer als vollständige transform-Angabe
  if (props.initial === undefined) next.initial = { transform: IDENTITY }
  else if (isTarget(next.initial) && !('transform' in next.initial)) next.initial = { ...next.initial, transform: IDENTITY }
  if ('transition' in props) next.transition = mapTransition(props.transition)
  return next
}

// ---------- Drück-Effekt ----------
// Buttons, die nur beim Antippen kleiner werden (whileTap: { scale }), animieren die CSS-Eigenschaft `scale`
// per Browser-Animation. Die setzt sich mit transform zusammen, überschreibt also keine anderen Bewegungen
// oder CSS-Übergänge, und läuft wie alle Browser-Animationen auch im Stromsparmodus flüssig.

const pressState = new WeakMap<Element, { anim: Animation; down: boolean }>()

function pressScale(el: Element, to: number, down: boolean) {
  const prev = pressState.get(el)
  if (!down && !prev?.down) return
  // Vom aktuellen Stand aus weiter, falls gerade noch eine Animation läuft
  const from = prev ? getComputedStyle(el).scale : 'none'
  prev?.anim.cancel()
  const anim = el.animate([{ scale: from === 'none' ? '1' : from }, { scale: String(to) }], down
    ? { duration: 110, easing: 'ease-out', fill: 'forwards' }
    : { duration: 420, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', fill: 'forwards' })
  pressState.set(el, { anim, down })
  if (!down) anim.onfinish = () => {
    if (pressState.get(el)?.anim !== anim) return
    anim.cancel()
    pressState.delete(el)
  }
}

type Handler = ((e: PointerEvent<Element>) => void) | undefined

function tapProps(props: Target): Target {
  const tap = props.whileTap
  if (!isTarget(tap) || Object.keys(tap).length !== 1 || typeof tap.scale !== 'number' || props.disabled) return props
  const to = tap.scale
  const chain = (name: string, fn: (e: PointerEvent<Element>) => void) => (e: PointerEvent<Element>) => {
    (props[name] as Handler)?.(e)
    fn(e)
  }
  const release = (e: PointerEvent<Element>) => pressScale(e.currentTarget, 1, false)
  const next: Target = { ...props }
  delete next.whileTap
  next.onPointerDown = chain('onPointerDown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    pressScale(e.currentTarget, to, true)
  })
  next.onPointerUp = chain('onPointerUp', release)
  next.onPointerLeave = chain('onPointerLeave', release)
  next.onPointerCancel = chain('onPointerCancel', release)
  return next
}

type AnyComponent = (props: Target) => unknown
const cache = new Map<string, AnyComponent>()

function wrap(tag: string, Comp: AnyComponent): AnyComponent {
  const C = Comp as unknown as (p: Target) => never
  const Fast = (props: Target) => {
    // Einmal beim ersten Rendern entscheiden: Ein Element darf nicht zwischen transform und x/y/scale wechseln
    const [mode] = useState(() => convertible(props))
    // React 19 reicht `ref` als normale Prop durch
    return <C {...(mode ? convertProps(props) : tapProps(props))} />
  }
  Fast.displayName = `FastMotion.${tag}`
  return Fast
}

export const motion = new Proxy(base, {
  get(target, key, receiver) {
    const value = Reflect.get(target, key, receiver)
    if (typeof key !== 'string' || key === 'create' || SVG_TAGS.has(key) || !/^[a-z][a-z0-9]*$/.test(key)) return value
    let c = cache.get(key)
    if (!c) {
      c = wrap(key, value as AnyComponent)
      cache.set(key, c)
    }
    return c
  },
}) as typeof base
