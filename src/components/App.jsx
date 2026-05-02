import { useState, useEffect, useRef, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import gsap from 'gsap'
import StadiumScene from './StadiumScene'
import LoadingScreen from './LoadingScreen'
import StandSection from './StandSection'
import ScrollIndicator from './ScrollIndicator'
import { stands } from '../data/stands'

export default function App() {
  const [scrollProgress, setScrollProgress] = useState(0)
  const [activeStand, setActiveStand] = useState(-1)
  const [loaded, setLoaded] = useState(false)
  const heroRef = useRef()
  const outroRef = useRef()

  useEffect(() => {
    if (!loaded) return
    const hero = heroRef.current
    if (!hero) return
    const els = hero.querySelectorAll('.hero-title, .subtitle, .stats, .scroll-hint')
    gsap.fromTo(
      els,
      { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: 1, stagger: 0.2, ease: 'power2.out', delay: 0.5 }
    )

    const outro = outroRef.current
    if (!outro) return
    const outroObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const outroEls = outro.querySelectorAll('h2, p')
          gsap.fromTo(outroEls, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.15, ease: 'power2.out' })
        }
      },
      { threshold: 0.3 }
    )
    outroObserver.observe(outro)
    return () => outroObserver.disconnect()
  }, [loaded])

  const handleScroll = useCallback(() => {
    const scrollY = window.scrollY
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight
    if (maxScroll <= 0) return
    setScrollProgress(scrollY / maxScroll)

    const heroBottom = heroRef.current?.getBoundingClientRect().bottom ?? 0
    const outroTop = outroRef.current?.getBoundingClientRect().top ?? Infinity

    if (heroBottom > window.innerHeight * 0.5) {
      setActiveStand(-1)
    } else if (outroTop < window.innerHeight * 0.5) {
      setActiveStand(stands.length)
    } else {
      const sectionHeight = 200
      const scrolledPastHero = scrollY - window.innerHeight
      const idx = Math.floor(scrolledPastHero / (window.innerHeight * 2))
      setActiveStand(Math.max(0, Math.min(idx, stands.length - 1)))
    }
  }, [])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  return (
    <>
      <LoadingScreen loaded={loaded} />

      <div className="canvas-container">
        <Canvas
          camera={{ position: [0.55, 0.4, 0.55], fov: 45, near: 0.01, far: 100 }}
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        >
          <StadiumScene scrollProgress={scrollProgress} onLoaded={() => setLoaded(true)} />
        </Canvas>
      </div>

      <ScrollIndicator activeStand={activeStand} />

      <div className="scroll-container">
        <section className="hero" ref={heroRef}>
          <h1 className="hero-title">OLD TRAFFORD</h1>
          <p className="subtitle">The Theatre of Dreams</p>
          <p className="stats">Est. 1910 &mdash; Capacity 74,310</p>
          <div className="scroll-hint">
            <span>Scroll to explore</span>
            <div className="scroll-line" />
          </div>
        </section>

        {stands.map((stand, i) => (
          <StandSection key={stand.id} stand={stand} index={i} />
        ))}

        <section className="outro" ref={outroRef}>
          <h2>"The Theatre of Dreams"</h2>
          <p>74,310 seats &middot; One dream</p>
        </section>
      </div>
    </>
  )
}
