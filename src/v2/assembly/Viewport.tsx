import { useEffect, useRef } from 'react'
import type { ComponentRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { BoxGeometry, EdgesGeometry, Matrix4, Quaternion, Vector3 } from 'three'
import { launchEnvelope, partDefinition } from './catalog.ts'
import type { Bounds, ResolvedPart } from './engine.ts'
import type { Vec3 } from './geometry.ts'

export interface MountMarker {
  key: string
  position: Vec3
  active: boolean
}

const unitBox = new BoxGeometry()
const boxEdges = new EdgesGeometry(unitBox)
unitBox.dispose()

function CraftPart({ part, color, selected, ghost, choose }: {
  part: ResolvedPart; color: string; selected: boolean; ghost?: boolean; choose?: () => void
}) {
  const [a, b, c] = part.pose.axes
  const rotation = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(
    new Vector3(...a), new Vector3(...b), new Vector3(...c),
  ))
  const size = partDefinition(part.part).sizeM
  // Surface details are drawn within the nominal footprint, offset just above the box to avoid z-fighting.
  return <group position={[...part.pose.positionM]} quaternion={rotation}>
    <mesh onClick={choose ? event => { event.stopPropagation(); choose() } : undefined}>
      <boxGeometry args={[...size]} />
      <meshStandardMaterial color={ghost ? '#77ebc2' : color} metalness={.18} roughness={.52}
        transparent={ghost} opacity={ghost ? .32 : 1} depthWrite={!ghost} />
    </mesh>
    {!ghost && <mesh position={[0, 0, size[2] / 2 + .0002]} raycast={() => undefined}>
      <planeGeometry args={[size[0] * .84, size[1] * .83]} />
      <meshStandardMaterial color={part.part === 'solar' ? '#142d51' : '#253849'} />
    </mesh>}
    {!ghost && part.part === 'solar' && Array.from({ length: 12 }, (_, index) => (
      <mesh key={index} position={[(index % 4 - 1.5) * size[0] / 5, (Math.floor(index / 4) - 1) * size[1] / 4, size[2] / 2 + .0004]} raycast={() => undefined}>
        <planeGeometry args={[size[0] * .18, size[1] * .21]} /><meshStandardMaterial color="#587fbd" metalness={.35} />
      </mesh>
    ))}
    {!ghost && part.part === 'imager' && <group position={[0, 0, size[2] / 2 + .00045]}>
      <mesh raycast={() => undefined}><circleGeometry args={[.036, 32]} /><meshStandardMaterial color="#7790a3" metalness={.5} /></mesh>
      <mesh position={[0, 0, .00015]} raycast={() => undefined}><circleGeometry args={[.027, 32]} /><meshStandardMaterial color="#111f32" roughness={.24} /></mesh>
      <mesh position={[-.006, .005, .0003]} raycast={() => undefined}><circleGeometry args={[.008, 18]} /><meshBasicMaterial color="#5f80a2" /></mesh>
    </group>}
    {(selected || ghost) && <lineSegments geometry={boxEdges} scale={[size[0] * 1.012, size[1] * 1.012, size[2] * 1.012]} raycast={() => undefined}>
      <lineBasicMaterial color="#81f4c4" transparent opacity={ghost ? .65 : .8} />
    </lineSegments>}
  </group>
}

function Camera({ request, bounds }: { request: number; bounds: Bounds }) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  const { camera, invalidate, size } = useThree()
  const boundsRef = useRef(bounds)
  useEffect(() => { boundsRef.current = bounds }, [bounds])
  useEffect(() => {
    const { min, max } = boundsRef.current
    const center = new Vector3(...min).add(new Vector3(...max)).multiplyScalar(.5)
    const radius = new Vector3(...max).distanceTo(new Vector3(...min)) / 2
    const verticalAngle = 19 * Math.PI / 180
    const halfAngle = Math.min(verticalAngle, Math.atan(Math.tan(verticalAngle) * size.width / Math.max(1, size.height)))
    const distance = Math.max(.6, radius / Math.sin(Math.max(.08, halfAngle)) * 1.12)
    camera.position.copy(center).add(new Vector3(1, .72, 1.32).normalize().multiplyScalar(distance))
    controls.current?.target.copy(center)
    controls.current?.update()
    invalidate()
  }, [camera, invalidate, request, size.width, size.height])
  return <OrbitControls ref={controls} enableDamping={false} minDistance={.16} maxDistance={9} makeDefault />
}

const envelopeMin = new Vector3(...launchEnvelope.minM)
const envelopeMax = new Vector3(...launchEnvelope.maxM)
const envelopeCenter = envelopeMin.clone().add(envelopeMax).multiplyScalar(.5)
const envelopeSize = envelopeMax.clone().sub(envelopeMin).toArray()

export default function Viewport({ parts, preview, selected, choose, markers, chooseMount, com, overlay, showAxes, fit, bounds, onLost }: {
  parts: readonly ResolvedPart[]
  preview?: ResolvedPart
  selected: string
  choose: (id: string) => void
  markers: readonly MountMarker[]
  chooseMount: (id: string) => void
  com: Vec3
  overlay: boolean
  showAxes: boolean
  fit: number
  bounds: Bounds
  onLost: () => void
}) {
  return (
    <Canvas frameloop="demand" camera={{ position: [.65, .5, .8], fov: 38, near: .005, far: 20 }}
      dpr={[1, 1.6]} fallback={<p className="assembly-canvas-fallback">WebGL is unavailable. Use the assembly tree and mount controls.</p>}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', onLost, { once: true })
      }}>
      <color attach="background" args={['#0b1620']} />
      <ambientLight intensity={1.15} />
      <directionalLight position={[1, 1.8, 2]} intensity={2.1} />
      <directionalLight position={[-1, .2, -.7]} intensity={1.2} color="#789fbe" />
      <Camera request={fit} bounds={bounds} />
      <gridHelper args={[2, 40, '#416474', '#213646']} position={[0, -.21, 0]} />
      {showAxes && <axesHelper args={[.32]} />}
      {parts.map(part => <CraftPart key={part.id} part={part} color={partDefinition(part.part).color} selected={part.id === selected}
        choose={() => choose(part.id)} />)}
      {preview && <CraftPart part={preview} color="#77ebc2" selected={false} ghost />}
      {markers.map(marker => (
        <mesh key={marker.key} position={[...marker.position]} onClick={event => { event.stopPropagation(); chooseMount(marker.key) }}>
          <sphereGeometry args={[marker.active ? .014 : .009, 12, 10]} />
          <meshBasicMaterial color={marker.active ? '#efe7a4' : '#77edc5'} depthTest={false} />
        </mesh>
      ))}
      <mesh position={[...com]} renderOrder={3} raycast={() => undefined}>
        <sphereGeometry args={[.009, 12, 10]} />
        <meshBasicMaterial color="#ffd391" depthTest={false} />
      </mesh>
      {overlay && <lineSegments geometry={boxEdges} position={envelopeCenter} scale={envelopeSize} raycast={() => undefined}>
        <lineBasicMaterial color="#7ad5eb" transparent opacity={.55} />
      </lineSegments>}
    </Canvas>
  )
}
