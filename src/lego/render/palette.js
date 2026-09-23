// Chrona-style palette mapping. Everything that turns a LEGO colour into an
// "ink illustration" colour lives here so it can be tuned in one place.
import * as THREE from 'three'

export const INK = new THREE.Color('#1f2437')          // outline colour (sRGB)
export const SKY_TOP = new THREE.Color('#161c2e')
export const SKY_HORIZON = new THREE.Color('#2c3550')
export const GROUND = new THREE.Color('#8792a8')       // pale blue-grey ground (sRGB)
export const GLOW = new THREE.Color('#ffd27a')         // warm window glow (sRGB)
export const HIGHLIGHT = new THREE.Color('#ffcf5c')    // hover tint (sRGB)

export const PALETTE = {
  desaturate: 0.35,                       // 0 = keep LEGO saturation, 1 = grey
  floor: new THREE.Color('#434c66'),      // what pure black becomes (dark navy-grey)
  ceil: new THREE.Color('#efe9dc'),       // what pure white becomes (paper cream)
  coolTint: new THREE.Color('#aab6cc'),   // pale blue-grey the whole scene leans to
  coolAmount: 0.12,
}

const _c = new THREE.Color()

/**
 * Map a LEGO material colour (LINEAR rgb 0..1, as stored in instances.json)
 * to the muted Chrona palette. Returns a THREE.Color in the working (linear) space,
 * ready to assign to material.color.
 */
export function inkColor(linearRGB, target = new THREE.Color()) {
  _c.setRGB(linearRGB[0], linearRGB[1], linearRGB[2], THREE.LinearSRGBColorSpace)
  // work perceptually (sRGB)
  const s = _c.getRGB({ r: 0, g: 0, b: 0 }, THREE.SRGBColorSpace)
  let r = s.r, g = s.g, b = s.b
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const d = PALETTE.desaturate
  r += (l - r) * d; g += (l - g) * d; b += (l - b) * d
  // lift: black -> floor, white -> ceil (per channel affine)
  const f = PALETTE.floor, c = PALETTE.ceil
  r = f.r + (c.r - f.r) * r
  g = f.g + (c.g - f.g) * g
  b = f.b + (c.b - f.b) * b
  const k = PALETTE.coolAmount, t = PALETTE.coolTint
  r += (t.r - r) * k; g += (t.g - g) * k; b += (t.b - b) * k
  return target.setRGB(r, g, b, THREE.SRGBColorSpace)
}

/** Warm "window" colours: yellows, oranges and beiges glow at night. */
export function isGlowColor(linearRGB, name = '') {
  if (/yellow|beige|tan\b|gold|lamp|flood/i.test(name)) return true
  _c.setRGB(linearRGB[0], linearRGB[1], linearRGB[2], THREE.LinearSRGBColorSpace)
  const hsl = _c.getHSL({ h: 0, s: 0, l: 0 }, THREE.SRGBColorSpace)
  return hsl.h > 0.09 && hsl.h < 0.17 && hsl.s > 0.35 && hsl.l > 0.45
}

// Same mapping in GLSL, used for textures (stickers). Operates on sRGB values.
export const INK_GLSL = /* glsl */`
uniform vec3 uInkFloor;
uniform vec3 uInkCeil;
uniform vec3 uInkCool;
uniform vec2 uInkAmt; // x = desaturate, y = cool amount
vec3 inkMapSRGB(vec3 s) {
  float l = dot(s, vec3(0.2126, 0.7152, 0.0722));
  s = mix(s, vec3(l), uInkAmt.x);
  s = uInkFloor + (uInkCeil - uInkFloor) * s;
  return mix(s, uInkCool, uInkAmt.y);
}`

export function inkUniforms() {
  return {
    uInkFloor: { value: new THREE.Vector3(...srgb(PALETTE.floor)) },
    uInkCeil: { value: new THREE.Vector3(...srgb(PALETTE.ceil)) },
    uInkCool: { value: new THREE.Vector3(...srgb(PALETTE.coolTint)) },
    uInkAmt: { value: new THREE.Vector2(PALETTE.desaturate, PALETTE.coolAmount) },
  }
}

function srgb(col) {
  const o = col.getRGB({ r: 0, g: 0, b: 0 }, THREE.SRGBColorSpace)
  return [o.r, o.g, o.b]
}
