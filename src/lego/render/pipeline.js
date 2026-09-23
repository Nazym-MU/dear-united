// Two-pass ink renderer:
//   1. normals + depth of the brick scene (scene.overrideMaterial = MeshNormalMaterial, DepthTexture)
//   2. colour: sky scene, then the toon-shaded brick scene (MSAA, half-float, linear)
//   3. fullscreen composite: ink edges (depth Laplacian + normal difference, with a sketchy
//      wobble), paper grain, vignette, linear -> sRGB.
import * as THREE from 'three'
import { INK } from './palette.js'

const vert = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`

const frag = /* glsl */`
precision highp float;
uniform sampler2D tColor;
uniform sampler2D tNormal;
uniform sampler2D tDepth;
uniform vec2 uRes;          // render-target size in pixels
uniform float uNear, uFar;
uniform float uPixelK;      // world size of one pixel at view depth 1
uniform float uUnit;        // stud pitch (world)
uniform float uLine;        // line half-width in pixels
uniform float uWobble;      // wobble amplitude in pixels
uniform vec3 uInk;          // linear
uniform float uGrain;
uniform float uVignette;
uniform float uDebug;
varying vec2 vUv;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
// perspective NDC depth is affine in w = 1/z, so its Laplacian vanishes on planes
float invZ(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  float z = (uNear * uFar) / ((uFar - uNear) * d - uFar); // view z (negative)
  return -1.0 / z;
}
vec3 nrm(vec2 uv) { return texture2D(tNormal, uv).xyz * 2.0 - 1.0; }

vec3 toSRGB(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec2 px = 1.0 / uRes;
  vec2 fc = gl_FragCoord.xy;
  // hand-drawn wobble: smooth, static low-frequency offset of the sample footprint
  vec2 wob = vec2(vnoise(fc * 0.045), vnoise(fc * 0.045 + 17.3)) - 0.5;
  // snap to texel centres so the Laplacian stays symmetric (nearest-filtered targets)
  vec2 uv = (floor(fc + wob * 2.0 * uWobble) + 0.5) * px;
  vec2 dx = vec2(uLine * px.x, 0.0), dy = vec2(0.0, uLine * px.y);

  float wc = invZ(uv), wl = invZ(uv - dx), wr = invZ(uv + dx), wd = invZ(uv - dy), wu = invZ(uv + dy);
  float zc = 1.0 / max(wc, 1e-6);
  // diagonal Laplacian as well, so 45° silhouettes are as thick as axis-aligned ones
  float wa = invZ(uv - dx - dy), wb = invZ(uv + dx + dy), wc2 = invZ(uv - dx + dy), wd2 = invZ(uv + dx - dy);
  float lap = max(max(abs(wl + wr - 2.0 * wc), abs(wd + wu - 2.0 * wc)),
                  0.7 * max(abs(wa + wb - 2.0 * wc), abs(wc2 + wd2 - 2.0 * wc)));
  float rel = lap / max(wc, 1e-6);                 // ≈ depth jump / depth
  float tRel = max(0.0032 / zc, 0.0025);           // ~⅓ brick in world units, floor for precision
  float depthEdge = smoothstep(tRel, tRel * 2.0, rel);
  // silhouettes against the sky: always ink
  float sky = step(0.99999, texture2D(tDepth, vUv).x);

  vec3 nc = nrm(uv);
  float nd = max(max(length(nc - nrm(uv - dx)), length(nc - nrm(uv + dx))),
                 max(length(nc - nrm(uv - dy)), length(nc - nrm(uv + dy))));
  // fade crease lines when a stud is only a few pixels wide (keeps overview clean)
  float studPx = uUnit / (zc * uPixelK);
  float detail = smoothstep(4.0, 10.0, studPx);
  float normalEdge = smoothstep(0.38, 0.55, nd) * mix(0.35, 1.0, detail);
  if (sky > 0.5) normalEdge = 0.0;

  float edge = clamp(max(depthEdge, normalEdge), 0.0, 1.0);
  // line pressure varies a little along the stroke
  edge *= 0.82 + 0.18 * vnoise(fc * 0.11 + 3.1);

  vec3 col = texture2D(tColor, vUv).rgb;
  col = mix(col, uInk, edge * 0.92);
  vec3 s = toSRGB(col);

  // paper grain (static) + fine fibre noise
  float g = hash(fc) * 0.7 + vnoise(fc * 0.35) * 0.3;
  s += (g - 0.5) * uGrain;
  // vignette
  vec2 q = vUv - 0.5;
  s *= 1.0 - uVignette * smoothstep(0.25, 0.85, length(q * vec2(1.25, 1.0)));

  if (uDebug > 0.5 && uDebug < 1.5) s = vec3(edge);
  if (uDebug > 1.5) s = texture2D(tNormal, vUv).xyz;
  gl_FragColor = vec4(s, 1.0);
}`

export class InkPipeline {
  constructor(renderer, { scene, sky, camera, unit }) {
    this.renderer = renderer
    this.scene = scene
    this.sky = sky
    this.camera = camera
    this.normalMaterial = new THREE.MeshNormalMaterial()
    this.hideInNormalPass = [] // objects (e.g. glass meshes) that should not produce ink

    this.normalRT = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.UnsignedByteType,
      depthTexture: new THREE.DepthTexture(1, 1, THREE.FloatType),
    })
    this.normalRT.texture.minFilter = this.normalRT.texture.magFilter = THREE.NearestFilter
    this.normalRT.depthTexture.minFilter = this.normalRT.depthTexture.magFilter = THREE.NearestFilter

    this.colorRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 })

    this.quadScene = new THREE.Scene()
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    this.uniforms = {
      tColor: { value: this.colorRT.texture },
      tNormal: { value: this.normalRT.texture },
      tDepth: { value: this.normalRT.depthTexture },
      uRes: { value: new THREE.Vector2(1, 1) },
      uNear: { value: camera.near },
      uFar: { value: camera.far },
      uPixelK: { value: 1 },
      uUnit: { value: unit },
      uLine: { value: 1.2 },
      uWobble: { value: 0.9 },
      uInk: { value: INK.clone() },   // THREE.Color holds linear
      uGrain: { value: 0.06 },
      uVignette: { value: 0.28 },
      uDebug: { value: 0 },
    }
    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: vert, fragmentShader: frag, depthTest: false, depthWrite: false })
    )
    quad.frustumCulled = false
    this.quadScene.add(quad)
  }

  setSize(width, height, pixelRatio) {
    const w = Math.max(1, Math.floor(width * pixelRatio)), h = Math.max(1, Math.floor(height * pixelRatio))
    this.normalRT.setSize(w, h)
    this.colorRT.setSize(w, h)
    this.uniforms.uRes.value.set(w, h)
    // ~1.2 CSS px lines: sample distance in device pixels
    this.uniforms.uLine.value = Math.max(1, Math.round(0.85 * pixelRatio))
    this.uniforms.uWobble.value = 0.8 * pixelRatio
  }

  render() {
    const { renderer, scene, camera, uniforms } = this
    uniforms.uNear.value = camera.near
    uniforms.uFar.value = camera.far
    uniforms.uPixelK.value = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / uniforms.uRes.value.y

    // 1. normals + depth
    const bg = scene.background, fog = scene.fog
    scene.background = null
    scene.fog = null
    scene.overrideMaterial = this.normalMaterial
    for (const o of this.hideInNormalPass) o.visible = false
    renderer.setRenderTarget(this.normalRT)
    renderer.setClearColor(0x000000, 1)
    renderer.clear()
    renderer.render(scene, camera)
    for (const o of this.hideInNormalPass) o.visible = true
    scene.overrideMaterial = null
    scene.fog = fog
    scene.background = bg

    // 2. colour: sky first, then the scene on top
    renderer.setRenderTarget(this.colorRT)
    renderer.clear()
    if (this.sky) renderer.render(this.sky, camera)
    renderer.clearDepth()
    renderer.render(scene, camera)

    // 3. composite to screen
    renderer.setRenderTarget(null)
    renderer.render(this.quadScene, this.quadCam)
  }
}
