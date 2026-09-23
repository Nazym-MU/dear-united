// Loader for the asset format in FORMAT.md (instances.json + instances.bin + types.glb).
// Output ("model") is the in-memory structure everything downstream consumes:
// { source, unit, plate, stud, types[{name,size,studs,geometry,map}], materials[{name,color,kind,opacity}],
//   groups[], count, bricks: Int32Array(3*count) [type, material, group], matrices: Float32Array(12*count), bounds }
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { createMockModel, computeBounds } from './mock.js'

export async function loadModel(base = 'models/lego/', { onProgress } = {}) {
  let json
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('mock')) return createMockModel()
  try {
    const res = await fetch(base + 'instances.json', { cache: 'no-cache' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    json = JSON.parse(await res.text()) // dev server may answer index.html with 200: parse fails -> mock
  } catch (err) {
    console.info('[lego] instances.json not available, using procedural mock:', err.message)
    return createMockModel()
  }

  const [bin, gltf] = await Promise.all([
    fetch(base + 'instances.bin').then((r) => {
      if (!r.ok) throw new Error(`instances.bin HTTP ${r.status}`)
      return r.arrayBuffer()
    }),
    // types.glb is ~97% of the download, so it drives the progress bar
    new GLTFLoader().loadAsync(base + 'types.glb', (e) => {
      if (onProgress && e.total > 0) onProgress(Math.min(0.99, e.loaded / e.total))
    }),
  ])

  const count = json.count ?? json.bricks.length
  const matrices = new Float32Array(bin, 0, count * 12)
  if (bin.byteLength < count * 48) throw new Error(`instances.bin has ${bin.byteLength / 48} rows, expected ${count}`)

  const bricks = new Int32Array(count * 3)
  json.bricks.forEach((b, i) => { bricks[3 * i] = b[0]; bricks[3 * i + 1] = b[1]; bricks[3 * i + 2] = b[2] ?? 0 })

  const meshes = await gltfMeshesByName(gltf)
  const types = json.types.map((t) => {
    const found = meshes.get(t.name)
    let geometry, map = null, parts = null
    if (found) ({ geometry, map, parts } = found)
    else {
      console.warn('[lego] type missing from types.glb, using its bbox:', t.name)
      geometry = new THREE.BoxGeometry(t.size[0], t.size[2], t.size[1])
    }
    if (!geometry.attributes.normal) geometry.computeVertexNormals()
    geometry.computeBoundingBox()
    return { name: t.name, size: t.size, studs: t.studs || [], geometry, map, parts, doubleSided: !!t.doubleSided }
  })

  const materials = json.materials.map((m) => ({
    name: m.name,
    color: m.color,
    kind: m.kind || 'opaque',
    opacity: m.opacity ?? (m.kind === 'glass' ? 0.34 : 1),
  }))

  const bounds = json.bounds || computeBounds(types, bricks, matrices)
  return {
    source: 'real',
    unit: json.unit ?? 0.0078, plate: json.plate ?? 0.0032, stud: json.stud ?? 0.0017,
    types, materials,
    groups: json.groups || [],
    count, bricks, matrices, bounds,
  }
}

// Map original glTF mesh / node names -> { geometry, map, parts }. GLTFLoader sanitises object
// names (drops ":" and "."), so read the original names from the parser's JSON.
//
// Multi-primitive meshes (sticker bricks: base colour + `stickers` texture; a few two-tone
// bricks) are merged WITH groups, one group per primitive, and `parts` describes each group
// so the brick store can give that InstancedMesh a material array: the textured primitive
// gets the sticker material, every other primitive the colour of its own glTF material
// (NOT the instance's material index, which the export sets to the dominant colour).
async function gltfMeshesByName(gltf) {
  const parser = gltf.parser
  const json = parser.json
  const objs = await parser.getDependencies('mesh')
  const out = new Map()
  const byIndex = []
  objs.forEach((obj, i) => {
    const prims = obj.isMesh ? [obj] : obj.children.filter((c) => c.isMesh)
    if (!prims.length) return
    let geometry = prims[0].geometry
    let parts = null
    if (prims.length > 1) {
      try {
        const merged = mergeGeometries(harmonise(prims.map((p) => p.geometry)), true)
        if (merged) {
          geometry = merged
          parts = prims.map((p) => {
            const m = p.material
            const c = m && m.color ? m.color : new THREE.Color(1, 1, 1)
            return { name: m?.name || '', color: [c.r, c.g, c.b], map: m && m.map ? m.map : null }
          })
        }
      } catch (err) { console.warn('[lego] could not merge primitives of', json.meshes[i].name, err) }
    }
    const withMap = prims.find((p) => p.material && p.material.map)
    const entry = { geometry, map: withMap ? withMap.material.map : null, parts }
    byIndex[i] = entry
    if (json.meshes[i].name) out.set(json.meshes[i].name, entry)
  })
  // node names are the type keys too (FORMAT.md: "Mesh/node names ARE the type keys")
  for (const n of json.nodes || []) {
    if (n.mesh != null && n.name && !out.has(n.name) && byIndex[n.mesh]) out.set(n.name, byIndex[n.mesh])
  }
  return out
}

// mergeGeometries needs identical attribute sets and consistent indexing across inputs.
function harmonise(geoms) {
  const names = new Set()
  for (const g of geoms) for (const n of Object.keys(g.attributes)) names.add(n)
  const indexed = geoms.some((g) => g.index)
  return geoms.map((g0) => {
    const g = g0.clone()
    const n = g.attributes.position.count
    for (const name of names) {
      if (g.attributes[name]) continue
      const ref = geoms.find((x) => x.attributes[name]).attributes[name]
      g.setAttribute(name, new THREE.BufferAttribute(new Float32Array(n * ref.itemSize), ref.itemSize))
    }
    if (indexed && !g.index) g.setIndex([...Array(n).keys()])
    return g
  })
}
