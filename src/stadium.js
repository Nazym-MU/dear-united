// The letter page's stadium: the ink-style LEGO Old Trafford (src/lego/), embedded in
// #stadium-live. Bricks drop into place bottom-up in front of the home camera; once the
// last one lands the visitor gets the engine's fly controls, can lift and carry bricks,
// open stand cards, and add a brick to the fan wall.
//
// Contract used by src/united.js:
//   initStadium(canvas, { onProgress, onAssemblyDone, autoStart, root })
//     -> { start, setActive, hurryAssembly, enableOrbit, setPath, isAssembled }
// (The asset fetch starts immediately; nothing drops until start().)
//
// src/stadium-classic.js is the previous GLB implementation, still used by stadium.html.
import * as THREE from 'three'
import './styles/stadium.css'
import { Bricks } from './lego/engine/bricks.js'
import { BrickInteraction } from './lego/engine/interact.js'
import { InkPipeline } from './lego/render/pipeline.js'
import { createSky, createGround, createLights } from './lego/render/sky.js'
import { SKY_HORIZON, inkColor } from './lego/render/palette.js'
import { toonGradient } from './lego/render/materials.js'
import { FlyControls } from './lego/controls.js'
import { createUI, PRETTY } from './lego/ui.js'
import { FanWall } from './lego/wall/wall.js'
import { wallExtent } from './lego/wall/layout.js'
import { mountWallUI } from './lego/wall/ui.js'
import { listBricks } from './lego/wall/store.js'
import { STANDS_INFO } from './data/stands-info.js'
import { play as playSound, unlock as unlockSound } from './lego/sound.js'

const REAL_WORLD_LENGTH_M = 230 // the stadium's longest side reads as ~230 m

// ── Assembly timing ──────────────────────────────────────────────────────────
const ASSEMBLY_SPREAD = 4.6   // seconds over which bricks begin their drop (by height rank)
const DROP_DURATION = 1.0     // seconds each brick takes to fall
const JITTER = 0.18           // random extra delay per brick, seconds
const DROP_HEIGHT = 0.12      // × scene radius
const LEAD_IN = 0.3           // a beat before the first brick moves
const HURRY = 3.5             // time scale after a tap

// ── Fan wall ─────────────────────────────────────────────────────────────────
const WALL_WIDTH = 16         // bricks per row
const WALL_GAP_STUDS = 4      // gap between the stadium footprint and the wall
const WALL_STAGGER_MS = 110   // wall bricks drop one after another
const WALL_LINEAR = {
  red: [0.8, 0.001, 0.008],
  white: [1, 1, 1],
  black: [0, 0, 0],
  gray: [0.2, 0.2, 0.2],
  yellow: [0.67, 0.4, 0],
  blue: [0.009, 0.058, 0.8],
  green: [0.08, 0.34, 0.04],
  beige: [0.91, 0.62, 0.22],
}

// Home camera: corner 3/4 aerial (same direction as the engine's homeView()).
const HOME_DIR = new THREE.Vector3(0.95, 0.44, 1.15).normalize()

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)
const _m = new THREE.Matrix4()
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0)

export function initStadium(canvas, { onProgress, onAssemblyDone, autoStart = true, root } = {}) {
  root = root || canvas.closest('section') || canvas.parentElement
  const coarse = window.matchMedia('(pointer: coarse)').matches
  // Touch devices get a lower render resolution: a dpr-3 phone framebuffer plus the
  // MSAA/half-float targets is exactly the memory mix that crashes Safari.
  const MAX_DPR = coarse ? 1.1 : 1.5
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
  renderer.autoClear = false
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR))

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(45, 1, 0.001, 100)
  const bricks = new Bricks()

  let model = null, box, center, radius, metresPerUnit, groundY
  let pipeline = null, sky = null
  let controls = null, interaction = null, ui = null
  let wall = null, wallUI = null, wallTag = null
  let started = autoStart
  let active = true
  let engaged = false        // section (nearly) fills the viewport: wheel + keys belong to the scene
  let assembly = null        // running drop state
  let assemblyDone = false
  let timeScale = 1
  let raf = 0, last = performance.now()

  // ── Load ────────────────────────────────────────────────────────────────────
  bricks.load('models/lego/', { onProgress: (p) => onProgress?.(p) }).then((m) => {
    model = m
    scene.add(bricks.root)
    box = new THREE.Box3(new THREE.Vector3(...model.bounds.min), new THREE.Vector3(...model.bounds.max))
    center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    radius = size.length() / 2
    metresPerUnit = REAL_WORLD_LENGTH_M / Math.max(size.x, size.z)

    camera.near = radius * 0.0025
    camera.far = radius * 80
    camera.updateProjectionMatrix()

    groundY = box.min.y - model.plate * 0.05
    scene.add(createGround(groundY, radius * 60))
    scene.add(createLights(center, radius))
    scene.fog = new THREE.Fog(SKY_HORIZON.clone(), radius * 2.2, radius * 11)
    sky = createSky(radius * 70)
    pipeline = new InkPipeline(renderer, { scene, sky, camera, unit: model.unit })
    onResize()
    setView(...homeView())

    prepareAssembly()
    onProgress?.(1)
    console.info(`[lego] ${model.source} model: ${model.count} bricks, ${bricks.drawCalls} instanced meshes, ${(bricks.triangles / 1e6).toFixed(2)}M triangles`)
    window.__stadium = { THREE, scene, camera, bricks, model, get controls() { return controls }, get interaction() { return interaction }, get wall() { return wall }, get wallUI() { return wallUI }, get ui() { return ui }, homeView }
    kick()
  }).catch((err) => {
    console.error('[lego] could not load the model', err)
  })

  // ── Camera ──────────────────────────────────────────────────────────────────
  function homeView() {
    const fit = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov) / 2)
    // 0.72 frames a 16:10 screen; portrait fits the footprint to ~90% of the width instead
    const dist = fit * (camera.aspect < 1 ? 0.83 / Math.max(camera.aspect, 0.4) : 0.72)
    const target = center.clone().setY(box.min.y + (box.max.y - box.min.y) * 0.3)
    return [target.clone().addScaledVector(HOME_DIR, dist), target]
  }

  function setView(pos, target) {
    if (controls) { controls.setView(pos, target); return }
    camera.position.copy(pos)
    camera.lookAt(target)
  }

  function flyToTag(tag) {
    const c = tag.centroid
    const out = new THREE.Vector3(c.x - center.x, 0, c.z - center.z)
    if (out.lengthSq() < 1e-8) out.set(1, 0, 1)
    out.normalize()
    // stand on the far side of the pitch, looking at the stand
    const pos = center.clone().addScaledVector(out, -radius * 0.45).setY(box.max.y * 0.9 + radius * 0.12)
    controls.flyTo(pos, new THREE.Vector3(c.x, c.y + radius * 0.02, c.z), 1100)
  }

  // ── Assembly ────────────────────────────────────────────────────────────────
  // Bricks sorted by the bottom of their world AABB; start delays spread over
  // ASSEMBLY_SPREAD by height rank, so the ground goes in first and roofs last.
  function prepareAssembly() {
    const n = bricks.count
    const rank = Array.from({ length: n }, (_, i) => i)
    rank.sort((a, b) => bricks.aabb[6 * a + 1] - bricks.aabb[6 * b + 1])
    const delay = new Float32Array(n)
    rank.forEach((bi, r) => { delay[bi] = (r / Math.max(1, n - 1)) * ASSEMBLY_SPREAD + Math.random() * JITTER })
    const sorted = Int32Array.from(rank).sort((a, b) => delay[a] - delay[b])
    assembly = { delay, sorted, next: 0, flying: [], clock: -LEAD_IN, h: DROP_HEIGHT * radius, dirty: new Set() }
    // hide everything; falling bricks can leave their mesh's bounding sphere, so no culling meanwhile
    for (const mesh of bricks.meshes) {
      for (let k = 0; k < mesh.count; k++) mesh.setMatrixAt(k, ZERO)
      mesh.instanceMatrix.needsUpdate = true
      mesh.frustumCulled = false
    }
    if (started) beginAssembly()
  }

  function beginAssembly() {
    if (!assembly || assembly.begun) return
    assembly.begun = true
    if (reducedMotion) {
      for (let i = 0; i < bricks.count; i++) placeBrick(i, 0)
      flushDirty()
      finishAssembly()
    }
    kick()
  }

  function placeBrick(i, dy) {
    const mesh = bricks.meshes[bricks.brickMesh[i]]
    bricks.getOriginal(i, _m)
    _m.elements[13] += dy
    mesh.setMatrixAt(bricks.brickLocal[i], _m)
    assembly.dirty.add(mesh)
  }

  function flushDirty() {
    for (const mesh of assembly.dirty) mesh.instanceMatrix.needsUpdate = true
    assembly.dirty.clear()
  }

  function stepAssembly(dt) {
    const A = assembly
    const n = bricks.count
    A.clock += dt * timeScale
    while (A.next < n && A.delay[A.sorted[A.next]] <= A.clock) A.flying.push(A.sorted[A.next++])
    let w = 0
    for (let k = 0; k < A.flying.length; k++) {
      const i = A.flying[k]
      const t = (A.clock - A.delay[i]) / DROP_DURATION
      if (t < 1) {
        placeBrick(i, A.h * (1 - easeOutCubic(Math.max(0, t))))
        A.flying[w++] = i
      } else {
        placeBrick(i, 0)
      }
    }
    A.flying.length = w
    flushDirty()
    if (A.next >= n && w === 0) finishAssembly()
  }

  function finishAssembly() {
    if (assemblyDone) return
    assemblyDone = true
    for (const mesh of bricks.meshes) {
      mesh.frustumCulled = true
      mesh.computeBoundingSphere()
    }
    onAssemblyDone?.()
    enableOrbit()
    loadWall()
    setTimeout(() => ui?.showHelpOnce(), 1200)
  }

  // ── Interactive mode ────────────────────────────────────────────────────────
  const pointer = { ndc: new THREE.Vector2(), inside: false, dirty: false }
  const raycaster = new THREE.Raycaster()
  let overWall = false

  function rayAt(clientX, clientY) {
    const r = canvas.getBoundingClientRect()
    pointer.ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1)
    raycaster.setFromCamera(pointer.ndc, camera)
    return raycaster.ray
  }
  rayAt.last = () => { raycaster.setFromCamera(pointer.ndc, camera); return raycaster.ray }

  function enableOrbit() {
    if (controls || !model || !assemblyDone) return
    controls = new FlyControls(camera, canvas, { radius, groundY }) // sets touch-action: none
    controls.setView(...homeView())
    controls.wheelEnabled = () => engaged
    controls.keysEnabled = () => engaged
    interaction = new BrickInteraction(bricks, {
      onChange: (what) => {
        ui.setMovedCount(bricks.moved.size)
        ui.setHolding(what === 'lift' || what === 'rotate')
        if (what === 'lift') ui.closeHelp()
        if (what === 'lift') playSound('lift')
        else if (what === 'drop' || what === 'cancel') playSound('snap')
        else if (what === 'rotate') playSound('tick')
      },
    })
    canvas.addEventListener('pointerdown', unlockSound, { passive: true })

    ui = createUI({
      root,
      info: STANDS_INFO,
      onBack: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
      onResetView: () => controls.flyTo(...homeView(), 900),
      onResetBricks: () => { interaction.cancel(); bricks.resetAll(); ui.setMovedCount(0) },
      onFlyTo: (tag) => flyToTag(tag),
      onHoldAction: (act) => {
        // toolbar clicks happen off the canvas: never re-aim the brick at the toolbar
        if (act === 'rotate') interaction.rotate(null)
        else if (act === 'up') interaction.wheel(-1)
        else if (act === 'down') interaction.wheel(1)
        else if (act === 'drop') interaction.drop()
        else if (act === 'cancel') interaction.cancel()
      },
    })
    const cents = bricks.groupCentroids()
    ui.setTags(
      cents
        .filter((g) => g.count && !/seats/i.test(g.name))
        .map((g) => ({
          key: g.name,
          label0: PRETTY[g.name] || g.name.replace(/-/g, ' '),
          count: g.count,
          centroid: g.centroid.clone(),
          position: new THREE.Vector3(g.centroid.x, g.max.y + radius * 0.02, g.centroid.z),
        }))
    )

    controls.onPointer = (x, y) => {
      rayAt(x, y)
      pointer.inside = true
      pointer.dirty = true
    }
    canvas.addEventListener('pointerleave', () => {
      pointer.inside = false
      if (!interaction.holding) interaction.hover(null)
      overWall = false
      canvas.classList.remove('over-brick')
    })
    controls.onTap = (x, y) => {
      const ray = rayAt(x, y)
      if (interaction.holding) { interaction.click(ray); return }
      // wall bricks first: they only ever show their message, never lift
      const wh = wall && wall.pick(raycaster)
      if (wh && wh.brick) { ui.closeCard(); wallUI.showBrick(wh.brick); return }
      interaction.click(ray)
    }
    controls.onWheel = (dy) => interaction.wheel(dy)
    // double-click: re-centre the orbit pivot on the brick (or ground) under the cursor
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -groundY)
    controls.onDoubleTap = (x, y) => {
      const ray = rayAt(x, y)
      const hit = bricks.pick(ray)
      if (hit && hit.point) return hit.point.clone()
      const p = new THREE.Vector3()
      return ray.intersectPlane(groundPlane, p) ? p : null
    }
    controls.touchLookBlocked = () => interaction.holding
    controls.arrowsBlocked = () => interaction.holding // arrows steer the brick, not the camera
    window.addEventListener('keydown', (e) => {
      if (e.target.closest?.('input, textarea, [contenteditable]')) return
      if (!engaged && !interaction.holding) return
      if (e.metaKey || e.ctrlKey) return
      if (e.code === 'KeyR' || (interaction.holding && (e.code === 'ArrowLeft' || e.code === 'ArrowRight'))) {
        interaction.rotate(pointer.inside ? rayAt.last() : null)
        e.preventDefault()
      } else if (interaction.holding && e.code === 'ArrowUp') { interaction.wheel(-1); e.preventDefault() }
      else if (interaction.holding && e.code === 'ArrowDown') { interaction.wheel(1); e.preventDefault() }
      else if (e.code === 'Escape') {
        if (!interaction.cancel() && !ui.closeCard()) wallUI?.close()
      }
    })
    kick()
  }

  // ── Fan wall ────────────────────────────────────────────────────────────────
  function buildWall() {
    const types = model.types
    const type = types.find((t) => t.name === '1x2x3') || types.find((t) => t.name.startsWith('1x2x3'))
    if (!type) { console.warn('[lego] no 1x2x3 type in the model; fan wall disabled'); return null }

    const colors = {}
    for (const [name, lin] of Object.entries(WALL_LINEAR)) colors[name] = inkColor(lin)
    const colorFor = (name) => colors[name] || colors.red
    // white base × per-instance colour (setColorAt multiplies the material colour)
    const material = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: toonGradient() })
    material.name = 'fan-wall'

    // Face the home camera: pick the footprint side the camera looks at most directly.
    const d = HOME_DIR
    const face = Math.abs(d.x) > Math.abs(d.z)
      ? new THREE.Vector3(Math.sign(d.x), 0, 0)
      : new THREE.Vector3(0, 0, Math.sign(d.z))
    const along = new THREE.Vector3(face.z, 0, -face.x) // wall-local +x after rotating +z onto `face`
    const half = face.x > 0 ? box.max.x - center.x : face.x < 0 ? center.x - box.min.x
      : face.z > 0 ? box.max.z - center.z : center.z - box.min.z
    const length = wallExtent(1, WALL_WIDTH).studs * model.unit
    const origin = new THREE.Vector3(center.x, box.min.y, center.z)
      .addScaledVector(face, half + WALL_GAP_STUDS * model.unit)
      .addScaledVector(along, -length / 2)
    const frame = new THREE.Matrix4().makeRotationY(Math.atan2(face.x, face.z)).setPosition(origin)

    const w = new FanWall({ geometry: type.geometry, colorFor, material, unit: model.unit, plate: model.plate, width: WALL_WIDTH, frame })
    scene.add(w.mesh)
    return w
  }

  function updateWallTag() {
    if (!wallTag || !wall) return
    const top = wall.extent()
    const c = top.getCenter(new THREE.Vector3())
    wallTag.position.set(c.x, top.max.y + model.unit * 2, c.z)
    wallTag.centroid.copy(c)
  }

  async function loadWall() {
    wall = buildWall()
    if (!wall) return
    wallUI = mountWallUI({
      root,
      onOpen: () => ui.closeCard(),
      onAdded: (saved) => { wall.addBrick(saved); updateWallTag(); setTimeout(() => playSound('place'), 620) },
    })
    const n = () => wall.bricks.length
    wallTag = ui.pushTag({
      key: 'fan-wall',
      label0: 'Fan wall',
      count: 0,
      centroid: new THREE.Vector3(),
      position: new THREE.Vector3(),
      label: () => `Fan wall · ${n()} brick${n() === 1 ? '' : 's'}`,
      onClick: () => wallUI.open(),
    })
    updateWallTag()
    let list = []
    try { list = await listBricks() } catch (err) { console.warn('[lego] fan wall:', err.message) }
    if (reducedMotion) {
      wall.setBricks(list)
      updateWallTag()
    } else {
      list.forEach((b, k) => setTimeout(() => { wall.addBrick(b); updateWallTag(); kick() }, k * WALL_STAGGER_MS))
    }
    kick()
  }

  // ── Frame loop (runs only while the section is on screen) ─────────────────
  function kick() {
    if (!raf && active) { last = performance.now(); raf = requestAnimationFrame(loop) }
  }

  function loop(now) {
    raf = 0
    if (!active) return
    raf = requestAnimationFrame(loop)
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000))
    last = now
    if (!pipeline) return

    if (assembly && assembly.begun && !assemblyDone) stepAssembly(dt)

    if (controls) {
      const moved = controls.update(dt)
      interaction.update(now)
      if (pointer.inside && (pointer.dirty || moved)) {
        raycaster.setFromCamera(pointer.ndc, camera)
        if (interaction.holding) {
          interaction.move(raycaster.ray)
          overWall = false
        } else {
          overWall = !!(wall && wall.pick(raycaster))
          interaction.hover(overWall ? null : raycaster.ray)
        }
        pointer.dirty = false
        canvas.classList.toggle('over-brick', interaction.hovered >= 0 || overWall)
        canvas.classList.toggle('holding', interaction.holding)
      }
    }
    wall?.update(now)

    sky.follow(camera)
    pipeline.render()
    ui?.updateTags(camera, root.clientWidth, root.clientHeight, metresPerUnit)
  }

  function onResize() {
    const w = root.clientWidth, h = root.clientHeight
    if (!w || !h) return
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
    renderer.setPixelRatio(dpr)
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    pipeline?.setSize(w, h, dpr)
  }
  new ResizeObserver(onResize).observe(root)
  onResize()

  // Wheel and fly keys only belong to the scene while the section fills the viewport.
  new IntersectionObserver(
    (entries) => { for (const e of entries) engaged = e.intersectionRatio >= 0.95 },
    { threshold: [0, 0.5, 0.9, 0.95, 1] },
  ).observe(root)

  return {
    start: () => { started = true; beginAssembly() },
    setActive: (v) => { active = !!v; if (active) kick() },
    hurryAssembly: () => { if (!assemblyDone) timeScale = HURRY },
    enableOrbit,
    setPath: () => {}, // kept for API compatibility; the camera is the engine's home view
    isAssembled: () => assemblyDone,
  }
}
