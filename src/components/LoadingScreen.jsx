import { useProgress } from '@react-three/drei'

export default function LoadingScreen({ loaded }) {
  const { progress } = useProgress()

  return (
    <div className={`loading-screen ${loaded ? 'hidden' : ''}`}>
      <h1 className="loading-title">OLD TRAFFORD</h1>
      <p className="loading-subtitle">Loading the Theatre of Dreams...</p>
      <div className="loading-bar-container">
        <div className="loading-bar" style={{ width: `${progress}%` }} />
      </div>
      <span className="loading-percent">{Math.round(progress)}%</span>
    </div>
  )
}
