import { Canvas } from '@react-three/fiber'
import { Line, OrbitControls } from '@react-three/drei'
import { siteUnit } from '../planning/geometry.ts'
import type { Vector } from '../planning/geometry.ts'

const three = ([x, y, z]: Vector): [number, number, number] => [x, z, -y]
const grid = [
  ...[-60, -30, 0, 30, 60].map(latitudeDeg =>
    Array.from({ length: 73 }, (_, i) => siteUnit({ latitudeDeg, longitudeDeg: i * 5 }))),
  ...[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(longitudeDeg =>
    Array.from({ length: 37 }, (_, i) => siteUnit({ latitudeDeg: -90 + i * 5, longitudeDeg }))),
]

export default function Globe({ orbit, track, craft, target, station, sun, access, contact, onLost }: {
  orbit: readonly Vector[]
  track: readonly Vector[]
  craft: Vector
  target: Vector
  station: Vector
  sun: Vector
  access: boolean
  contact: boolean
  onLost: () => void
}) {
  return <Canvas frameloop="demand" camera={{ position: [2.05, 1.65, 2.2], near: .02, far: 25, fov: 40 }}
    dpr={[1, 1.5]} fallback={<p>WebGL is unavailable. Select the 2D ground track.</p>}
    onCreated={({ gl }) => gl.domElement.addEventListener('webglcontextlost', onLost, { once: true })}>
    <color attach="background" args={['#090f1a']} />
    <ambientLight intensity={.65} />
    <directionalLight position={three(sun)} intensity={2} />
    <OrbitControls minDistance={1.25} maxDistance={7} enableDamping={false} makeDefault />
    <mesh>
      <sphereGeometry args={[1, 56, 36]} />
      <meshStandardMaterial color="#133653" roughness={.92} />
    </mesh>
    <group scale={1.004}>
      {grid.map((line, index) => <Line key={index} points={line.map(three)} color="#507590" transparent opacity={.45} />)}
    </group>
    <group scale={1.008}>
      <Line points={track.map(three)} color="#5cbdcb" transparent opacity={.65} />
    </group>
    <Line points={orbit.map(three)} color="#87d8af" lineWidth={1.7} />
    {contact && <Line points={[three(craft), three(station)]} color="#79adff" lineWidth={2} />}
    {access && <Line points={[three(craft), three(target)]} color="#ffce89" lineWidth={2} />}
    <mesh position={three(target)}><sphereGeometry args={[.023, 12, 8]} /><meshBasicMaterial color="#ffce89" /></mesh>
    <mesh position={three(station)}><sphereGeometry args={[.021, 12, 8]} /><meshBasicMaterial color="#79adff" /></mesh>
    <mesh position={three(craft)}><octahedronGeometry args={[.035]} /><meshBasicMaterial color="#eafdf4" /></mesh>
  </Canvas>
}
