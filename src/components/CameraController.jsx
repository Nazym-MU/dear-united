import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { stands } from '../data/stands'

const heroCamera = {
  position: new Vector3(0.55, 0.4, 0.55),
  lookAt: new Vector3(0.04, 0.05, 0.1),
}

const outroCamera = {
  position: new Vector3(0, 0.6, 0),
  lookAt: new Vector3(0.04, 0.05, 0.1),
}

const standCameras = stands.map((s) => ({
  position: new Vector3(...s.camera.position),
  lookAt: new Vector3(...s.camera.lookAt),
}))

const allWaypoints = [heroCamera, ...standCameras, outroCamera]

export default function CameraController({ scrollProgress }) {
  const { camera } = useThree()
  const targetPos = useRef(new Vector3())
  const targetLook = useRef(new Vector3())
  const currentLook = useRef(new Vector3(0.04, 0.08, 0.1))

  useFrame((_, delta) => {
    const totalSegments = allWaypoints.length - 1
    const raw = scrollProgress * totalSegments
    const idx = Math.min(Math.floor(raw), totalSegments - 1)
    const t = raw - idx

    const from = allWaypoints[idx]
    const to = allWaypoints[Math.min(idx + 1, allWaypoints.length - 1)]

    targetPos.current.lerpVectors(from.position, to.position, t)
    targetLook.current.lerpVectors(from.lookAt, to.lookAt, t)

    camera.position.lerp(targetPos.current, 1 - Math.pow(0.001, delta))
    currentLook.current.lerp(targetLook.current, 1 - Math.pow(0.001, delta))
    camera.lookAt(currentLook.current)
  })

  return null
}
