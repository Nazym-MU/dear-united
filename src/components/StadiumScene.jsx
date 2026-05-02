import { AdaptiveDpr } from '@react-three/drei'
import Stadium from './Stadium'
import CameraController from './CameraController'
import Lighting from './Lighting'

export default function StadiumScene({ scrollProgress, onLoaded }) {
  return (
    <>
      {/* No background color — canvas is alpha:true so text canvas shows through */}
      <AdaptiveDpr pixelated />
      <CameraController scrollProgress={scrollProgress} />
      <Lighting />
      <Stadium onLoaded={onLoaded} />
    </>
  )
}
