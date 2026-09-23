// Brick store: owns the instanced meshes, the live/original matrices, per-brick world
// AABBs for picking, and the `moved` bookkeeping. Rendering details (materials) come
// from render/materials.js; interaction (lift/move/drop) lives in lego/interact.js.
import * as THREE from 'three'
import { loadModel } from './format.js'
import { createBrickMaterial } from '../render/materials.js'

const _m = new THREE.Matrix4()
const _box = new THREE.Box3()
const _v = new THREE.Vector3()
const _hi = new THREE.Color()

export class Bricks {
  constructor() {
    this.root = new THREE.Group()
    this.root.name = 'bricks'
    this.model = null
    this.meshes = []          // InstancedMesh[]
    this.glassMeshes = []
    this.moved = new Map()    // brick index -> true (matrix differs from original)
    this._tmpMesh = new THREE.Mesh(undefined, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
    this._tmpMesh.matrixAutoUpdate = false
    this._raycaster = new THREE.Raycaster()
    this._cand = []
  }

  /** Load the model (real files, or the procedural mock when they are missing). */
  async load(base = 'models/lego/', opts = {}) {
    const model = await loadModel(base, opts)
    this.build(model)
    return model
  }

  build(model) {
    this.model = model
    const n = model.count
    this.count = n
    this.matrices = model.matrices                 // live, row-major 3x4
    this.originals = new Float32Array(model.matrices) // untouched copy
    this.aabb = new Float32Array(n * 6)
    this.brickMesh = new Int32Array(n)
    this.brickLocal = new Int32Array(n)

    // group bricks by (type, material)
    const nm = model.materials.length
    const byPair = new Map()
    for (let i = 0; i < n; i++) {
      const key = model.bricks[3 * i] * nm + model.bricks[3 * i + 1]
      let list = byPair.get(key)
      if (!list) byPair.set(key, (list = []))
      list.push(i)
    }

    const matCache = new Map()
    const materialFor = (mi, type) => {
      const def = model.materials[mi]
      const map = def.kind === 'sticker' ? type.map : null
      const key = map ? `${mi}:${map.uuid}` : `${mi}`
      if (!matCache.has(key)) matCache.set(key, createBrickMaterial(def, map))
      return matCache.get(key)
    }

    // Multi-primitive types (stickers, two-tone bricks): one material per geometry group,
    // coloured from each primitive's own glTF material. Glass instances stay single-material.
    const materialsFor = (mi, type) => {
      const def = model.materials[mi]
      if (!type.parts || def.kind === 'glass') return materialFor(mi, type)
      return type.parts.map((p) => {
        const key = p.map ? `part-tex:${p.map.uuid}` : `part:${p.name}:${p.color.map((v) => v.toFixed(4)).join(',')}`
        if (!matCache.has(key)) {
          matCache.set(key, p.map
            ? createBrickMaterial({ name: p.name || 'stickers', kind: 'sticker', color: [1, 1, 1] }, p.map)
            : createBrickMaterial({ name: p.name, kind: 'opaque', color: p.color }))
        }
        return matCache.get(key)
      })
    }

    for (const [key, list] of byPair) {
      const ti = Math.floor(key / nm), mi = key % nm
      const type = model.types[ti]
      // A few source bricks have inside-out faces the pipeline could not repair without
      // opening holes; the export flags them and they render both sides.
      let mats = materialsFor(mi, type)
      if (type.doubleSided) {
        const ds = (m) => {
          const key = `ds:${m.uuid}`
          if (!matCache.has(key)) { const c = m.clone(); c.side = THREE.DoubleSide; c.onBeforeCompile = m.onBeforeCompile; c.customProgramCacheKey = m.customProgramCacheKey; matCache.set(key, c) }
          return matCache.get(key)
        }
        mats = Array.isArray(mats) ? mats.map(ds) : ds(mats)
      }
      const mesh = new THREE.InstancedMesh(type.geometry, mats, list.length)
      mesh.name = `${type.name}|${model.materials[mi].name}`
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(list.length * 3), 3)
      mesh.instanceColor.setUsage(THREE.DynamicDrawUsage)
      mesh.userData.bricks = Int32Array.from(list)
      const mi3 = this.meshes.length
      list.forEach((bi, li) => {
        this.brickMesh[bi] = mi3
        this.brickLocal[bi] = li
        mesh.setMatrixAt(li, this.getMatrix(bi, _m))
      })
      mesh.computeBoundingSphere()
      if (model.materials[mi].kind === 'glass') {
        mesh.renderOrder = 2
        this.glassMeshes.push(mesh)
      }
      this.meshes.push(mesh)
      this.root.add(mesh)
    }
    for (let i = 0; i < n; i++) this._updateAABB(i)
    this.drawCalls = this.meshes.length
    this.triangles = this.meshes.reduce((s, m) => s + triCount(m.geometry) * m.count, 0)
  }

  // ---------- matrices ----------
  getMatrix(i, target = new THREE.Matrix4()) { return fromRows(this.matrices, i, target) }
  getOriginal(i, target = new THREE.Matrix4()) { return fromRows(this.originals, i, target) }

  setMatrix(i, m) {
    const e = m.elements, o = 12 * i, a = this.matrices
    a[o] = e[0]; a[o + 1] = e[4]; a[o + 2] = e[8]; a[o + 3] = e[12]
    a[o + 4] = e[1]; a[o + 5] = e[5]; a[o + 6] = e[9]; a[o + 7] = e[13]
    a[o + 8] = e[2]; a[o + 9] = e[6]; a[o + 10] = e[10]; a[o + 11] = e[14]
    const mesh = this.meshes[this.brickMesh[i]]
    mesh.setMatrixAt(this.brickLocal[i], m)
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
    this._updateAABB(i)
    let same = true
    for (let k = 0; k < 12; k++) if (a[o + k] !== this.originals[o + k]) { same = false; break }
    if (same) this.moved.delete(i)
    else this.moved.set(i, true)
  }

  restore(i) { this.setMatrix(i, this.getOriginal(i, _m)) }

  resetAll() {
    for (const i of [...this.moved.keys()]) this.restore(i)
    this.moved.clear()
  }

  // ---------- geometry helpers ----------
  typeOf(i) { return this.model.types[this.model.bricks[3 * i]] }
  groupOf(i) { return this.model.bricks[3 * i + 2] }

  /** World-space centre of the brick's unit bbox (independent of where the type's origin is). */
  centre(i, target = new THREE.Vector3(), matrix = null) {
    const bb = this.typeOf(i).geometry.boundingBox
    return bb.getCenter(target).applyMatrix4(matrix || this.getMatrix(i, _m))
  }

  worldBox(i, target = new THREE.Box3(), matrix = null) {
    return target.copy(this.typeOf(i).geometry.boundingBox).applyMatrix4(matrix || this.getMatrix(i, _m))
  }

  _updateAABB(i) {
    this.worldBox(i, _box)
    this.aabb.set([_box.min.x, _box.min.y, _box.min.z, _box.max.x, _box.max.y, _box.max.z], 6 * i)
  }

  /** Centroid of each group's brick translations (original positions). */
  groupCentroids() {
    const g = this.model.groups.map(() => ({ sum: new THREE.Vector3(), n: 0, min: new THREE.Vector3(Infinity, Infinity, Infinity), max: new THREE.Vector3(-Infinity, -Infinity, -Infinity) }))
    for (let i = 0; i < this.count; i++) {
      const o = 12 * i, a = this.originals
      const e = g[this.groupOf(i)]
      if (!e) continue
      _v.set(a[o + 3], a[o + 7], a[o + 11])
      e.sum.add(_v); e.n++
      e.min.min(_v); e.max.max(_v)
    }
    return g.map((e, gi) => ({ name: this.model.groups[gi], count: e.n, centroid: e.n ? e.sum.divideScalar(e.n) : null, min: e.min, max: e.max }))
  }

  // ---------- picking ----------
  /**
   * Ray -> nearest brick. Broad phase: slab test against all world AABBs; narrow phase:
   * triangle raycast of the few candidates (nearest first) with a temporary Mesh.
   * Returns { index, point, distance, normal } or null.
   */
  pick(ray, { exclude = -1 } = {}) {
    const ox = ray.origin.x, oy = ray.origin.y, oz = ray.origin.z
    const ix = 1 / ray.direction.x, iy = 1 / ray.direction.y, iz = 1 / ray.direction.z
    const a = this.aabb, cand = this._cand
    cand.length = 0
    for (let i = 0, n = this.count; i < n; i++) {
      if (i === exclude) continue
      const o = 6 * i
      let t1 = (a[o] - ox) * ix, t2 = (a[o + 3] - ox) * ix
      let tmin = Math.min(t1, t2), tmax = Math.max(t1, t2)
      t1 = (a[o + 1] - oy) * iy; t2 = (a[o + 4] - oy) * iy
      tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2))
      t1 = (a[o + 2] - oz) * iz; t2 = (a[o + 5] - oz) * iz
      tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2))
      if (tmax >= Math.max(tmin, 0)) cand.push(Math.max(tmin, 0), i)
    }
    if (!cand.length) return null
    const order = []
    for (let k = 0; k < cand.length; k += 2) order.push(k)
    order.sort((p, q) => cand[p] - cand[q])

    const rc = this._raycaster, mesh = this._tmpMesh
    rc.ray.copy(ray)
    rc.near = 0; rc.far = Infinity
    let best = null
    for (const k of order) {
      const tmin = cand[k], i = cand[k + 1]
      if (best && tmin > best.distance) break
      mesh.geometry = this.typeOf(i).geometry
      this.getMatrix(i, mesh.matrixWorld)
      const hits = rc.intersectObject(mesh, false)
      if (hits.length && (!best || hits[0].distance < best.distance)) {
        const h = hits[0]
        best = { index: i, point: h.point.clone(), distance: h.distance, normal: h.face ? h.face.normal.clone().transformDirection(mesh.matrixWorld) : null }
      }
    }
    return best
  }

  // ---------- highlight ----------
  /** amount 0..1 tints the brick toward the warm highlight colour. */
  setHighlight(i, amount) {
    if (i < 0) return
    const mesh = this.meshes[this.brickMesh[i]]
    mesh.setColorAt(this.brickLocal[i], _hi.setRGB(amount, 0, 0, THREE.LinearSRGBColorSpace))
    mesh.instanceColor.needsUpdate = true
  }
}

function fromRows(a, i, target) {
  const o = 12 * i
  return target.set(a[o], a[o + 1], a[o + 2], a[o + 3], a[o + 4], a[o + 5], a[o + 6], a[o + 7], a[o + 8], a[o + 9], a[o + 10], a[o + 11], 0, 0, 0, 1)
}

function triCount(g) {
  return (g.index ? g.index.count : g.attributes.position.count) / 3
}
