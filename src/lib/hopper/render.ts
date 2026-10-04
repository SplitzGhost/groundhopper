// Bühne für Hopper: Standbilder (PNG mit transparentem Hintergrund) für Karten, Listen und Profile
// sowie eine drehbare Live-Ansicht für den Editor. Wie bei den Stadien arbeitet ein einziger
// WebGL-Kontext die Standbilder nacheinander ab; fertige Bilder landen im Cache Storage.

import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { buildHopper, type HopperModel } from './model.ts'
import { lookKey, type HopperLook } from './look.ts'
import { kitSpec, loadKits, parseKitId, type KitSpec } from './kit.ts'
import { crestFor } from '../crests.ts'

/** Bei Änderungen am Modell hochzählen – verwirft alte Bilder im Cache */
const VERSION = 1
const FOV = 22

interface Stage {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  model: HopperModel | null
  holder: THREE.Group
}

function createStage(canvas?: HTMLCanvasElement): Stage {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: !canvas })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = 1.08
  renderer.setClearColor(0x000000, 0)

  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environmentIntensity = 0.55
  pmrem.dispose()

  scene.add(new THREE.HemisphereLight('#f4f8ff', '#d9cbb8', 1.1))
  const key = new THREE.DirectionalLight('#fff6ea', 2.4)
  key.position.set(-1.6, 3, 3.2)
  const rim = new THREE.DirectionalLight('#cfe2ff', 1.4)
  rim.position.set(2.4, 2, -2.5)
  scene.add(key, rim)

  const holder = new THREE.Group()
  scene.add(holder)
  const camera = new THREE.PerspectiveCamera(FOV, 3 / 4, 0.1, 50)
  return { renderer, scene, camera, model: null, holder }
}

function setModel(stage: Stage, model: HopperModel) {
  if (stage.model) {
    stage.holder.remove(stage.model.group)
    stage.model.dispose()
  }
  stage.model = model
  stage.holder.add(model.group)
}

export type Framing = 'full' | 'bust'

/** Kamera so stellen, dass die ganze Figur (oder Kopf und Schultern) ins Bild passt */
function frame(camera: THREE.PerspectiveCamera, framing: Framing, pad = 1) {
  const tan = Math.tan(((FOV / 2) * Math.PI) / 180)
  const [cy, half] = framing === 'full' ? [1.05, 1.1 * pad] : [1.4, 0.7]
  const halfH = Math.max(half, (half / camera.aspect) * 0.78)
  const dist = halfH / tan
  // leicht von oben; Blickpunkt etwas höher, damit der Kopf trotz Neigung ganz im Bild ist
  camera.position.set(0, cy + dist * 0.08, dist)
  camera.lookAt(0, cy + 0.03, 0)
  camera.updateProjectionMatrix()
}

// ---------- Wappen ----------

const crestImages = new Map<string, Promise<HTMLImageElement | null>>()

function loadImage(src: string): Promise<HTMLImageElement | null> {
  let p = crestImages.get(src)
  if (!p) {
    p = new Promise((res) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => res(img)
      img.onerror = () => res(null)
      img.src = src
    })
    crestImages.set(src, p)
  }
  return p
}

async function crestOf(kit: string | null): Promise<HTMLImageElement | null> {
  const ref = kit ? parseKitId(kit) : null
  const src = ref ? crestFor(ref.club, 'sm') : null
  return src ? loadImage(src) : null
}

// ---------- Standbilder ----------

export type SnapSize = 'sm' | 'md' | 'lg'
const SIZES: Record<SnapSize, number> = { sm: 160, md: 320, lg: 560 }
const CACHE_NAME = `hopper-art-v${VERSION}`

let snapStage: Stage | null = null
let queue: Promise<unknown> = Promise.resolve()
const memo = new Map<string, Promise<string>>()
let cachePruned = false

async function openCache(): Promise<Cache | null> {
  try {
    if (import.meta.env.DEV || !('caches' in window)) return null
    if (!cachePruned) {
      cachePruned = true
      for (const k of await caches.keys()) if (k.startsWith('hopper-art-') && k !== CACHE_NAME) void caches.delete(k)
    }
    return await caches.open(CACHE_NAME)
  } catch {
    return null
  }
}

const nextFrame = () => new Promise<void>((res) => requestAnimationFrame(() => setTimeout(res, 0)))

export interface SnapOptions {
  framing?: Framing
  size?: SnapSize
  /** Drehung um die Hochachse (rad); positiv = nach rechts schauen */
  turn?: number
  wave?: number
}

async function render(look: HopperLook, kit: KitSpec, crest: HTMLImageElement | null, o: Required<SnapOptions>): Promise<Blob> {
  snapStage ??= createStage()
  const stage = snapStage
  const h = SIZES[o.size]
  const w = o.framing === 'full' ? Math.round(h * 0.75) : h
  stage.renderer.setPixelRatio(1)
  stage.renderer.setSize(w, h, false)
  stage.camera.aspect = w / h
  setModel(stage, buildHopper(look, kit, { crest, wave: o.wave }))
  stage.holder.rotation.y = o.turn
  frame(stage.camera, o.framing)
  stage.renderer.render(stage.scene, stage.camera)
  const blob = await new Promise<Blob | null>((res) => stage.renderer.domElement.toBlob(res, 'image/png'))
  if (!blob) throw new Error('Standbild fehlgeschlagen')
  return blob
}

/** Objekt-URL eines Standbilds (aus Speicher, Cache oder frisch gerendert) */
export function snapshot(look: HopperLook, kit: string | null, opts: SnapOptions = {}): Promise<string> {
  const o: Required<SnapOptions> = { framing: 'full', size: 'md', turn: 0, wave: 0, ...opts }
  const key = `${lookKey(look)}-${kit ?? 'basic'}-${o.framing}-${o.size}-${o.turn.toFixed(2)}-${o.wave}`
  let p = memo.get(key)
  if (p) return p
  p = (async () => {
    const cacheUrl = `/__hopper-art/${encodeURIComponent(key)}.png`
    const cache = await openCache()
    const hit = await cache?.match(cacheUrl).catch(() => undefined)
    if (hit) return URL.createObjectURL(await hit.blob())
    await loadKits()
    const crest = await crestOf(kit)
    const job = queue.then(async () => {
      await nextFrame()
      return render(look, kitSpec(kit), crest, o)
    })
    queue = job.catch(() => undefined)
    const blob = await job
    void cache?.put(cacheUrl, new Response(blob, { headers: { 'Content-Type': 'image/png' } })).catch(() => undefined)
    return URL.createObjectURL(blob)
  })()
  p.catch(() => memo.delete(key))
  memo.set(key, p)
  return p
}

// ---------- Drehbare Ansicht ----------

export class LiveHopper {
  private stage: Stage
  private lost = false
  private framing: Framing
  turn = 0
  /** leichtes Wippen beim Atmen (Phase 0–1) */
  bob = 0
  /** Hüpfer (0 = am Boden, 1 = oben) */
  hop = 0

  constructor(canvas: HTMLCanvasElement, framing: Framing = 'full') {
    this.stage = createStage(canvas)
    this.framing = framing
    canvas.addEventListener('webglcontextlost', () => { this.lost = true })
  }

  /** Aussehen oder Trikot wechseln; lädt bei Bedarf Trikotdaten und Wappen */
  async set(look: HopperLook, kit: string | null) {
    await loadKits()
    const crest = await crestOf(kit)
    if (this.lost) return
    setModel(this.stage, buildHopper(look, kitSpec(kit), { crest }))
    this.render()
  }

  resize(width: number, height: number, dpr = Math.min(window.devicePixelRatio, 2.5)) {
    const { renderer, camera } = this.stage
    renderer.setPixelRatio(dpr)
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    // Luft nach oben für Hüpfer
    frame(camera, this.framing, 1.16)
    this.render()
  }

  render() {
    if (this.lost || !this.stage.model) return
    const { renderer, scene, camera, holder } = this.stage
    holder.rotation.y = this.turn
    const s = 1 + Math.sin(this.bob * Math.PI * 2) * 0.01
    // beim Absprung gestaucht, oben gestreckt
    const squash = this.hop > 0 ? 1 + (this.hop - 0.35) * 0.08 : 1
    holder.scale.set(2 - squash, s * squash, 2 - squash)
    holder.position.y = this.hop * 0.28
    renderer.render(scene, camera)
  }

  dispose() {
    this.stage.model?.dispose()
    this.stage.renderer.dispose()
    this.stage.renderer.forceContextLoss()
  }
}
