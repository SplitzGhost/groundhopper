// Bühne für die 3D-Stadien: Licht, Schatten, Kamera.
// - snapshot(): rendert ein Standbild (PNG mit transparentem Hintergrund) für Karten und Listen.
//   Ein einziger WebGL-Kontext arbeitet die Anfragen nacheinander ab; Ergebnisse landen zusätzlich
//   im Cache Storage, damit sie beim nächsten Start sofort da sind.
// - LiveStadium: drehbare Ansicht auf einer eigenen Canvas.

import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { Stadium } from '../../shared/types.ts'
import { buildStadium, disposeModel, type StadiumModel } from './model.ts'

/** Bei Änderungen am Modell hochzählen – verwirft alte Standbilder im Cache */
const VERSION = 1

/** Standard-Blickwinkel: leicht von links vorn, schräg von oben */
export const DEFAULT_AZ = (-22 * Math.PI) / 180
export const DEFAULT_EL = (30 * Math.PI) / 180
const FOV = 26

interface Stage {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  sun: THREE.DirectionalLight
  model: StadiumModel | null
}

function createStage(canvas?: HTMLCanvasElement, shadowSize = 2048): Stage {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true, preserveDrawingBuffer: !canvas, powerPreference: 'high-performance',
  })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.setClearColor(0x000000, 0)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.shadowMap.autoUpdate = false

  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environmentIntensity = 0.32
  pmrem.dispose()

  scene.add(new THREE.HemisphereLight('#eef5ff', '#c9c0ae', 0.75))
  const sun = new THREE.DirectionalLight('#fff7ec', 3.6)
  sun.castShadow = true
  sun.shadow.mapSize.set(shadowSize, shadowSize)
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.12
  sun.shadow.radius = 3
  scene.add(sun, sun.target)

  const camera = new THREE.PerspectiveCamera(FOV, 4 / 3, 1, 4000)
  return { renderer, scene, camera, sun, model: null }
}

function setModel(stage: Stage, model: StadiumModel) {
  if (stage.model) {
    stage.scene.remove(stage.model.group)
    disposeModel(stage.model)
  }
  stage.model = model
  stage.scene.add(model.group)
  const { center, radius } = model
  // Licht von links oben, seitlich zur Kamera – so werfen Dach und Ränge sichtbare Schatten
  const dir = new THREE.Vector3(-0.85, 1.05, 0.08).normalize()
  stage.sun.position.copy(center).addScaledVector(dir, radius * 2)
  stage.sun.target.position.copy(center)
  const cam = stage.sun.shadow.camera
  cam.left = -radius
  cam.right = radius
  cam.top = radius
  cam.bottom = -radius
  cam.near = radius * 0.5
  cam.far = radius * 3.5
  cam.updateProjectionMatrix()
  stage.renderer.shadowMap.needsUpdate = true
}

// ---------- Bildausschnitt ----------

const v = new THREE.Vector3()

/** Kamera so platzieren, dass alle Punkte mit Rand ins Bild passen; liefert Abstand und Ziel */
function fit(camera: THREE.PerspectiveCamera, model: StadiumModel, az: number, el: number, margin = 0.04) {
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el))
  const target = model.center.clone()
  let dist = model.radius / Math.sin(((FOV / 2) * Math.PI) / 180)
  const pts = model.points
  for (let iter = 0; iter < 4; iter++) {
    camera.position.copy(target).addScaledVector(dir, dist)
    camera.lookAt(target)
    camera.updateMatrixWorld()
    camera.updateProjectionMatrix()
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (let i = 0; i < pts.length; i += 3) {
      v.set(pts[i], pts[i + 1], pts[i + 2]).project(camera)
      if (v.x < minX) minX = v.x
      if (v.x > maxX) maxX = v.x
      if (v.y < minY) minY = v.y
      if (v.y > maxY) maxY = v.y
    }
    const halfH = dist * Math.tan(((FOV / 2) * Math.PI) / 180)
    const halfW = halfH * camera.aspect
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1)
    target.addScaledVector(right, ((minX + maxX) / 2) * halfW).addScaledVector(up, ((minY + maxY) / 2) * halfH)
    const scale = Math.max((maxX - minX) / 2, (maxY - minY) / 2) / (1 - margin)
    dist *= scale
  }
  camera.position.copy(target).addScaledVector(dir, dist)
  camera.lookAt(target)
  return { dist, target }
}

// ---------- Standbilder ----------

export type SnapSize = 'sm' | 'lg'
const SIZES: Record<SnapSize, [number, number]> = { sm: [440, 330], lg: [960, 720] }
const CACHE_NAME = `stadium-art-v${VERSION}`

let snapStage: Stage | null = null
let queue: Promise<unknown> = Promise.resolve()
const memo = new Map<string, Promise<string>>()
let cachePruned = false

async function openCache(): Promise<Cache | null> {
  try {
    // Im Dev-Modus immer frisch rendern, sonst sieht man Änderungen am Modell nicht
    if (import.meta.env.DEV || !('caches' in window)) return null
    if (!cachePruned) {
      cachePruned = true
      for (const k of await caches.keys()) if (k.startsWith('stadium-art-') && k !== CACHE_NAME) void caches.delete(k)
    }
    return await caches.open(CACHE_NAME)
  } catch {
    return null
  }
}

const nextFrame = () => new Promise<void>((res) => requestAnimationFrame(() => setTimeout(res, 0)))

async function render(stadium: Stadium, mono: boolean, size: SnapSize): Promise<Blob> {
  snapStage ??= createStage()
  const stage = snapStage
  const [w, h] = SIZES[size]
  stage.renderer.setPixelRatio(1)
  stage.renderer.setSize(w, h, false)
  stage.camera.aspect = w / h
  setModel(stage, buildStadium(stadium, mono))
  fit(stage.camera, stage.model!, DEFAULT_AZ, DEFAULT_EL)
  stage.renderer.render(stage.scene, stage.camera)
  const blob = await new Promise<Blob | null>((res) => stage.renderer.domElement.toBlob(res, 'image/png'))
  if (!blob) throw new Error('Standbild fehlgeschlagen')
  return blob
}

/** Objekt-URL eines Standbilds (aus Speicher, Cache oder frisch gerendert) */
export function snapshot(stadium: Stadium, mono: boolean, size: SnapSize): Promise<string> {
  const key = `${stadium.id}-${mono ? 'mono' : 'color'}-${size}`
  let p = memo.get(key)
  if (p) return p
  p = (async () => {
    const cacheUrl = `/__stadium-art/${key}.png`
    const cache = await openCache()
    const hit = await cache?.match(cacheUrl).catch(() => undefined)
    if (hit) return URL.createObjectURL(await hit.blob())
    // Nacheinander rendern, mit Luft für die Oberfläche dazwischen
    const job = queue.then(async () => {
      await nextFrame()
      return render(stadium, mono, size)
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

export class LiveStadium {
  private stage: Stage
  private baseDist = 1
  private target = new THREE.Vector3()
  private lost = false
  az = DEFAULT_AZ
  el = DEFAULT_EL
  zoom = 1

  constructor(canvas: HTMLCanvasElement, stadium: Stadium, mono: boolean) {
    this.stage = createStage(canvas, 2048)
    setModel(this.stage, buildStadium(stadium, mono))
    canvas.addEventListener('webglcontextlost', () => { this.lost = true })
  }

  /** Größe in CSS-Pixeln; Abstand so, dass das Stadion in jeder Drehung ins Bild passt */
  resize(width: number, height: number, dpr = Math.min(window.devicePixelRatio, 2.5)) {
    const { renderer, camera, model } = this.stage
    renderer.setPixelRatio(dpr)
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    let best = 0
    for (let k = 0; k < 8; k++) {
      const r = fit(camera, model!, (k / 8) * Math.PI * 2, this.el, 0.02)
      if (r.dist > best) best = r.dist
    }
    this.baseDist = best
    this.target.copy(model!.center)
    this.render()
  }

  render() {
    if (this.lost) return
    const { renderer, scene, camera } = this.stage
    const dir = new THREE.Vector3(Math.sin(this.az) * Math.cos(this.el), Math.sin(this.el), Math.cos(this.az) * Math.cos(this.el))
    camera.position.copy(this.target).addScaledVector(dir, this.baseDist / this.zoom)
    camera.lookAt(this.target)
    renderer.render(scene, camera)
  }

  dispose() {
    const { renderer, model } = this.stage
    if (model) disposeModel(model)
    renderer.dispose()
    renderer.forceContextLoss()
  }
}
