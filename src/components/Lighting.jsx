export default function Lighting() {
  return (
    <>
      <ambientLight intensity={0.15} color="#b8c4d4" />
      <directionalLight position={[2, 4, 1]} intensity={1.3} color="#fff5e6" />
      <directionalLight position={[-2, 3, -1]} intensity={0.4} color="#d4e0ff" />
      <pointLight position={[0, 0.5, 0]} intensity={0.3} color="#c5a55a" distance={2} />
    </>
  )
}
