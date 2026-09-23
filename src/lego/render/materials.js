// Toon materials for bricks. Per-instance highlight is encoded in instanceColor.r
// (0 = normal, 1 = full highlight) and applied by a small shader patch, so any
// brick colour (including dark navy) can be tinted toward warm yellow.
import * as THREE from 'three'
import { inkColor, isGlowColor, GLOW, HIGHLIGHT, INK_GLSL, inkUniforms } from './palette.js'

let gradientMap = null
export function toonGradient() {
  if (gradientMap) return gradientMap
  // Low-contrast Chrona bands: 0.55 / 0.8 / 1.0
  const data = new Uint8Array([0.55, 0.8, 1.0].map((v) => Math.round(v * 255)))
  gradientMap = new THREE.DataTexture(data, 3, 1, THREE.RedFormat)
  gradientMap.minFilter = gradientMap.magFilter = THREE.NearestFilter
  gradientMap.generateMipmaps = false
  gradientMap.needsUpdate = true
  return gradientMap
}

const highlightUniform = { value: HIGHLIGHT.clone() }

function patch(material, { inkTexture = false } = {}) {
  const ink = inkUniforms()
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uHighlight = highlightUniform
    Object.assign(shader.uniforms, ink)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uHighlight;\n' + (inkTexture ? INK_GLSL : ''))
      .replace(
        '#include <map_fragment>',
        inkTexture
          ? `#ifdef USE_MAP
  vec4 texel = texture2D( map, vMapUv );
  // texture is decoded to linear; map through the palette in sRGB, then back
  vec3 s = inkMapSRGB( pow( texel.rgb, vec3( 1.0 / 2.2 ) ) );
  diffuseColor.rgb *= pow( s, vec3( 2.2 ) );
#endif`
          : '#include <map_fragment>'
      )
      .replace(
        '#include <color_fragment>',
        `#if defined( USE_COLOR )
  diffuseColor.rgb = mix( diffuseColor.rgb, uHighlight, vColor.r * 0.75 );
  totalEmissiveRadiance += uHighlight * vColor.r * 0.35;
#endif`
      )
  }
  material.customProgramCacheKey = () => (inkTexture ? 'brick-ink-tex' : 'brick')
  return material
}

/**
 * Build the material for one entry of instances.json `materials`.
 * `map` is the sticker texture from types.glb (only for kind === 'sticker').
 */
export function createBrickMaterial(def, map = null) {
  const kind = def.kind || 'opaque'
  const m = new THREE.MeshToonMaterial({
    color: inkColor(def.color),
    gradientMap: toonGradient(),
  })
  m.name = def.name
  if (kind === 'glass') {
    m.transparent = true
    m.opacity = def.opacity ?? 0.35
    m.depthWrite = false
    m.emissive = GLOW.clone().multiplyScalar(0.18) // lit interiors read through glass
  } else if (kind === 'sticker' && map) {
    m.map = map
    m.color.set(0xffffff)
  }
  if (kind !== 'glass' && isGlowColor(def.color, def.name)) {
    m.color.copy(GLOW)
    m.emissive = GLOW.clone().multiplyScalar(0.55)
  }
  return patch(m, { inkTexture: !!m.map })
}

export function setHighlightColor(c) {
  highlightUniform.value.set(c)
}
