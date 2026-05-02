import { useState, useEffect, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import StadiumScene from './StadiumScene'
import LoadingScreen from './LoadingScreen'
import ScrollIndicator from './ScrollIndicator'
import TextCanvas from './TextCanvas'
import { stops, stands } from '../data/stands'

export default function App() {
  const [scrollProgress, setScrollProgress] = useState(0)
  const [activeStand, setActiveStand] = useState(0)
  const [loaded, setLoaded] = useState(false)

  const handleScroll = useCallback(() => {
    const scrollY = window.scrollY
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight
    if (maxScroll <= 0) return
    const progress = scrollY / maxScroll
    setScrollProgress(progress)

    // Determine which stop is active for the dot indicator
    const raw = progress * (stops.length - 1)
    setActiveStand(Math.min(Math.round(raw), stops.length - 1))
  }, [])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  return (
    <>
      <LoadingScreen loaded={loaded} />

      {/* Layer 0: ghost text behind the model */}
      <TextCanvas scrollProgress={scrollProgress} />

      {/* Layer 1: 3D model — transparent canvas so text shows through */}
      <div className="canvas-container">
        <Canvas
          camera={{ position: [0.55, 0.4, 0.55], fov: 45, near: 0.01, far: 100 }}
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        >
          <StadiumScene scrollProgress={scrollProgress} onLoaded={() => setLoaded(true)} />
        </Canvas>
      </div>

      {/* Layer 2: just the scroll indicator dots */}
      <ScrollIndicator activeStand={activeStand} />

      {/* Scrollable spacer — gives the page scroll height without any visible content */}
      <div className="scroll-spacer" />
    </>
  )
}
