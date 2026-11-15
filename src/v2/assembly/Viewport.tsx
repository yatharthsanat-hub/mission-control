import { useEffect, useRef } from 'react'
import type { ComponentRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { BoxGeometry, EdgesGeometry, Matrix4, Quaternion, Vector3 } from 'three'
import { launchEnvelope, partDefinition } from './catalog.ts'
import { Hardware } from './Hardware.tsx'
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

function CraftPart({ part, selected, ghost, choose }: {
  part: ResolvedPart; selected: boolean; ghost?: boolean; choose?: () => void
}) {
  const [a, b, c] = part.pose.axes
  const rotation = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(
    new Vector3(...a), new Vector3(...b), new Vector3(...c),
  ))
  const size = partDefinition(part.part).sizeM
  return <group position={[...part.pose.positionM]} quaternion={rotation}
    onClick={choose ? event => { event.stopPropagation(); choose() } : undefined}>
    {ghost ? <mesh raycast={() => undefined}>
      <boxGeometry args={[...size]} />
      <meshStandardMaterial color="#6faee7" transparent opacity={.24} depthWrite={false} />
    </mesh> : <group scale={[...size]}><Hardware part={part.part} /></group>}
    {(selected || ghost) && <lineSegments geometry={boxEdges} scale={[size[0] * 1.012, size[1] * 1.012, size[2] * 1.012]} raycast={() => undefined}>
      <lineBasicMaterial color={selected ? '#9bccfa' : '#5396ce'} transparent opacity={.88} />
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
    const distance = Math.max(.48, radius / Math.sin(Math.max(.08, halfAngle)) * 1.12)
    camera.position.copy(center).add(new Vector3(1, 1.08, 1.34).normalize().multiplyScalar(distance))
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

export default function Viewport({ parts, preview, selected, choose, markers, chooseMount, com, overlay, showAxes, fit, bounds, blocked, launchBlocked, onLost }: {
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
  blocked: boolean
  launchBlocked: boolean
  onLost: () => void
}) {
  return (
    <Canvas frameloop="demand" camera={{ position: [.65, .5, .8], fov: 38, near: .005, far: 20 }}
      dpr={[1, 1.6]} fallback={<p className="assembly-canvas-fallback">WebGL is unavailable. Use the assembly tree and mount controls.</p>}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', onLost, { once: true })
      }}>
      <color attach="background" args={['#101827']} />
      <ambientLight intensity={.9} />
      <directionalLight position={[1, 1.8, 2]} intensity={2.7} />
      <directionalLight position={[-1, .2, -.7]} intensity={1.2} color="#789fbe" />
      <Camera request={fit} bounds={bounds} />
      <gridHelper args={[2, 40, '#416474', '#213646']} position={[0, -.21, 0]} />
      {showAxes && <axesHelper args={[.32]} />}
      {parts.map(part => <CraftPart key={part.id} part={part} selected={part.id === selected}
        choose={() => choose(part.id)} />)}
      {preview && <CraftPart part={preview} selected={false} ghost />}
      {markers.map(marker => (
        <mesh key={marker.key} position={[...marker.position]} onClick={event => { event.stopPropagation(); chooseMount(marker.key) }}>
          <sphereGeometry args={[marker.active ? .014 : .009, 12, 10]} />
          <meshBasicMaterial color={marker.active ? (blocked ? '#f4b56f' : '#bcdfff') : '#629fcf'} depthTest={false} />
        </mesh>
      ))}
      <mesh position={[...com]} renderOrder={3} raycast={() => undefined}>
        <sphereGeometry args={[.009, 12, 10]} />
        <meshBasicMaterial color="#ffd391" depthTest={false} />
      </mesh>
      {overlay && <lineSegments geometry={boxEdges} position={envelopeCenter} scale={envelopeSize} raycast={() => undefined}>
        <lineBasicMaterial color={launchBlocked ? "#D99245" : "#749dc1"} transparent opacity={.55} />
      </lineSegments>}
    </Canvas>
  )
}
