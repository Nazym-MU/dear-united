import { useEffect } from 'react'
import { useGLTF } from '@react-three/drei'

useGLTF.preload('/models/old-trafford.glb')

export default function Stadium({ onLoaded }) {
  const { scene } = useGLTF('/models/old-trafford.glb')

  useEffect(() => {
    if (scene) onLoaded()
  }, [scene, onLoaded])

  return <primitive object={scene} />
}
