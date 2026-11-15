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

const reflector = [new Vector2(.025, .06), new Vector2(.15, .08), new Vector2(.27, .17), new Vector2(.36, .34)]

// All details use a normalized local envelope. Assembly owns actual poses and dimensions.
export function Hardware({ part }: { part: PartId }) {
  switch (part) {
    case 'bus':
      return <>
        <Panel size={[.81, .81, .88]} color={gold} />
        {[-.453, .453].map(z => <group key={z}>
          <Panel size={[.985, .985, .075]} at={[0, 0, z]} />
          {[-.38, .38].flatMap(x => [-.38, .38].map(y => <Ring key={x + '/' + y} radius={.039} depth={.025} at={[x, y, z * 1.07]} color={dark} />))}
        </group>)}
        {[-.445, .445].flatMap(x => [-.445, .445].map(y => <Panel key={x + '/' + y} size={[.105, .105, .94]} at={[x, y, 0]} color={frame} />))}
        {[-.459, .459].map(side => <group key={side}>
          <Panel size={[.045, .61, .59]} at={[side, 0, 0]} color={dark} />
          <Panel size={[.61, .045, .59]} at={[0, side, 0]} color={dark} />
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
        <Ring radius={.417} depth={.64} at={[0, 0, -.041]} color={frame} />
        <Ring radius={.44} depth={.074} at={[0, 0, .132]} color={metal} />
        <Ring radius={.46} depth={.24} at={[0, 0, .32]} color={dark} />
        <Ring radius={.462} depth={.025} at={[0, 0, .438]} color={metal} />
        <Ring radius={.35} depth={.024} at={[0, 0, .457]} color="#142d4b" />
        <Ring radius={.23} depth={.014} at={[0, 0, .471]} color="#4a7799" />
      </>
    case 'radio':
      return <>
        <Panel size={[.96, .94, .42]} at={[0, 0, -.26]} color={frame} />
        <mesh rotation={[Math.PI / 2, 0, 0]} scale={[1.2, 1, 1]}>
          <latheGeometry args={[reflector, 32]} /><meshStandardMaterial color={metal} metalness={.5} roughness={.36} side={2} />
        </mesh>
        <Ring radius={.062} depth={.36} at={[0, 0, .20]} color={gold} />
        <Ring radius={.105} depth={.075} at={[0, 0, .398]} color={dark} />
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
