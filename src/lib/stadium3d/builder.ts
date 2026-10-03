// Sammelt Flächen je Material und baut daraus wenige große Meshes (ein Draw-Call pro Material).
// Farben kommen als Vertexfarben, Texturen liefern nur Struktur.

import * as THREE from 'three'

export type V3 = [number, number, number]
export type UV = [number, number]

interface Bucket {
  pos: number[]
  nor: number[]
  col: number[]
  uv: number[]
}

const tmpColor = new THREE.Color()
const tmpA = new THREE.Vector3()
const tmpB = new THREE.Vector3()
const tmpN = new THREE.Vector3()

export class MeshBuilder<K extends string> {
  private buckets = new Map<K, Bucket>()

  private bucket(key: K) {
    let b = this.buckets.get(key)
    if (!b) {
      b = { pos: [], nor: [], col: [], uv: [] }
      this.buckets.set(key, b)
    }
    return b
  }

  /** Konvexes Polygon (als Fächer trianguliert). Normale aus der Punktreihenfolge. */
  poly(key: K, pts: V3[], color: string | THREE.Color, uvs?: UV[]) {
    if (pts.length < 3) return
    const c = typeof color === 'string' ? tmpColor.set(color) : color
    // Normale robust aus dem ersten nicht entarteten Dreieck
    tmpN.set(0, 0, 0)
    for (let i = 1; i < pts.length - 1 && tmpN.lengthSq() < 1e-10; i++) {
      tmpA.set(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1], pts[i][2] - pts[0][2])
      tmpB.set(pts[i + 1][0] - pts[0][0], pts[i + 1][1] - pts[0][1], pts[i + 1][2] - pts[0][2])
      tmpN.crossVectors(tmpA, tmpB)
    }
    if (tmpN.lengthSq() < 1e-10) return
    tmpN.normalize()
    const b = this.bucket(key)
    const push = (i: number) => {
      const p = pts[i]
      b.pos.push(p[0], p[1], p[2])
      b.nor.push(tmpN.x, tmpN.y, tmpN.z)
      b.col.push(c.r, c.g, c.b)
      const t = uvs?.[i]
      b.uv.push(t ? t[0] : 0, t ? t[1] : 0)
    }
    for (let i = 1; i < pts.length - 1; i++) {
      push(0)
      push(i)
      push(i + 1)
    }
  }

  quad(key: K, a: V3, b: V3, c: V3, d: V3, color: string | THREE.Color, uvs?: [UV, UV, UV, UV]) {
    this.poly(key, [a, b, c, d], color, uvs)
  }

  /** Beliebige three.js-Geometrie übernehmen (z. B. Zylinder, Bäume) */
  geometry(key: K, geom: THREE.BufferGeometry, color: string, matrix?: THREE.Matrix4, flat = false) {
    const g = geom.index ? geom.toNonIndexed() : geom.clone()
    if (matrix) g.applyMatrix4(matrix)
    if (flat || !g.getAttribute('normal')) g.computeVertexNormals()
    const pos = g.getAttribute('position')
    const nor = g.getAttribute('normal')
    const uv = g.getAttribute('uv')
    const c = tmpColor.set(color)
    const b = this.bucket(key)
    for (let i = 0; i < pos.count; i++) {
      b.pos.push(pos.getX(i), pos.getY(i), pos.getZ(i))
      b.nor.push(nor.getX(i), nor.getY(i), nor.getZ(i))
      b.col.push(c.r, c.g, c.b)
      b.uv.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0)
    }
    g.dispose()
  }

  /** Quader zwischen zwei Punkten (Träger, Seile, Masten) */
  beam(key: K, from: V3, to: V3, width: number, height: number, color: string) {
    const dir = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2])
    const len = dir.length()
    if (len < 1e-4) return
    const geom = new THREE.BoxGeometry(width, height, len)
    const m = new THREE.Matrix4().lookAt(new THREE.Vector3(...from), new THREE.Vector3(...to), Math.abs(dir.y / len) > 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0))
    m.setPosition((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2)
    this.geometry(key, geom, color, m)
    geom.dispose()
  }

  /** Senkrechter Quader, Mittelpunkt unten */
  box(key: K, x: number, y: number, z: number, w: number, h: number, d: number, color: string, rotY = 0) {
    const geom = new THREE.BoxGeometry(w, h, d)
    const m = new THREE.Matrix4().makeRotationY(rotY).setPosition(x, y + h / 2, z)
    this.geometry(key, geom, color, m)
    geom.dispose()
  }

  /** Alle Positionen (für Bildausschnitt und Schattenkamera) */
  points(step = 9): Float32Array {
    const out: number[] = []
    for (const b of this.buckets.values()) {
      for (let i = 0; i < b.pos.length; i += 3 * step) out.push(b.pos[i], b.pos[i + 1], b.pos[i + 2])
    }
    return new Float32Array(out)
  }

  build(materials: Record<K, THREE.Material>, shadows: (key: K) => { cast: boolean; receive: boolean }): THREE.Group {
    const group = new THREE.Group()
    for (const [key, b] of this.buckets) {
      if (!b.pos.length) continue
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3))
      g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3))
      g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3))
      g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2))
      g.computeBoundingSphere()
      const mesh = new THREE.Mesh(g, materials[key])
      const s = shadows(key)
      mesh.castShadow = s.cast
      mesh.receiveShadow = s.receive
      mesh.name = key
      // Durchsichtige Flächen zuletzt zeichnen
      if ((materials[key] as THREE.Material).transparent) mesh.renderOrder = 2
      group.add(mesh)
    }
    return group
  }
}
