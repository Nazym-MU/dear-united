// Procedural stand-in for the real asset files (see FORMAT.md). Produces exactly the
// same in-memory model as loadModel() in format.js, so nothing downstream can tell.
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

const UNIT = 0.0078, PLATE = 0.0032, STUD = 0.0017
const SXZ = 0.0039, SY = 0.0016           // object scale, FORMAT.md
const STUD_H = 1.0625, STUD_R = 0.62      // unit space

/**
 * Unit-space brick: A studs along x, B studs along (three) z, C plates tall.
 * x ∈ [−A, A], z ∈ [−B, B], y ∈ [0, 2C] plus 12-segment studs on top.
 * Centred on purpose; the viewer never assumes where a type's origin is.
 */
export function brickGeometry(A, B, C, { studs = true } = {}) {
  const h = 2 * C
  const parts = []
  const box = new THREE.BoxGeometry(2 * A, h, 2 * B)
  box.translate(0, h / 2, 0)
  parts.push(box)
  const studList = []
  if (studs) {
    for (let i = 0; i < A; i++) for (let j = 0; j < B; j++) {
      const x = -A + 1 + 2 * i, z = -B + 1 + 2 * j
      const side = new THREE.CylinderGeometry(STUD_R, STUD_R, STUD_H, 12, 1, true)
      side.translate(x, h + STUD_H / 2, z)
      const cap = new THREE.CircleGeometry(STUD_R, 12)
      cap.rotateX(-Math.PI / 2)
      cap.translate(x, h + STUD_H, z)
      parts.push(side, cap)
      studList.push([x, -z]) // FORMAT.md stores studs in Blender unit (x, y); y_blender = −z_three
    }
  }
  for (const p of parts) p.deleteAttribute('uv')
  const g = mergeGeometries(parts, false)
  parts.forEach((p) => p.dispose())
  g.computeBoundingBox()
  return { geometry: g, studs: studList, size: [2 * A, 2 * B, h + (studs ? STUD_H : 0)] }
}

// LEGO colours, LINEAR rgb as in instances.json
const MATERIALS = [
  { name: 'red', color: [0.58, 0.012, 0.004], kind: 'opaque' },
  { name: 'white', color: [0.88, 0.87, 0.84], kind: 'opaque' },
  { name: 'light-grey', color: [0.35, 0.37, 0.4], kind: 'opaque' },
  { name: 'dark-grey', color: [0.11, 0.105, 0.115], kind: 'opaque' },
  { name: 'black', color: [0.008, 0.008, 0.01], kind: 'opaque' },
  { name: 'green', color: [0.02, 0.2, 0.05], kind: 'opaque' },
  { name: 'dark-green', color: [0.01, 0.075, 0.03], kind: 'opaque' },
  { name: 'yellow', color: [0.89, 0.61, 0.04], kind: 'opaque' },
  { name: 'glass', color: [0.55, 0.66, 0.78], kind: 'glass', opacity: 0.34 },
]
const M = Object.fromEntries(MATERIALS.map((m, i) => [m.name, i]))
const GROUPS = ['Field', 'East-Stand', 'Seats-East-Stand', 'Stretford-End', 'Stretford-End-seats', 'SAF-stand', 'SBC-stand']
const G = Object.fromEntries(GROUPS.map((g, i) => [g, i]))

export function createMockModel() {
  const types = []
  const typeIndex = new Map()
  const bricks = []
  const mats = []
  const m4 = new THREE.Matrix4(), rot = new THREE.Matrix4(), scl = new THREE.Matrix4().makeScale(SXZ, SY, SXZ)

  function type(name) {
    if (typeIndex.has(name)) return typeIndex.get(name)
    const [dims, variant] = name.split('-')
    const [A, B, C] = dims.split('x').map(Number)
    const { geometry, studs, size } = brickGeometry(A, B, C, { studs: variant !== 'tile' })
    types.push({ name, size, studs, geometry, map: null })
    typeIndex.set(name, types.length - 1)
    return types.length - 1
  }

  // gx, gz: stud coords of the footprint's min corner; level in plates; r = quarter turns
  function place(name, mat, group, gx, gz, level, r = 0) {
    const t = type(name)
    const [A, B] = name.split('-')[0].split('x').map(Number)
    const fx = r % 2 ? B : A, fz = r % 2 ? A : B
    m4.makeTranslation((gx + fx / 2) * UNIT, level * PLATE, (gz + fz / 2) * UNIT)
    rot.makeRotationY((r * Math.PI) / 2)
    m4.multiply(rot).multiply(scl)
    const e = m4.elements // column-major -> row-major 3x4
    mats.push(e[0], e[4], e[8], e[12], e[1], e[5], e[9], e[13], e[2], e[6], e[10], e[14])
    bricks.push(t, mat, group)
  }

  // ---- pitch: 40 x 64 studs of 2x4 plates, mowing stripes every 8 studs ----
  const PX = 20, PZ = 32
  for (let x = -PX; x < PX; x += 2) for (let z = -PZ; z < PZ; z += 4) {
    const stripe = Math.floor((z + PZ) / 8) % 2
    place('2x4x1', stripe ? M['dark-green'] : M.green, G.Field, x, z, 0)
  }
  for (let x = -PX; x < PX; x += 4) place('4x1x1-tile', M.white, G.Field, x, 0, 1)     // halfway line
  for (let z = -PZ; z < PZ; z += 4) {                                                   // touchlines
    place('1x4x1-tile', M.white, G.Field, -PX, z, 1)
    place('1x4x1-tile', M.white, G.Field, PX - 1, z, 1)
  }
  for (let x = -PX; x < PX; x += 4) {
    place('4x1x1-tile', M.white, G.Field, x, -PZ, 1)
    place('4x1x1-tile', M.white, G.Field, x, PZ - 1, 1)
  }
  // surround ring (2 studs)
  for (let z = -PZ - 2; z < PZ + 2; z += 4) {
    place('2x4x1', M['light-grey'], G.Field, -PX - 2, z, 0)
    place('2x4x1', M['light-grey'], G.Field, PX, z, 0)
  }
  for (let x = -PX; x < PX; x += 4) {
    place('2x4x1', M['light-grey'], G.Field, x, -PZ - 2, 0, 1)
    place('2x4x1', M['light-grey'], G.Field, x, PZ, 0, 1)
  }

  // ---- stands ----
  // side: W (SAF, x−), E (SBC, x+), S (Stretford End, z+), N (East Stand, z−)
  function stand({ side, tiers, group, seatGroup }) {
    const alongZ = side === 'W' || side === 'E'
    const half = alongZ ? PZ : PX
    const o0 = (alongZ ? PX : PZ) + 3
    const r = alongZ ? 0 : 1
    // footprint: `len` studs along the stand, `depth` studs outward, at tangent t / outward o
    const put = (name, mat, grp, t, o, depth, level) => {
      if (side === 'W') place(name, mat, grp, -(o + depth), t, level, r)
      else if (side === 'E') place(name, mat, grp, o, t, level, r)
      else if (side === 'S') place(name, mat, grp, t, o, level, r)
      else place(name, mat, grp, t, -(o + depth), level, r)
    }
    // low wall facing the pitch
    for (let t = -half; t < half; t += 4) put('1x4x1', M['dark-grey'], G[group], t, o0 - 1, 1, 0)
    // raked seating: one 1-stud row per tier, 3 plates up per tier
    for (let k = 0; k < tiers; k++) {
      for (let t = -half; t < half; t += 2) {
        const aisle = (t + half) % 16 === 14
        const band = k % 6 === 5
        const mat = aisle ? M['dark-grey'] : band ? M.white : M.red
        put('1x2x3', mat, G[seatGroup], t, o0 + k, 1, 3 * k)
      }
    }
    // back wall (white structure, glass band of boxes near the top)
    const rows = tiers + 3
    for (let k = 0; k < rows; k++) {
      for (let t = -half; t < half; t += 8) {
        const glass = k === tiers - 2 || k === tiers - 1
        const mat = glass ? M.glass : k % 4 === 3 ? M['light-grey'] : M.white
        put('1x8x3', mat, G[group], t, o0 + tiers, 1, 3 * k)
      }
    }
    // cantilever roof: black 4x8 plates reaching back over the seats
    const roofRows = Math.ceil((tiers * 0.85) / 4)
    for (let rr = 0; rr < roofRows; rr++) {
      for (let t = -half; t < half; t += 8) put('4x8x1', M.black, G[group], t, o0 + tiers + 1 - 4 * (rr + 1), 4, 3 * rows)
    }
    // fascia along the roof front
    for (let t = -half; t < half; t += 8) put('1x8x3', M['light-grey'], G[group], t, o0 + tiers + 1 - 4 * roofRows - 1, 1, 3 * rows - 3)
  }
  stand({ side: 'W', tiers: 18, group: 'SAF-stand', seatGroup: 'SAF-stand' })
  stand({ side: 'E', tiers: 12, group: 'SBC-stand', seatGroup: 'SBC-stand' })
  stand({ side: 'S', tiers: 14, group: 'Stretford-End', seatGroup: 'Stretford-End-seats' })
  stand({ side: 'N', tiers: 14, group: 'East-Stand', seatGroup: 'Seats-East-Stand' })

  // ---- floodlight towers in the open corners ----
  const corners = [[-PX - 18, -PZ - 18, 'SAF-stand'], [PX + 14, -PZ - 18, 'East-Stand'], [-PX - 18, PZ + 14, 'Stretford-End'], [PX + 14, PZ + 14, 'SBC-stand']]
  for (const [x, z, grp] of corners) {
    for (let k = 0; k < 22; k++) place('2x2x3', M['light-grey'], G[grp], x + 1, z + 1, 3 * k)
    for (let k = 0; k < 3; k++) place('4x4x1', M.yellow, G[grp], x, z, 66 + k)
    place('4x4x1', M.black, G[grp], x, z, 69)
  }

  const count = bricks.length / 3
  const matrices = new Float32Array(mats)
  return {
    source: 'mock',
    unit: UNIT, plate: PLATE, stud: STUD,
    types,
    materials: MATERIALS.map((m) => ({ ...m })),
    groups: GROUPS.slice(),
    count,
    bricks: Int32Array.from(bricks),
    matrices,
    bounds: computeBounds(types, Int32Array.from(bricks), matrices),
  }
}

export function computeBounds(types, bricks, matrices) {
  const box = new THREE.Box3(), b = new THREE.Box3(), m = new THREE.Matrix4()
  const n = matrices.length / 12
  for (let i = 0; i < n; i++) {
    const g = types[bricks[3 * i]].geometry
    if (!g.boundingBox) g.computeBoundingBox()
    const o = 12 * i, a = matrices
    m.set(a[o], a[o + 1], a[o + 2], a[o + 3], a[o + 4], a[o + 5], a[o + 6], a[o + 7], a[o + 8], a[o + 9], a[o + 10], a[o + 11], 0, 0, 0, 1)
    box.union(b.copy(g.boundingBox).applyMatrix4(m))
  }
  return { min: box.min.toArray(), max: box.max.toArray() }
}
