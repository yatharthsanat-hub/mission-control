import { Canvas, useLoader } from '@react-three/fiber'
import { Line, OrbitControls } from '@react-three/drei'
import { Suspense, useEffect, useMemo } from 'react'
import { CanvasTexture, SRGBColorSpace, TextureLoader } from 'three'
import { sceneColor } from '../../design.ts'
import { fixedToScene as three } from './geography.ts'
import { siteUnit } from '../planning/geometry.ts'
import type { Vector } from '../planning/geometry.ts'

function EarthMaterial() {
  const source = useLoader(TextureLoader, `${import.meta.env.BASE_URL}mission/blue-marble-globe.jpg`)
  const texture = useMemo(() => {
    const map = source.clone()
    map.colorSpace = SRGBColorSpace
    return map
  }, [source])
  useEffect(() => () => texture.dispose(), [texture])
  return <meshStandardMaterial map={texture} roughness={.92} />
}

const grid = [
  ...[-60, -30, 0, 30, 60].map(latitudeDeg =>
    Array.from({ length: 73 }, (_, i) => siteUnit({ latitudeDeg, longitudeDeg: i * 5 }))),
  ...[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(longitudeDeg =>
    Array.from({ length: 37 }, (_, i) => siteUnit({ latitudeDeg: -90 + i * 5, longitudeDeg }))),
]
const scene = {
  background: sceneColor('bg'), trajectory: sceneColor('telemetry'), station: sceneColor('accent'),
  target: sceneColor('amber'), acquired: sceneColor('success'), craft: sceneColor('ink'),
}

function makeLunarTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#a8a8aa'
  ctx.fillRect(0, 0, 512, 256)
  let seed = 731
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
  for (let index = 0; index < 108; index++) {
    const x = random() * 512
    const y = random() * 256
    const size = 2 + random() ** 2 * 24
    ctx.beginPath()
    ctx.arc(x, y, size, 0, Math.PI * 2)
    ctx.fillStyle = index < 12 ? '#808084' : '#99999e'
    ctx.fill()
    ctx.strokeStyle = '#b4b4b5'
    ctx.stroke()
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

export default function Globe({ orbit, track, craft, target, station, sun, access, contact, lunar, earthDirection, acquired, onLost }: {
  orbit: readonly Vector[]
  track: readonly Vector[]
  craft: Vector
  target: Vector
  station: Vector | null
  sun: Vector
  earthDirection: Vector | null
  lunar: boolean
  acquired: boolean
  access: boolean
  contact: boolean
  onLost: () => void
}) {
  const texture = useMemo(() => lunar ? makeLunarTexture() : null, [lunar])
  useEffect(() => () => texture?.dispose(), [texture])
  const contactEnd: Vector | null = earthDirection ?
    [craft[0] + earthDirection[0] * .55, craft[1] + earthDirection[1] * .55, craft[2] + earthDirection[2] * .55] : station
  const cameraPosition = lunar ? [2.05, 1.65, 2.2] as [number, number, number]
    : three([target[0] * 3.25, target[1] * 3.25, target[2] * 3.25])
  return <Canvas frameloop="demand" camera={{ position: cameraPosition, near: .02, far: 25, fov: 40 }}
    dpr={[1, 1.5]} fallback={<p>WebGL is unavailable. Select the 2D ground track.</p>}
    onCreated={({ gl }) => gl.domElement.addEventListener('webglcontextlost', onLost, { once: true })}>
    <color attach="background" args={[scene.background]} />
    <ambientLight intensity={.65} />
    <directionalLight position={three(sun)} intensity={2} />
    <OrbitControls minDistance={1.25} maxDistance={7} enableDamping={false} makeDefault />
    <mesh>
      <sphereGeometry args={[1, 56, 36]} />
      {lunar ? <meshStandardMaterial color="#babac0" map={texture} roughness={.92} /> :
        <Suspense fallback={<meshStandardMaterial color="#133653" roughness={.92} />}><EarthMaterial /></Suspense>}
    </mesh>
    {lunar && <group scale={1.004}>
      {grid.map((line, index) => <Line key={index} points={line.map(three)} color="#507590" transparent opacity={.45} />)}
    </group>}
    {track.length > 1 && <group scale={1.008}>
      <Line points={track.map(three)} color={scene.trajectory} transparent opacity={.58} />
    </group>}
    <Line points={orbit.map(three)} color={scene.trajectory} lineWidth={1.7} />
    {contact && contactEnd && <Line points={[three(craft), three(contactEnd)]} color={scene.station} lineWidth={2} />}
    {access && <Line points={[three(craft), three(target)]} color={scene.target} lineWidth={2} />}
    <mesh position={three(target)}><sphereGeometry args={[.023, 12, 8]} /><meshBasicMaterial color={acquired ? scene.acquired : scene.target} /></mesh>
    {station && <mesh position={three(station)}><sphereGeometry args={[.021, 12, 8]} /><meshBasicMaterial color={scene.station} /></mesh>}
    <mesh position={three(craft)}><octahedronGeometry args={[.035]} /><meshBasicMaterial color={scene.craft} /></mesh>
  </Canvas>
}
