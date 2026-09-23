// The fan wall: an InstancedMesh of 1x2x3 bricks laid in running bond, one per
// fan message. Independent of the stadium loader: it takes the brick geometry,
// a material factory and the scale constants, and owns its own picking.
import * as THREE from 'three'
import { slot, wallExtent, BRICK_STUDS, BRICK_PLATES } from './layout.js'

const _m = new THREE.Matrix4()
const _pos = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()
const _box = new THREE.Box3()

export class FanWall {
  /**
   * @param {object} o
   * @param {THREE.BufferGeometry} o.geometry unit-space 1x2x3 brick (from types.glb or procedural)
   * @param {(colorName:string)=>THREE.Color} o.colorFor lego colour name → display colour
   * @param {THREE.Material} o.material toon material with vertexColors/instance colour support
   * @param {number} o.unit stud pitch (world), o.plate plate height (world)
   * @param {number} o.width bricks per row
   * @param {THREE.Matrix4} o.frame world transform of the wall's origin (bottom-left corner, wall runs along +x, up +y)
   */
  constructor({ geometry, colorFor, material, unit, plate, width = 16, frame = new THREE.Matrix4(), capacity = 20000 }) {
    this.geometry = geometry
    this.colorFor = colorFor
    this.unit = unit
    this.plate = plate
    this.width = width
    this.frame = frame.clone()
    this.bricks = []
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity)
    this.mesh.count = 0
    this.mesh.frustumCulled = false
    this.mesh.name = 'fan-wall'
    this.anim = new Map() // instance → { from, to, t0, dur }

    // Unit-space bbox: pick the longer horizontal axis as "along the wall".
    geometry.computeBoundingBox()
    const bb = geometry.boundingBox
    const size = new THREE.Vector3().subVectors(bb.max, bb.min)
    this.alongZ = size.z > size.x
    this.bb = bb
    // per-axis unit→world scale (x/z are stud halves, y is 1.6mm units — see FORMAT.md)
    this.scale = new THREE.Vector3(unit / 2, plate / 2, unit / 2)
  }

  get group() { return this.mesh }

  setBricks(list) {
    if (list.length > this.mesh.instanceMatrix.count) list = list.slice(0, this.mesh.instanceMatrix.count)
    this.bricks = list.slice()
    this.mesh.count = list.length
    list.forEach((b, i) => {
      this.mesh.setMatrixAt(i, this.matrixFor(i))
      this.mesh.setColorAt(i, this.colorFor(b.color))
    })
    this.mesh.instanceMatrix.needsUpdate = true
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
    this.mesh.computeBoundingSphere()
  }

  // Slot → world matrix. Brick bbox min corner lands on the slot corner.
  matrixFor(i, lift = 0) {
    const s = slot(i, this.width)
    const rot = this.alongZ ? new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2) : new THREE.Quaternion()
    // local (wall-space) placement: bbox min → (x, y, 0)
    const bbMin = this.bb.min.clone().multiply(this.scale).applyQuaternion(rot)
    const bbMax = this.bb.max.clone().multiply(this.scale).applyQuaternion(rot)
    const minX = Math.min(bbMin.x, bbMax.x), minY = Math.min(bbMin.y, bbMax.y), minZ = Math.min(bbMin.z, bbMax.z)
    _pos.set(s.x * this.unit - minX, s.y * this.plate - minY + lift, -minZ)
    _m.compose(_pos, rot, this.scale)
    return _m.clone().premultiply(this.frame)
  }

  /** Add a brick: it appears above its slot and drops in. */
  addBrick(brick) {
    const i = this.bricks.length
    if (i >= this.mesh.instanceMatrix.count) { console.warn('[wall] full: capacity', this.mesh.instanceMatrix.count); return -1 }
    this.bricks.push(brick)
    this.mesh.count = i + 1
    const to = this.matrixFor(i)
    const from = this.matrixFor(i, this.plate * 24)
    this.mesh.setMatrixAt(i, from)
    this.mesh.setColorAt(i, this.colorFor(brick.color))
    this.mesh.instanceMatrix.needsUpdate = true
    this.mesh.instanceColor.needsUpdate = true
    this.anim.set(i, { from, to, t0: performance.now(), dur: 650 })
    this.mesh.computeBoundingSphere()
    return i
  }

  update(now = performance.now()) {
    if (!this.anim.size) return
    for (const [i, a] of this.anim) {
      const t = Math.min(1, (now - a.t0) / a.dur)
      const e = 1 - Math.pow(1 - t, 3) // ease-out cubic; bricks fall, then settle
      a.from.decompose(_pos, _q, _s)
      const p0 = _pos.clone()
      a.to.decompose(_pos, _q, _s)
      _pos.lerpVectors(p0, _pos, e)
      _m.compose(_pos, _q, _s)
      this.mesh.setMatrixAt(i, _m)
      if (t >= 1) this.anim.delete(i)
    }
    this.mesh.instanceMatrix.needsUpdate = true
    // Bricks start above the wall, so the sphere computed at addBrick() time no longer
    // covers them once they land; refresh it or raycasts (clicks, hover) miss the wall.
    if (!this.anim.size) this.mesh.computeBoundingSphere()
  }

  /** Ray-pick a wall brick. Returns { index, brick, point } or null. */
  pick(raycaster) {
    const hits = raycaster.intersectObject(this.mesh, false)
    if (!hits.length) return null
    const h = hits[0]
    return { index: h.instanceId, brick: this.bricks[h.instanceId], point: h.point }
  }

  /** World-space centre of brick i (for tags/cards). */
  centerOf(i, out = new THREE.Vector3()) {
    this.mesh.getMatrixAt(i, _m)
    _box.copy(this.bb).applyMatrix4(_m)
    return _box.getCenter(out)
  }

  /** World-space bbox of the whole wall for framing the camera. */
  extent() {
    const { studs, plates } = wallExtent(this.bricks.length, this.width)
    const depth = (this.alongZ ? this.bb.max.x - this.bb.min.x : this.bb.max.z - this.bb.min.z) * this.unit / 2
    return new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(studs * this.unit, plates * this.plate, depth)).applyMatrix4(this.frame)
  }
}

export { BRICK_STUDS, BRICK_PLATES }
