import { useRef, useEffect } from 'react'
import gsap from 'gsap'

export default function StandSection({ stand, index }) {
  const contentRef = useRef()
  const animated = useRef(false)

  useEffect(() => {
    const el = contentRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !animated.current) {
          animated.current = true
          const children = el.querySelectorAll(
            '.stand-label, .stand-name, .stand-subtitle, .stand-divider, .stand-description, .stand-stats'
          )
          gsap.fromTo(
            children,
            { opacity: 0, y: 30 },
            { opacity: 1, y: 0, duration: 0.9, stagger: 0.1, ease: 'power3.out' }
          )
        }
        if (!entry.isIntersecting && animated.current) {
          animated.current = false
          const children = el.querySelectorAll(
            '.stand-label, .stand-name, .stand-subtitle, .stand-divider, .stand-description, .stand-stats'
          )
          gsap.to(children, {
            opacity: 0,
            y: -20,
            duration: 0.4,
            stagger: 0.04,
            ease: 'power2.in',
          })
        }
      },
      { threshold: 0.25 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section className="stand-section">
      <div className="stand-content" ref={contentRef}>
        <span className="stand-label">0{index + 1}&nbsp;/&nbsp;04</span>
        <h2 className="stand-name">{stand.name}</h2>
        <p className="stand-subtitle">{stand.subtitle}</p>
        <div className="stand-divider" />
        <p className="stand-description">{stand.description}</p>
        <div className="stand-stats">
          <div className="stand-stat">
            <span className="stand-stat-value">{stand.capacity}</span>
            <span className="stand-stat-label">Capacity</span>
          </div>
          <div className="stand-stat">
            <span className="stand-stat-value">{stand.year}</span>
            <span className="stand-stat-label">Built</span>
          </div>
        </div>
      </div>
    </section>
  )
}
