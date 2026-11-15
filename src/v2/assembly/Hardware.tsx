import { Vector2 } from 'three'
import type { PartId } from './catalog.ts'
import type { Vec3 } from './geometry.ts'

const metal = '#b5c1c9'
const frame = '#45586a'
const dark = '#1a2532'
const gold = '#b09154'

function Panel({ size, at = [0, 0, 0], color = metal }: { size: Vec3; at?: Vec3; color?: string }) {
  return <mesh position={[...at]}>
    <boxGeometry args={[...size]} />
    <meshStandardMaterial color={color} metalness={.4} roughness={.45} />
  </mesh>
}

function Ring({ radius, depth, at, color }: { radius: number; depth: number; at: Vec3; color: string }) {
  return <mesh position={[...at]} rotation={[Math.PI / 2, 0, 0]}>
    <cylinderGeometry args={[radius, radius, depth, 24]} /><meshStandardMaterial color={color} metalness={.52} roughness={.34} />
  </mesh>
}

const reflector = [new Vector2(.04, .08), new Vector2(.14, .11), new Vector2(.24, .2), new Vector2(.32, .35)]

// All details use a normalized local envelope. Assembly owns actual poses and dimensions.
export function Hardware({ part }: { part: PartId }) {
  switch (part) {
    case 'bus':
      return <>
        <Panel size={[.89, .89, .9]} color={gold} />
        {[-.453, .453].map(z => <Panel key={z} size={[.985, .985, .075]} at={[0, 0, z]} />)}
        {[-.445, .445].flatMap(x => [-.445, .445].map(y => <Panel key={x + '/' + y} size={[.105, .105, .94]} at={[x, y, 0]} color={frame} />))}
        {[-.459, .459].map(side => <group key={side}>
          <Panel size={[.045, .66, .67]} at={[side, 0, 0]} color={dark} />
          <Panel size={[.66, .045, .67]} at={[0, side, 0]} color={dark} />
          {[-.22, -.11, 0, .11, .22].map(z => <group key={z}>
            <Panel size={[.014, .64, .032]} at={[side * 1.067, 0, z]} />
            <Panel size={[.64, .014, .032]} at={[0, side * 1.067, z]} /></group>)}
        </group>)}
      </>
    case 'solar':
      return <>
        <Panel size={[.996, .985, .65]} at={[0, 0, -.1]} color={frame} />
        <Panel size={[.94, .91, .18]} at={[0, 0, .28]} color="#142238" />
        {Array.from({ length: 24 }, (_, i) => <Panel key={i} size={[.137, .207, .085]}
          at={[(i % 6 - 2.5) * .151, (Math.floor(i / 6) - 1.5) * .226, .42]} color={i % 3 ? '#355d96' : '#4c78aa'} />)}
        {[-.476, .476].map(x => <Panel key={x} size={[.036, .98, .83]} at={[x, 0, .02]} />)}
        <Panel size={[.42, .27, .15]} at={[0, 0, -.42]} />
      </>
    case 'imager':
      return <>
        <Panel size={[.91, .93, .22]} at={[0, 0, -.38]} />
        <Panel size={[.8, .82, .58]} at={[0, 0, -.05]} color={frame} />
        <Ring radius={.43} depth={.27} at={[0, 0, .27]} color={dark} />
        <Ring radius={.365} depth={.08} at={[0, 0, .405]} color={metal} />
        <Ring radius={.31} depth={.045} at={[0, 0, .438]} color="#152c48" />
        <Ring radius={.19} depth={.014} at={[0, 0, .465]} color="#426785" />
      </>
    case 'radio':
      return <>
        <Panel size={[.96, .94, .42]} at={[0, 0, -.26]} color={frame} />
        {[-.27, .27].map(x => <group key={x} position={[x, 0, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} scale={[.64, 1, 1]}>
            <latheGeometry args={[reflector, 24]} /><meshStandardMaterial color={metal} metalness={.55} roughness={.39} side={2} />
          </mesh>
          <Ring radius={.075} depth={.36} at={[0, 0, .19]} color={gold} />
          <Ring radius={.13} depth={.07} at={[0, 0, .388]} color={dark} />
        </group>)}
      </>
    case 'battery':
      return <>
        <Panel size={[.94, .91, .9]} color="#8d774d" />
        {[-.32, -.16, 0, .16, .32].map(x => <Panel key={x} size={[.09, .86, .06]} at={[x, 0, .466]} />)}
        <Panel size={[.44, .16, .11]} at={[0, -.28, .42]} color={dark} />
      </>
    case 'spacer':
      return <>
        {[-.445, .445].map(z => <Panel key={z} size={[.97, .96, .1]} at={[0, 0, z]} />)}
        {[-.35, .35].flatMap(x => [-.34, .34].map(y => <Panel key={x + '/' + y} size={[.16, .16, .85]} at={[x, y, 0]} color={frame} />))}
      </>
    case 'fine':
      return <>
        <Panel size={[.95, .92, .65]} at={[0, 0, -.1]} color={frame} />
        <Ring radius={.38} depth={.26} at={[0, 0, .28]} color={metal} />
        <Ring radius={.24} depth={.07} at={[0, 0, .438]} color={dark} />
        <Ring radius={.10} depth={.06} at={[0, 0, .47]} color={gold} />
      </>
  }
}
