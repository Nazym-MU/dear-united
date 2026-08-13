import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

// Stand membership comes from the parent empties baked into the GLB — every
// brick piece is parented under a "<collection>-root" node. Stadium
// orientation: SAF stand = west, SBC = east, East-Stand = north (Munich/
// trophy facade), Stretford = south. Field-root also holds the ground plate.
const STAND_MESHES = {
  east:  new Set(['SBC-stand-root']),
  north: new Set(['East-Stand-root', 'Seats-East-Stand-root']),
  west:  new Set(['SAF-stand-root']),
  south: new Set(['Stretford-End-root', 'Stretford-End-seats-root']),
  field: new Set(['Field-root']),
}

const ALWAYS_HIDDEN = new Set()

// GLTFLoader runs names through PropertyBinding.sanitizeNodeName, which drops
// '.', '[', ']', ':' and '/'. Multi-primitive meshes also gain '_1' suffixes.
const norm = (name) => name.replace(/_\d+$/, '').replace(/[\s[\].:/]/g, '')

const NORM_STANDS = {}
for (const [stand, set] of Object.entries(STAND_MESHES)) {
  for (const n of set) NORM_STANDS[norm(n)] = stand
}
const NORM_HIDDEN = new Set([...ALWAYS_HIDDEN].map(norm))

// ── Assembly timing ──────────────────────────────────────────────────────────
const ASSEMBLY_SPREAD = 4.6   // seconds over which pieces begin their drop
const DROP_DURATION   = 1.0   // seconds each piece takes to fall
const FADE_PORTION    = 0.3   // opacity ramps in during this first slice of a drop

const CENTER = new THREE.Vector3(0.04, 0.1, 0.1)

function expDecay(cur, target, decay, dt) {
  return target + (cur - target) * Math.pow(decay, dt)
}

const smoothstep = (t) => t * t * (3 - 2 * t)
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

export function initStadium(canvasEl, { onProgress, onAssemblyDone, autoStart = true }) {
  const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, alpha: false, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setClearColor(0x0d0c0a, 1)

  const scene  = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 100)

  scene.add(new THREE.AmbientLight(0xc8d4e8, 0.35))
  const k1 = new THREE.DirectionalLight(0xfff8f0, 1.6);  k1.position.set(3, 6, 2);    scene.add(k1)
  const k2 = new THREE.DirectionalLight(0xe8f0ff, 0.55); k2.position.set(-3, 4, -2);  scene.add(k2)
  const fl = new THREE.DirectionalLight(0xffe8c0, 0.40); fl.position.set(0, 0.5, 4);  scene.add(fl)
  const rl = new THREE.DirectionalLight(0xd0e8ff, 0.50); rl.position.set(-2, 2, -4);  scene.add(rl)
  const gl = new THREE.PointLight(0xc5a55a, 0.20, 3, 2); gl.position.set(0.04, -0.05, 0.1); scene.add(gl)

  // ── Camera path (set via setPath) ──────────────────────────────────────────
  // Waypoints are stored in cylindrical coordinates around CENTER with the
  // angle unwrapped, so interpolating between any two of them orbits the
  // stadium instead of cutting through it.
  let path = null          // [{ radius, theta, y, lookAt: Vector3, shift }]
  let scrollU  = 0         // target position along the path, in waypoint units
  let smoothU  = 0
  let smoothShift = 0

  // Explore-mode user offsets
  let userFovOffset = 0
  let userYawOffset = 0    // rotate slider
  let exploreYaw = 0       // stand-button view preset
  let smoothYaw = 0
  let activeStand = 'all'

  // Assembly state
  let meshData = []        // { obj, stand, restY, curOpacity, delay, drop }
  let assemblyStart = null
  let assemblyDone  = false
  let assemblyClock = -0.7 // scaled elapsed time; starts negative for a beat after the loader fades
  let timeScale     = 1
  let started       = autoStart   // embed mode holds the drop until the section scrolls into view
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Free-orbit mode (embed): drag rotates the ground itself, no scroll path.
  let orbit = null         // { theta, pitch, radius, lookY, velTheta, velPitch, dragging }

  function enableOrbit() {
    if (orbit) return
    const dx = camPos.x - CENTER.x
    const dz = camPos.z - CENTER.z
    orbit = {
      theta: Math.atan2(dz, dx),
      pitch: Math.atan2(camPos.y - CENTER.y, Math.hypot(dx, dz)),
      radius: Math.hypot(dx, dz),
      velTheta: 0,
      velPitch: 0,
      dragging: false,
    }
    let lastX = 0, lastY = 0, lastT = 0
    canvasEl.addEventListener('pointerdown', (e) => {
      orbit.dragging = true
      orbit.velTheta = 0
      orbit.velPitch = 0
      lastX = e.clientX; lastY = e.clientY; lastT = performance.now()
      canvasEl.setPointerCapture(e.pointerId)
      canvasEl.classList.add('dragging')
    })
    canvasEl.addEventListener('pointermove', (e) => {
      if (!orbit.dragging) return
      const dxp = e.clientX - lastX
      const dyp = e.clientY - lastY
      const now = performance.now()
      const dtp = Math.max(1, now - lastT)
      lastX = e.clientX; lastY = e.clientY; lastT = now
      orbit.theta += dxp * 0.006
      orbit.pitch = Math.max(0.06, Math.min(1.25, orbit.pitch + dyp * 0.004))
      orbit.velTheta = (dxp * 0.006) / dtp * 1000
      orbit.velPitch = (dyp * 0.004) / dtp * 1000
    })
    const endDrag = () => { if (orbit) { orbit.dragging = false; canvasEl.classList.remove('dragging') } }
    canvasEl.addEventListener('pointerup', endDrag)
    canvasEl.addEventListener('pointercancel', endDrag)
  }

  const camPos  = new THREE.Vector3(0.55, 0.42, 0.55)
  const camLook = CENTER.clone()

  const dracoLoader = new DRACOLoader()
  dracoLoader.setDecoderPath('/draco/')
  const loader = new GLTFLoader()
  loader.setDRACOLoader(dracoLoader)

  loader.load('/models/old-trafford.glb',
    (gltf) => {
      scene.add(gltf.scene)
      scene.updateMatrixWorld(true)

      const box = new THREE.Box3()
      const raw = []
      gltf.scene.traverse((obj) => {
        if (!obj.isMesh) return
        let key = norm(obj.name || '')
        if (!(key in NORM_STANDS) && !NORM_HIDDEN.has(key) && obj.parent) {
          key = norm(obj.parent.name || '')
        }
        if (NORM_HIDDEN.has(key)) { obj.visible = false; return }

        // Keep each material's authored opacity (the glass panes ship with
        // alpha-blend opacity < 1) — fades multiply against it in setOp.
        const cloneMat = (m) => { const c = m.clone(); c.userData.baseOpacity = c.opacity; c.transparent = true; c.opacity = 0; return c }
        obj.material = Array.isArray(obj.material) ? obj.material.map(cloneMat) : cloneMat(obj.material)

        box.setFromObject(obj)
        raw.push({ obj, stand: NORM_STANDS[key] || null, restY: obj.position.y, curOpacity: 0, baseY: box.min.y, topY: box.max.y })
      })

      // Bottom-up build: pieces whose base sits lower drop first, so nothing
      // falls through geometry that is already in place. Roofs and upper
      // tiers (higher base) arrive last.
      let minB = Infinity, maxB = -Infinity, maxTop = -Infinity
      for (const d of raw) {
        minB = Math.min(minB, d.baseY)
        maxB = Math.max(maxB, d.baseY)
        maxTop = Math.max(maxTop, d.topY)
      }
      const span = Math.max(1e-6, maxB - minB)
      const modelH = Math.max(1e-6, maxTop - minB)
      for (const d of raw) {
        const layer = (d.baseY - minB) / span                    // 0 = ground, 1 = roofline
        d.delay = Math.pow(layer, 0.9) * ASSEMBLY_SPREAD + Math.random() * 0.22
        d.drop  = modelH * 1.35 + (maxTop - d.topY) * 0.4        // everyone falls in from above the roofline
      }
      meshData = raw
      onProgress(1)
    },
    (xhr) => onProgress(xhr.total > 0 ? Math.min(0.999, xhr.loaded / xhr.total) : 0),
    (err) => console.error('GLB load error', err),
  )

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight)
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
  })

  // ── Path helpers ────────────────────────────────────────────────────────────
  function setPath(waypoints) {
    let prevTheta = null
    path = waypoints.map((wp) => {
      const p = new THREE.Vector3(...wp.position)
      const dx = p.x - CENTER.x
      const dz = p.z - CENTER.z
      const radius = Math.hypot(dx, dz)
      let theta = Math.atan2(dz, dx)
      if (prevTheta !== null) {
        while (theta - prevTheta >  Math.PI) theta -= Math.PI * 2
        while (theta - prevTheta < -Math.PI) theta += Math.PI * 2
      }
      prevTheta = theta
      return { radius, theta, y: p.y, lookAt: new THREE.Vector3(...wp.lookAt), shift: wp.shift || 0 }
    })
  }

  function pathCamera(u, outPos, outLook) {
    const i = Math.max(0, Math.min(path.length - 2, Math.floor(u)))
    const f = Math.max(0, Math.min(1, u - i))
    const a = path[i], b = path[i + 1]
    const t = smoothstep(f)
    const radius = a.radius + (b.radius - a.radius) * t
    const theta  = a.theta  + (b.theta  - a.theta)  * t + smoothYaw
    const y      = a.y      + (b.y      - a.y)      * t
    outPos.set(CENTER.x + radius * Math.cos(theta), y, CENTER.z + radius * Math.sin(theta))
    outLook.lerpVectors(a.lookAt, b.lookAt, t)
    return a.shift + (b.shift - a.shift) * t
  }

  const _tPos = new THREE.Vector3()
  const _tLook = new THREE.Vector3()
  const _right = new THREE.Vector3()
  const _fwd = new THREE.Vector3()

  let prevTime = performance.now() / 1000

  requestAnimationFrame(function loop() {
    requestAnimationFrame(loop)
    const now = performance.now() / 1000
    const dt  = Math.min(now - prevTime, 0.1)
    prevTime  = now

    if (meshData.length === 0) { renderer.render(scene, camera); return }

    // ── Assembly clock ────────────────────────────────────────────────────
    if (started) {
      if (assemblyStart === null) assemblyStart = now
      if (!assemblyDone) {
        assemblyClock += dt * (reducedMotion ? 50 : timeScale)
        if (assemblyClock >= ASSEMBLY_SPREAD + DROP_DURATION + 0.4) {
          assemblyDone = true
          onAssemblyDone()
        }
      }
    }

    // ── Camera ────────────────────────────────────────────────────────────
    smoothU     = expDecay(smoothU, scrollU, 0.02, dt)
    smoothYaw   = expDecay(smoothYaw, userYawOffset + exploreYaw, 0.05, dt)

    let shift = 0
    if (orbit && assemblyDone) {
      // Inertia after release
      if (!orbit.dragging) {
        orbit.theta += orbit.velTheta * dt
        orbit.pitch = Math.max(0.06, Math.min(1.25, orbit.pitch + orbit.velPitch * dt))
        const decay = Math.pow(0.05, dt)
        orbit.velTheta *= decay
        orbit.velPitch *= decay
      }
      const r = orbit.radius
      _tPos.set(
        CENTER.x + r * Math.cos(orbit.pitch) * Math.cos(orbit.theta),
        CENTER.y + r * Math.sin(orbit.pitch),
        CENTER.z + r * Math.cos(orbit.pitch) * Math.sin(orbit.theta),
      )
      _tLook.copy(CENTER)
    } else if (path) {
      if (!assemblyDone) {
        // Slow settle from wide to the hero framing while pieces fall.
        const t = Math.min(1, assemblyClock / (ASSEMBLY_SPREAD + DROP_DURATION))
        const ease = smoothstep(t)
        shift = pathCamera(0, _tPos, _tLook)
        const wide = 1.55 - 0.55 * ease
        _tPos.sub(CENTER).multiplyScalar(wide).add(CENTER)
        _tPos.y += 0.22 * (1 - ease)
      } else {
        shift = pathCamera(smoothU, _tPos, _tLook)
      }
    } else {
      _tPos.copy(camPos); _tLook.copy(camLook)
    }

    // Horizontal screen shift so the model sits beside the text column.
    smoothShift = expDecay(smoothShift, shift, 0.02, dt)
    if (Math.abs(smoothShift) > 1e-4) {
      _fwd.subVectors(_tLook, _tPos).normalize()
      _right.crossVectors(_fwd, camera.up).normalize()
      _right.multiplyScalar(-smoothShift)
      _tPos.add(_right); _tLook.add(_right)
    }

    camPos.lerp(_tPos, 1 - Math.pow(0.0008, dt))
    camLook.lerp(_tLook, 1 - Math.pow(0.0008, dt))
    camera.position.copy(camPos)
    camera.lookAt(camLook)
    // Wider base FOV on narrow screens so the whole ground fits the frame.
    const baseFov = window.innerWidth < 700 ? 58 : 45
    camera.fov = Math.max(14, Math.min(88, baseFov + userFovOffset))
    camera.updateProjectionMatrix()

    // ── Pieces: assembly drop + stand isolation fades ─────────────────────
    for (const d of meshData) {
      const target = (activeStand === 'all' || d.stand === activeStand || d.stand === 'field') ? 1 : 0

      let opacity
      if (!assemblyDone) {
        const bT = Math.max(0, Math.min(1, (assemblyClock - d.delay) / DROP_DURATION))
        d.obj.position.y = d.restY + d.drop * (1 - easeOutCubic(bT))
        // Fade in near the top of the fall, while the piece is still isolated
        // in the air — by the time it can pass close to placed geometry it is
        // fully opaque, so no translucent interpenetration is visible.
        opacity = target === 0 ? 0 : Math.min(1, bT / FADE_PORTION)
        d.curOpacity = opacity
      } else {
        d.obj.position.y = d.restY
        d.curOpacity = expDecay(d.curOpacity, target, 0.03, dt)
      }

      const op = Math.max(0, Math.min(1, d.curOpacity))
      const setOp = (m) => {
        const base = m.userData.baseOpacity ?? 1
        m.opacity = op * base
        m.transparent = m.opacity < 0.99
      }
      if (Array.isArray(d.obj.material)) d.obj.material.forEach(setOp)
      else setOp(d.obj.material)
    }

    renderer.render(scene, camera)
  })

  return {
    start:          () => { started = true },
    enableOrbit,
    setPath,
    setScrollU:     (u) => { scrollU = u },
    jumpScrollU:    (u) => { scrollU = u; smoothU = u },
    setFovOffset:   (v) => { userFovOffset = v },
    setYawOffset:   (v) => { userYawOffset = v },
    setExploreYaw:  (v) => { exploreYaw = v },
    setActiveStand: (v) => { activeStand = v },
    hurryAssembly:  () => { if (!assemblyDone) timeScale = 3.5 },
    isAssembled:    () => assemblyDone,
  }
}
