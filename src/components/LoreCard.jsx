import { useRef, useEffect, useState, useCallback } from 'react'
import { prepare, layout } from '@chenglou/pretext'
import gsap from 'gsap'

/**
 * A lore card that uses @chenglou/pretext to measure text height without DOM
 * reflow, so we can pre-size the card before it paints and avoid layout shift.
 */
export default function LoreCard({ lore, visible, delay = 0 }) {
  const cardRef = useRef()
  const [bodyHeight, setBodyHeight] = useState(null)
  const animatedIn = useRef(false)

  // Measure text height with pretext — pure arithmetic, no DOM reflow
  const measureText = useCallback(() => {
    const cardWidth = cardRef.current?.offsetWidth ?? 360
    const textWidth = cardWidth - 48 // 24px padding each side
    const prepared = prepare(lore.body, '13px Inter')
    const { height } = layout(prepared, textWidth, 20) // 20px line height
    setBodyHeight(height)
  }, [lore.body])

  useEffect(() => {
    measureText()
    const ro = new ResizeObserver(measureText)
    if (cardRef.current) ro.observe(cardRef.current)
    return () => ro.disconnect()
  }, [measureText])

  useEffect(() => {
    const el = cardRef.current
    if (!el) return

    if (visible && !animatedIn.current) {
      animatedIn.current = true
      gsap.fromTo(
        el,
        { opacity: 0, x: 24 },
        { opacity: 1, x: 0, duration: 0.6, delay, ease: 'power2.out' }
      )
    } else if (!visible && animatedIn.current) {
      animatedIn.current = false
      gsap.to(el, { opacity: 0, x: 16, duration: 0.35, ease: 'power2.in' })
    }
  }, [visible])

  return (
    <div className="lore-card" ref={cardRef}>
      <span className="lore-pretext">{lore.pretext}</span>
      <h4 className="lore-heading">{lore.heading}</h4>
      <p
        className="lore-body"
        style={bodyHeight != null ? { height: bodyHeight, overflow: 'hidden' } : undefined}
      >
        {lore.body}
      </p>
    </div>
  )
}
