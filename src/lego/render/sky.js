// Night sky (gradient dome + faint stars), ground plane and lights.
import * as THREE from 'three'
import { SKY_TOP, SKY_HORIZON, GROUND } from './palette.js'
import { toonGradient } from './materials.js'

export function createSky(radius) {
  const sky = new THREE.Scene()
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { uTop: { value: SKY_TOP.clone() }, uHorizon: { value: SKY_HORIZON.clone() } },
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */`
        uniform vec3 uTop, uHorizon; varying vec3 vDir;
        void main() {
          float t = smoothstep(-0.02, 0.55, vDir.y);
          gl_FragColor = vec4(mix(uHorizon, uTop, t), 1.0); // linear; composite converts
        }`,
    })
  )
  dome.frustumCulled = false
  sky.add(dome)

  // ~150 faint stars, upper hemisphere, deterministic
  const n = 150
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3)
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < n; i++) {
    const u = rnd(), v = 0.015 + 0.985 * Math.pow(rnd(), 2.2) // bias toward the horizon, where the sky usually shows
    const th = u * Math.PI * 2, y = v, r = Math.sqrt(1 - y * y)
    pos.set([Math.cos(th) * r * radius * 0.9, y * radius * 0.9, Math.sin(th) * r * radius * 0.9], i * 3)
    const b = 0.35 + 0.6 * rnd() * rnd()
    col.set([b * 0.95, b * 0.97, b], i * 3)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  const stars = new THREE.Points(g, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, depthWrite: false, fog: false }))
  stars.frustumCulled = false
  sky.add(stars)

  sky.follow = (camera) => {
    dome.position.copy(camera.position)
    stars.position.copy(camera.position)
  }
  return sky
}

export function createGround(y, size) {
  const m = new THREE.MeshToonMaterial({ color: GROUND.clone(), gradientMap: toonGradient() })
  const ground = new THREE.Mesh(new THREE.CircleGeometry(size, 64), m)
  ground.rotation.x = -Math.PI / 2
  ground.position.y = y
  ground.name = 'ground'
  return ground
}

export function createLights(center, radius) {
  const group = new THREE.Group()
  const hemi = new THREE.HemisphereLight(0xc9d4ec, 0x4a5068, 1.15)
  const moon = new THREE.DirectionalLight(0xf2f0ff, 1.6)
  moon.position.set(center.x - radius * 0.6, center.y + radius * 1.4, center.z + radius * 0.9)
  moon.target.position.copy(center)
  group.add(hemi, moon, moon.target)
  return group
}
