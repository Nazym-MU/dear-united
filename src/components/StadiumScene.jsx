import { useEffect } from 'react'
import { AdaptiveDpr } from '@react-three/drei'
import Stadium from './Stadium'
import CameraController from './CameraController'
import Lighting from './Lighting'

export default function StadiumScene({ scrollProgress, onLoaded }) {
  return (
    <>
      <color attach="background" args={['#0a0a0a']} />
      <fog attach="fog" args={['#0a0a0a', 0.8, 2.5]} />
      <AdaptiveDpr pixelated />
      <CameraController scrollProgress={scrollProgress} />
      <Lighting scrollProgress={scrollProgress} />
      <Stadium onLoaded={onLoaded} />
    </>
  )
}
