import { stands } from '../data/stands'

export default function ScrollIndicator({ activeStand }) {
  const handleClick = (i) => {
    const heroHeight = window.innerHeight
    const sectionHeight = window.innerHeight * 2
    const target = heroHeight + i * sectionHeight + sectionHeight * 0.3
    window.scrollTo({ top: target, behavior: 'smooth' })
  }

  return (
    <nav className="scroll-indicator">
      {stands.map((stand, i) => (
        <button
          key={stand.id}
          className={`scroll-dot ${i === activeStand ? 'active' : ''}`}
          onClick={() => handleClick(i)}
          aria-label={stand.name}
        />
      ))}
    </nav>
  )
}
