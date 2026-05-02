import { stops } from '../data/stands'

export default function ScrollIndicator({ activeStand }) {
  const handleClick = (i) => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight
    const target = (i / (stops.length - 1)) * maxScroll
    window.scrollTo({ top: target, behavior: 'smooth' })
  }

  return (
    <nav className="scroll-indicator">
      {stops.map((stop, i) => (
        <button
          key={stop.id}
          className={`scroll-dot ${i === activeStand ? 'active' : ''}`}
          onClick={() => handleClick(i)}
          aria-label={stop.id}
        />
      ))}
    </nav>
  )
}
