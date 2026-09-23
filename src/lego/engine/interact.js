// v1 brick interaction: hover highlight, click to lift, move on the stud grid, wheel for
// height, R to rotate, click to drop, Escape to cancel. Kept separate from the store so
// the UX can change without touching rendering or picking.
import * as THREE from 'three'

const LIFT_MS = 150
const _m = new THREE.Matrix4(), _r = new THREE.Matrix4(), _t = new THREE.Matrix4()
const _c = new THREE.Vector3(), _p = new THREE.Vector3()
const _plane = new THREE.Plane()
const _box = new THREE.Box3()
const ease = (x) => 1 - Math.pow(1 - x, 3)

export class BrickInteraction {
  constructor(bricks, { onChange } = {}) {
    this.bricks = bricks
    this.hovered = -1
    this.held = null
    this.onChange = onChange || (() => {})
  }

  get unit() { return this.bricks.model.unit }
  get plate() { return this.bricks.model.plate }
  get holding() { return !!this.held }

  /** Called every frame (or on pointer move) with the current pointer ray, or null. */
  hover(ray) {
    if (this.held) { this._setHover(-1); return }
    const hit = ray ? this.bricks.pick(ray) : null
    this._setHover(hit ? hit.index : -1)
    return hit
  }

  _setHover(i) {
    if (i === this.hovered) return
    if (this.hovered >= 0) this.bricks.setHighlight(this.hovered, 0)
    this.hovered = i
    if (i >= 0) this.bricks.setHighlight(i, 0.55)
  }

  /** A click/tap (not a drag). */
  click(ray) {
    if (this.held) { this.drop(); return true }
    const hit = this.bricks.pick(ray)
    if (!hit) return false
    this.lift(hit.index, ray)
    return true
  }

  lift(i, ray) {
    const b = this.bricks
    this._setHover(-1)
    const base = b.getMatrix(i)
    const box = b.worldBox(i, new THREE.Box3(), base)
    this.held = {
      i,
      base,                                  // matrix at pickup
      centre: b.centre(i, new THREE.Vector3(), base),
      quarter: 0,                            // quarter turns about vertical
      dx: 0, dz: 0,                          // snapped horizontal offset
      dy: 0,                                 // height offset (plates, via wheel)
      lift: 0, liftFrom: 0, liftTo: 1, liftT: performance.now(),
      grab: null,                            // pointer hit on the carry plane at pickup
      // grid phase: the original brick's AABB min corner sits on the stud lattice
      phase: b.worldBox(i, new THREE.Box3(), b.getOriginal(i)).min.clone(),
      boxMin0: box.min.clone(),
      dropping: false,
    }
    b.setHighlight(i, 0.3)
    this._grab(ray)
    this.onChange('lift', i)
  }

  _carryY() {
    const h = this.held
    return h.centre.y + h.dy + 3 * this.plate
  }

  _grab(ray) {
    const h = this.held
    if (!ray) return
    _plane.set(new THREE.Vector3(0, 1, 0), -this._carryY())
    const p = ray.intersectPlane(_plane, new THREE.Vector3())
    if (p) h.grab = p.sub(new THREE.Vector3(h.dx, 0, h.dz))
  }

  /** Pointer moved while holding: follow on the horizontal plane at the carry height, snapped. */
  move(ray) {
    const h = this.held
    if (!h || h.dropping || !ray) return
    if (!h.grab) { this._grab(ray); return }
    _plane.set(new THREE.Vector3(0, 1, 0), -this._carryY())
    if (!ray.intersectPlane(_plane, _p)) return
    const wantX = _p.x - h.grab.x, wantZ = _p.z - h.grab.z
    // snap the rotated brick's AABB min corner onto the original brick's stud lattice
    this._compose(wantX, 0, wantZ, 0, _m)
    this.bricks.worldBox(h.i, _box, _m)
    const u = this.unit
    const sx = h.phase.x + Math.round((_box.min.x - h.phase.x) / u) * u - _box.min.x
    const sz = h.phase.z + Math.round((_box.min.z - h.phase.z) / u) * u - _box.min.z
    h.dx = wantX + sx
    h.dz = wantZ + sz
    this._apply()
  }

  wheel(deltaY) {
    const h = this.held
    if (!h) return false
    h.dy += (deltaY < 0 ? 1 : -1) * this.plate
    this._apply()
    return true
  }

  rotate(ray) {
    const h = this.held
    if (!h) return false
    h.quarter = (h.quarter + 1) % 4
    this.move(ray) // re-snap: rotating an odd x even brick shifts its lattice phase
    this._apply()
    return true
  }

  drop() {
    const h = this.held
    if (!h || h.dropping) return
    h.dropping = true
    h.liftFrom = h.lift; h.liftTo = 0; h.liftT = performance.now()
  }

  cancel() {
    const h = this.held
    if (!h) return false
    this.bricks.setHighlight(h.i, 0)
    this.bricks.restore(h.i)
    this.held = null
    this.onChange('cancel', h.i)
    return true
  }

  update(now = performance.now()) {
    const h = this.held
    if (!h) return
    const k = Math.min(1, (now - h.liftT) / LIFT_MS)
    h.lift = h.liftFrom + (h.liftTo - h.liftFrom) * ease(k)
    this._apply()
    if (h.dropping && k >= 1) {
      this.bricks.setHighlight(h.i, 0)
      this.held = null
      this.onChange('drop', h.i)
    }
  }

  // M = T(dx, dy + lift, dz) · T(c) · Ry(quarter·90°) · T(−c) · base
  _compose(dx, dy, dz, lift, out) {
    const h = this.held
    const c = h.centre
    out.makeTranslation(dx + c.x, dy + lift + c.y, dz + c.z)
    _r.makeRotationY((h.quarter * Math.PI) / 2)
    out.multiply(_r)
    _t.makeTranslation(-c.x, -c.y, -c.z)
    return out.multiply(_t).multiply(h.base)
  }

  _apply() {
    const h = this.held
    this._compose(h.dx, h.dy, h.dz, h.lift * 3 * this.plate, _m)
    this.bricks.setMatrix(h.i, _m)
  }
}
