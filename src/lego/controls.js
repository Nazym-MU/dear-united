// Orbit-first camera: drag turns the stadium around a pivot (like turning a model on a
// table), wheel/pinch zooms toward it, right-drag / two-finger drag / shift-drag slides the
// pivot, WASD/arrows (shift = faster) and Q/E fly the pivot around for the curious.
// Double-click re-centres the pivot on whatever was under the cursor (host supplies the hit).
// Emits `onTap(clientX, clientY, pointerType)` for clicks that were not drags.
import * as THREE from 'three'

const _fwd = new THREE.Vector3(), _right = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0)
const _want = new THREE.Vector3(), _off = new THREE.Vector3()
const PITCH_MAX = THREE.MathUtils.degToRad(88)
const PITCH_MIN = THREE.MathUtils.degToRad(-2) // a hair below the horizon, never under the table

export class FlyControls {
  constructor(camera, dom, { radius = 1, groundY = 0 } = {}) {
    this.camera = camera
    this.dom = dom
    this.radius = radius
    this.groundY = groundY
    this.target = new THREE.Vector3()
    this.yaw = 0; this.pitch = 0.5; this.dist = radius * 2
    this.targetYaw = 0; this.targetPitch = 0.5; this.targetDist = this.dist
    this.minDist = radius * 0.06
    this.maxDist = radius * 7
    this.velocity = new THREE.Vector3()
    this.keys = new Set()
    this.pointers = new Map()
    this.dragDist = 0
    this.orbitSpeed = 0.0052        // radians per pixel
    this.enabled = true
    this.onTap = null
    this.onDoubleTap = null        // (clientX, clientY) => THREE.Vector3 | null  (new pivot)
    this.onWheel = null            // (deltaY) => true if consumed (e.g. brick height)
    this.onPointer = null          // (clientX, clientY, pointerType) on every move
    this.touchLookBlocked = () => false // when holding a brick, one finger moves the brick
    // Embedded in a scrolling page: the host decides when the wheel and keys belong to the
    // scene (e.g. only while the section fills the viewport).
    this.wheelEnabled = () => true
    this.keysEnabled = () => true
    this.arrowsBlocked = () => false // e.g. while a brick is held, arrows belong to the brick
    this.flight = null
    this._lastTap = 0
    this._bind()
  }

  _bind() {
    const d = this.dom
    d.style.touchAction = 'none'
    d.addEventListener('contextmenu', (e) => e.preventDefault())
    d.addEventListener('pointerdown', (e) => {
      d.setPointerCapture(e.pointerId)
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType, button: e.button, shift: e.shiftKey })
      if (this.pointers.size === 1) this.dragDist = 0
      else this.dragDist = 99 // multi-touch is never a tap
      this._pinch = this._pinchState()
      this.flight = null
    })
    d.addEventListener('pointermove', (e) => {
      this.onPointer?.(e.clientX, e.clientY, e.pointerType)
      const p = this.pointers.get(e.pointerId)
      if (!p) return
      const dx = e.clientX - p.x, dy = e.clientY - p.y
      p.x = e.clientX; p.y = e.clientY
      this.dragDist += Math.abs(dx) + Math.abs(dy)
      if (!this.enabled) return
      if (this.pointers.size === 1) {
        if (p.type === 'touch' && this.touchLookBlocked()) return
        if (this.dragDist < 4) return
        const pan = p.button === 2 || p.button === 1 || p.shift
        if (pan) this._pan(dx, dy)
        else {
          this.targetYaw -= dx * this.orbitSpeed
          this.targetPitch = THREE.MathUtils.clamp(this.targetPitch + dy * this.orbitSpeed, PITCH_MIN, PITCH_MAX)
        }
      } else if (this.pointers.size === 2) {
        const s = this._pinchState()
        if (this._pinch && s) {
          this._pan(s.cx - this._pinch.cx, s.cy - this._pinch.cy)
          if (this._pinch.dist > 0) this.targetDist = this._clampDist(this.targetDist * this._pinch.dist / Math.max(1, s.dist))
        }
        this._pinch = s
      }
    })
    const end = (e) => {
      const p = this.pointers.get(e.pointerId)
      if (!p) return
      this.pointers.delete(e.pointerId)
      if (e.type === 'pointerup' && this.pointers.size === 0 && this.dragDist < 6 && (p.type !== 'mouse' || p.button === 0)) {
        const now = performance.now()
        if (now - this._lastTap < 320 && this.onDoubleTap) {
          const pivot = this.onDoubleTap(e.clientX, e.clientY)
          if (pivot) this.focusOn(pivot)
          this._lastTap = 0
        } else {
          this._lastTap = now
          this.onTap?.(e.clientX, e.clientY, p.type)
        }
      }
      this._pinch = this._pinchState()
    }
    d.addEventListener('pointerup', end)
    d.addEventListener('pointercancel', end)
    d.addEventListener('wheel', (e) => {
      if (!this.wheelEnabled()) return
      e.preventDefault()
      let dy = e.deltaY
      if (e.deltaMode === 1) dy *= 16
      if (e.deltaMode === 2) dy *= 400
      if (this.onWheel?.(dy)) return
      if (!this.enabled) return
      this.flight = null
      // trackpad pinch arrives as ctrl+wheel; both just zoom
      this.targetDist = this._clampDist(this.targetDist * Math.exp(dy * 0.0016))
    }, { passive: false })
    window.addEventListener('keydown', (e) => {
      if (e.target.closest?.('input, textarea, [contenteditable]')) return
      if (e.metaKey || e.ctrlKey) return
      if (!this.keysEnabled()) return
      if (/^Arrow/.test(e.code) && this.arrowsBlocked()) return
      this.keys.add(e.code)
      if (/^(Arrow|Key[WASDQE])/.test(e.code)) this.flight = null
    })
    window.addEventListener('keyup', (e) => this.keys.delete(e.code))
    window.addEventListener('blur', () => this.keys.clear())
  }

  _pinchState() {
    if (this.pointers.size !== 2) return null
    const [a, b] = [...this.pointers.values()]
    return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, dist: Math.hypot(a.x - b.x, a.y - b.y) }
  }

  _clampDist(d) { return THREE.MathUtils.clamp(d, this.minDist, this.maxDist) }

  /** Camera-relative axes on the ground plane (forward = where the camera looks, flattened). */
  _basis() {
    _fwd.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw))
    _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw))
  }

  /** Slide the pivot across the screen plane; one screen height ≈ the visible span at the pivot. */
  _pan(dx, dy) {
    const h = this.dom.clientHeight || 1
    const span = 2 * this.dist * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2)
    const k = span / h
    this._basis()
    // screen-up projected: mix of world up and forward depending on pitch
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch)
    _off.copy(_right).multiplyScalar(-dx * k)
      .addScaledVector(_up, dy * k * cp)
      .addScaledVector(_fwd, dy * k * sp)
    this.target.add(_off)
    this._clampTarget()
  }

  _clampTarget() {
    if (this.target.y < this.groundY) this.target.y = this.groundY
  }

  /** Base fly speed (world units / s): scales with zoom so close-ups stay controllable. */
  speed() {
    return this.dist * 0.9
  }

  _spherical(position, target) {
    _off.copy(position).sub(target)
    const dist = Math.max(1e-6, _off.length())
    const yaw = Math.atan2(_off.x, _off.z)
    const pitch = Math.asin(THREE.MathUtils.clamp(_off.y / dist, -1, 1))
    return { yaw, pitch, dist }
  }

  /** Place the camera at `position` looking at `target` (the new pivot). */
  setView(position, target) {
    this.target.copy(target)
    const s = this._spherical(position, target)
    this.yaw = this.targetYaw = s.yaw
    this.pitch = this.targetPitch = THREE.MathUtils.clamp(s.pitch, PITCH_MIN, PITCH_MAX)
    this.dist = this.targetDist = this._clampDist(s.dist)
    this.velocity.set(0, 0, 0)
    this.flight = null
    this._apply()
  }

  /** Animated version of setView. */
  flyTo(position, target, ms = 900) {
    const s = this._spherical(position, target)
    let yaw = s.yaw
    while (yaw - this.yaw > Math.PI) yaw -= Math.PI * 2
    while (yaw - this.yaw < -Math.PI) yaw += Math.PI * 2
    this.flight = {
      t0: performance.now(), ms,
      t0v: this.target.clone(), t1v: target.clone(),
      y0: this.yaw, y1: yaw,
      q0: this.pitch, q1: THREE.MathUtils.clamp(s.pitch, PITCH_MIN, PITCH_MAX),
      d0: this.dist, d1: this._clampDist(s.dist),
    }
  }

  /** Move the pivot to `point`, keeping the current viewing angle and zooming in a little. */
  focusOn(point, ms = 700) {
    _off.set(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch))
    const dist = Math.max(this.minDist * 3, this.dist * 0.55)
    this.flyTo(point.clone().addScaledVector(_off, dist), point, ms)
  }

  _apply() {
    const cp = Math.cos(this.pitch)
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * cp * this.dist,
      this.target.y + Math.sin(this.pitch) * this.dist,
      this.target.z + Math.cos(this.yaw) * cp * this.dist,
    )
    const minY = this.groundY + this.radius * 0.004
    if (this.camera.position.y < minY) this.camera.position.y = minY
    this.camera.lookAt(this.target)
  }

  update(dt) {
    dt = Math.min(dt, 0.1)
    if (this.flight) {
      const f = this.flight
      const k = Math.min(1, (performance.now() - f.t0) / f.ms)
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2
      this.target.lerpVectors(f.t0v, f.t1v, e)
      this.yaw = this.targetYaw = f.y0 + (f.y1 - f.y0) * e
      this.pitch = this.targetPitch = f.q0 + (f.q1 - f.q0) * e
      this.dist = this.targetDist = f.d0 + (f.d1 - f.d0) * e
      this._apply()
      if (k >= 1) this.flight = null
      return true
    }
    const before = this.camera.position.clone()
    // smooth orbit + zoom
    const kl = 1 - Math.exp(-dt * 14)
    this.yaw += (this.targetYaw - this.yaw) * kl
    this.pitch += (this.targetPitch - this.pitch) * kl
    this.dist += (this.targetDist - this.dist) * kl

    // keyboard flight moves the pivot
    this._basis()
    _want.set(0, 0, 0)
    const k = this.keys
    if (this.enabled) {
      if (k.has('KeyW') || k.has('ArrowUp')) _want.add(_fwd)
      if (k.has('KeyS') || k.has('ArrowDown')) _want.sub(_fwd)
      if (k.has('KeyD') || k.has('ArrowRight')) _want.add(_right)
      if (k.has('KeyA') || k.has('ArrowLeft')) _want.sub(_right)
      if (k.has('KeyE')) _want.y += 1
      if (k.has('KeyQ')) _want.y -= 1
    }
    if (_want.lengthSq() > 0) _want.normalize().multiplyScalar(this.speed() * (k.has('ShiftLeft') || k.has('ShiftRight') ? 3 : 1))
    const kv = 1 - Math.exp(-dt * 8)
    this.velocity.lerp(_want, kv)
    if (this.velocity.lengthSq() > 1e-12) {
      this.target.addScaledVector(this.velocity, dt)
      this._clampTarget()
    }
    this._apply()
    return !before.equals(this.camera.position)
  }
}
