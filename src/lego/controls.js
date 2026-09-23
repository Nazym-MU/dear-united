// Chrona-like fly controls: drag to look, wheel to glide forward/back, WASD/arrows to fly
// (shift = faster), Q/E down/up. Touch: one finger looks, two fingers pan, pinch glides.
// Emits `onTap(clientX, clientY, pointerType)` for clicks that were not drags.
import * as THREE from 'three'

const _fwd = new THREE.Vector3(), _right = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0)
const _want = new THREE.Vector3()
const PITCH_MAX = THREE.MathUtils.degToRad(85)

export class FlyControls {
  constructor(camera, dom, { radius = 1, groundY = 0 } = {}) {
    this.camera = camera
    this.dom = dom
    this.radius = radius
    this.groundY = groundY
    this.yaw = 0; this.pitch = 0
    this.targetYaw = 0; this.targetPitch = 0
    this.velocity = new THREE.Vector3()
    this.impulse = new THREE.Vector3()
    this.keys = new Set()
    this.pointers = new Map()
    this.dragDist = 0
    this.lookSpeed = 0.0032
    this.enabled = true
    this.onTap = null
    this.onWheel = null            // (deltaY) => true if consumed (e.g. brick height)
    this.onPointer = null          // (clientX, clientY, pointerType) on every move
    this.touchLookBlocked = () => false // when holding a brick, one finger moves the brick
    // Embedded in a scrolling page: the host decides when the wheel and keys belong to the
    // scene (e.g. only while the section fills the viewport). When false, the wheel is left
    // alone so the page scrolls, and fly keys are ignored.
    this.wheelEnabled = () => true
    this.keysEnabled = () => true
    this.flight = null
    camera.rotation.order = 'YXZ'
    this._bind()
  }

  _bind() {
    const d = this.dom
    d.style.touchAction = 'none'
    d.addEventListener('pointerdown', (e) => {
      d.setPointerCapture(e.pointerId)
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType, button: e.button })
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
        this.targetYaw += dx * this.lookSpeed
        this.targetPitch = THREE.MathUtils.clamp(this.targetPitch + dy * this.lookSpeed, -PITCH_MAX, PITCH_MAX)
      } else if (this.pointers.size === 2) {
        const s = this._pinchState()
        if (this._pinch && s) {
          const k = this.speed() * 0.0022
          this._basis()
          const pan = _right.clone().multiplyScalar(-(s.cx - this._pinch.cx) * k)
            .addScaledVector(_up, (s.cy - this._pinch.cy) * k)
          this.camera.position.add(pan)
          this.camera.position.addScaledVector(_fwd, (s.dist - this._pinch.dist) * k * 2.2)
        }
        this._pinch = s
      }
    })
    const end = (e) => {
      const p = this.pointers.get(e.pointerId)
      if (!p) return
      this.pointers.delete(e.pointerId)
      if (e.type === 'pointerup' && this.pointers.size === 0 && this.dragDist < 6 && (p.type !== 'mouse' || p.button === 0)) {
        this.onTap?.(e.clientX, e.clientY, p.type)
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
      this._basis()
      this.impulse.addScaledVector(_fwd, -dy * this.speed() * 0.006)
    }, { passive: false })
    window.addEventListener('keydown', (e) => {
      if (e.target.closest?.('input, textarea, [contenteditable]')) return
      if (e.metaKey || e.ctrlKey) return
      if (!this.keysEnabled()) return
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

  _basis() {
    const cp = Math.cos(this.pitch)
    _fwd.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp)
    _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw))
  }

  /** Base fly speed (world units / s): scales with altitude so close-ups stay controllable. */
  speed() {
    const alt = Math.max(0, this.camera.position.y - this.groundY)
    return this.radius * THREE.MathUtils.clamp(alt / (this.radius * 0.6), 0.04, 1.5) * 0.5
  }

  /** Place the camera at `position` looking at `target`. */
  setView(position, target) {
    this.camera.position.copy(position)
    const d = _want.copy(target).sub(position).normalize()
    this.yaw = this.targetYaw = Math.atan2(-d.x, -d.z)
    this.pitch = this.targetPitch = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1))
    this.velocity.set(0, 0, 0); this.impulse.set(0, 0, 0)
    this.flight = null
    this._applyRotation()
  }

  /** Animated version of setView. */
  flyTo(position, target, ms = 900) {
    const d = _want.copy(target).sub(position).normalize()
    let yaw = Math.atan2(-d.x, -d.z)
    while (yaw - this.yaw > Math.PI) yaw -= Math.PI * 2
    while (yaw - this.yaw < -Math.PI) yaw += Math.PI * 2
    this.flight = {
      t0: performance.now(), ms,
      p0: this.camera.position.clone(), p1: position.clone(),
      y0: this.yaw, y1: yaw, q0: this.pitch, q1: Math.asin(THREE.MathUtils.clamp(d.y, -1, 1)),
    }
  }

  _applyRotation() {
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ')
  }

  update(dt) {
    dt = Math.min(dt, 0.1)
    if (this.flight) {
      const f = this.flight
      const k = Math.min(1, (performance.now() - f.t0) / f.ms)
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2
      this.camera.position.lerpVectors(f.p0, f.p1, e)
      this.yaw = this.targetYaw = f.y0 + (f.y1 - f.y0) * e
      this.pitch = this.targetPitch = f.q0 + (f.q1 - f.q0) * e
      this._applyRotation()
      if (k >= 1) this.flight = null
      return true
    }
    // smooth look
    const kl = 1 - Math.exp(-dt * 18)
    this.yaw += (this.targetYaw - this.yaw) * kl
    this.pitch += (this.targetPitch - this.pitch) * kl
    this._applyRotation()

    // keyboard flight
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
    // wheel impulses glide and decay
    const step = this.impulse.clone().multiplyScalar(1 - Math.exp(-dt * 7))
    this.impulse.sub(step)
    const before = this.camera.position.clone()
    this.camera.position.addScaledVector(this.velocity, dt).add(step)
    // never go below the ground
    const minY = this.groundY + this.radius * 0.004
    if (this.camera.position.y < minY) this.camera.position.y = minY
    return !before.equals(this.camera.position) || Math.abs(this.targetYaw - this.yaw) > 1e-5 || Math.abs(this.targetPitch - this.pitch) > 1e-5
  }
}
