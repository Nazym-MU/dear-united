import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3, MathUtils } from 'three'
import { stops } from '../data/stands'

const waypoints = stops.map((s) => ({
  position: new Vector3(...s.camera.position),
  lookAt: new Vector3(...s.camera.lookAt),
}))

function smoothstep(t) {
  const c = Math.max(0, Math.min(1, t))
  return c * c * (3 - 2 * c)
}

export default function CameraController({ scrollProgress }) {
  const { camera } = useThree()
  const smoothed = useRef(0)
  const targetPos = useRef(new Vector3())
  const targetLook = useRef(new Vector3())
  const curLook = useRef(new Vector3(0.04, 0.08, 0.1))

  useFrame((_, delta) => {
    // Smooth the raw scroll so fast scrolling never snaps the camera
    smoothed.current = MathUtils.lerp(
      smoothed.current,
      scrollProgress,
      1 - Math.pow(0.14, delta)
    )

    const total = waypoints.length - 1
    const raw = smoothed.current * total
    const idx = Math.min(Math.floor(raw), total - 1)
    const t = smoothstep(raw - idx)

    const from = waypoints[idx]
    const to = waypoints[Math.min(idx + 1, waypoints.length - 1)]

    targetPos.current.lerpVectors(from.position, to.position, t)
    targetLook.current.lerpVectors(from.lookAt, to.lookAt, t)

    // Physical glide — camera trails the target
    camera.position.lerp(targetPos.current, 1 - Math.pow(0.001, delta))
    curLook.current.lerp(targetLook.current, 1 - Math.pow(0.001, delta))
    camera.lookAt(curLook.current)
  })

  return null
}
