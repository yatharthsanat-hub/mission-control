import { flip, identity, minusX, minusY, plusX, plusY, twists } from './geometry.ts'
import type { Axes, Pose, Vec3, Twist } from './geometry.ts'

export const catalogRevision = 'earth-assembly-1'
export const assemblySources = {
  interface: { title: 'NASA CubeSat 101', locator: '§4.1 and §§6.4–6.6', url: 'https://science.nasa.gov/wp-content/uploads/2023/06/nasa_csli_cubesat_101_508.pdf' },
  power: { title: 'NASA Small Spacecraft Technology · Power', locator: '§3', url: 'https://www.nasa.gov/smallsat-institute/sst-soa/power-subsystems/' },
  radio: { title: 'NASA Small Spacecraft Technology · Communications', locator: '§9', url: 'https://www.nasa.gov/smallsat-institute/sst-soa/soa-communications/' },
  attitude: { title: 'NASA Small Spacecraft Technology · Guidance, Navigation and Control', locator: '§5', url: 'https://www.nasa.gov/smallsat-institute/sst-soa/guidance-navigation-and-control/' },
  imaging: { title: 'NASA Landsat 9 · Operational Land Imager', locator: 'Bands 4 and 5', url: 'https://science.nasa.gov/mission/landsat-9/' },
} as const

type InterfaceId = 'payload' | 'panel' | 'power' | 'avionics'
export interface Node {
  readonly id: string
  readonly label: string
  readonly role: 'host' | 'guest'
  readonly interfaceId: InterfaceId
  readonly pose: Pose
  readonly allowedTwists: readonly Twist[]
}

export type Component = Readonly<{
  name: string; description: string; color: string; sizeM: Vec3; massKg: number; comM: Vec3
  costCents: number; generationW: number; capacityJ: number; loadW: number
  nodes: readonly Node[]; source: keyof typeof assemblySources; capability?: 'fine-pointing-adcs'
}>

function host(id: string, label: string, interfaceId: InterfaceId, positionM: Vec3, axes: Axes): Node {
  return { id, label, interfaceId, pose: { positionM, axes }, role: 'host', allowedTwists: twists }
}

function part(spec: Omit<Component, 'nodes' | 'comM' | 'generationW' | 'capacityJ' | 'loadW'> &
  Partial<Pick<Component, 'comM' | 'generationW' | 'capacityJ' | 'loadW'>>, interfaceId: InterfaceId, hosts: readonly Node[] = []): Component {
  return {
    comM: [0, 0, 0], generationW: 0, capacityJ: 0, loadW: 0, ...spec,
    nodes: [{ id: 'mount', label: 'Base mount', role: 'guest', interfaceId, allowedTwists: twists,
      pose: { positionM: [0, 0, -spec.sizeM[2] / 2], axes: flip } }, ...hosts],
  }
}

// Scenario values and representative rectangular stowed geometry. No vendor or NASA part specifications.
export const catalog = {
  bus: {
    name: 'Survey bus', description: 'Structural frame with housekeeping avionics and six external mounting faces.',
    color: '#68879a', sizeM: [.22, .22, .26], massKg: 2, comM: [0, 0, 0], costCents: 2_400_000,
    generationW: 0, capacityJ: 0, loadW: 2, source: 'interface',
    nodes: [
      host('deck', 'Payload deck', 'payload', [0, 0, .13], identity),
      host('port', 'Port panel rail', 'panel', [-.11, 0, 0], minusX),
      host('starboard', 'Starboard panel rail', 'panel', [.11, 0, 0], plusX),
      host('battery', 'Battery bay', 'power', [0, 0, -.13], flip),
      host('radio', 'Upper avionics rail', 'avionics', [0, .11, 0], plusY),
      host('attitude', 'Lower avionics rail', 'avionics', [0, -.11, 0], minusY),
    ],
  },
  solar: part({
    name: 'Stowed solar wing', description: 'Adds nominal generation in sunlight. Rotation changes the stowed footprint.',
    color: '#456eaf', sizeM: [.28, .20, .025], massKg: .35, costCents: 840_000, generationW: 8, source: 'power',
  }, 'panel'),
  battery: part({
    name: 'Battery pack', description: 'Stores usable electrical energy for operations in eclipse.',
    color: '#c39b62', sizeM: [.14, .10, .055], massKg: .55, costCents: 720_000, capacityJ: 72_000, source: 'power',
  }, 'power'),
  imager: part({
    name: 'Multispectral imager', description: 'An illustrative red and near-infrared concept for Earth observations.',
    color: '#b9c4d1', sizeM: [.14, .11, .105], massKg: .85, comM: [.02, 0, .015], costCents: 2_100_000, loadW: 6, source: 'imaging',
  }, 'payload'),
  spacer: part({
    name: 'Payload riser', description: 'Raises an instrument for clearance, spending mass and launch-envelope margin.',
    color: '#a8b9bc', sizeM: [.16, .15, .105], massKg: .3, costCents: 290_000, source: 'interface',
  }, 'payload', [host('deck', 'Raised payload deck', 'payload', [0, 0, .0525], identity)]),
  radio: part({
    name: 'Telemetry radio', description: 'Provides a ground-link subsystem. Its maximum load contributes to the peak design estimate.',
    color: '#80b8ae', sizeM: [.24, .085, .06], massKg: .42, costCents: 960_000, loadW: 5, source: 'radio',
  }, 'avionics'),
  fine: part({
    name: 'Fine-pointing unit', description: 'Research-gated attitude-control hardware. Adds peak load; pointing performance is outside this model.',
    color: '#c4877c', sizeM: [.11, .09, .065], massKg: .6, costCents: 1_250_000, loadW: 4, source: 'attitude',
    capability: 'fine-pointing-adcs',
  }, 'avionics'),
} satisfies Record<string, Component>

export type PartId = keyof typeof catalog
export const partDefinition = (id: PartId): Component => catalog[id]

export const launchEnvelope = {
  label: 'Illustrative survey rideshare',
  minM: [-.19, -.19, -.20] as Vec3,
  maxM: [.19, .19, .31] as Vec3,
  maxWetKg: 4.2,
  maxComOffsetM: [.065, .065, .145] as Vec3,
} as const

export const launchDimensionsM: Vec3 = [
  launchEnvelope.maxM[0] - launchEnvelope.minM[0],
  launchEnvelope.maxM[1] - launchEnvelope.minM[1],
  launchEnvelope.maxM[2] - launchEnvelope.minM[2],
]
