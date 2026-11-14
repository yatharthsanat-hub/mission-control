import { sourceRegistryRevision, sources } from '../sources.ts'

type Quantity<Unit extends string> = number & { readonly unit: Unit }
type Metres = Quantity<'m'>
type Seconds = Quantity<'s'>
type Radians = Quantity<'rad'>
type EpochTdbSeconds = Quantity<'TDB seconds since J2000'>
type Vec3<Unit extends string> = readonly [Quantity<Unit>, Quantity<Unit>, Quantity<Unit>]

function quantity<Unit extends string>(value: number, unit: Unit): Quantity<Unit> {
  if (!Number.isFinite(value)) throw new RangeError(`Expected finite ${unit}.`)
  return value as Quantity<Unit>
}

export const metres = (value: number): Metres => quantity(value, 'm')
export const seconds = (value: number): Seconds => quantity(value, 's')
export const radians = (value: number): Radians => quantity(value, 'rad')
export const tdbEpoch = (value: number): EpochTdbSeconds => quantity(value, 'TDB seconds since J2000')
export const inertialFrame = 'earth-centered-j2000' as const

const publishedEarthGm = 398600.435507
export const earthGravity = Object.freeze({
  sourceId: sources.earthGm.id,
  original: publishedEarthGm,
  originalUnit: 'km³/s²',
  conversionFactor: 1e9,
  muM3PerS2: quantity(publishedEarthGm * 1e9, 'm³/s²'),
})

export const orbitModel = Object.freeze({
  revision: 'earth-two-body-1',
  status: 'TESTED',
  sourceRegistryRevision,
  sphereRadiusM: metres(6371000),
  minAltitudeM: metres(300000),
  maxAltitudeM: metres(1500000),
  maxEccentricity: 0.3,
  maxElapsedS: seconds(86400),
})

export interface Elements {
  frame: typeof inertialFrame
  epochTdbSeconds: EpochTdbSeconds
  semiMajorAxisM: Metres
  eccentricity: number
  inclinationRad: Radians
  ascendingNodeRad: Radians
  periapsisArgumentRad: Radians
  meanAnomalyRad: Radians
}

export interface OrbitalState {
  frame: typeof inertialFrame
  epochTdbSeconds: EpochTdbSeconds
  positionM: Vec3<'m'>
  velocityMps: Vec3<'m/s'>
  accelerationMps2: Vec3<'m/s²'>
  radiusM: Metres
  periodS: Seconds
  provenance: { modelRevision: string; registryRevision: string; inputIds: readonly string[] }
}

const tau = 2 * Math.PI

function checkElements(elements: Elements) {
  const { frame, epochTdbSeconds, semiMajorAxisM: a, eccentricity: e, inclinationRad: i,
    ascendingNodeRad, periapsisArgumentRad, meanAnomalyRad } = elements
  if (frame !== inertialFrame) throw new RangeError('Only Earth-centered J2000 inertial axes are supported.')
  if (![epochTdbSeconds, a, e, i, ascendingNodeRad, periapsisArgumentRad, meanAnomalyRad].every(Number.isFinite) ||
    Math.abs(epochTdbSeconds) > 1e10) throw new RangeError('Invalid elements or epoch outside the supported range.')
  if (a <= 0 || e < 0 || e > orbitModel.maxEccentricity || i < 0 || i > Math.PI ||
    [ascendingNodeRad, periapsisArgumentRad, meanAnomalyRad].some(angle => angle < 0 || angle >= tau)) {
    throw new RangeError('Elements are outside the supported elliptic range.')
  }
  const minRadius = orbitModel.sphereRadiusM + orbitModel.minAltitudeM
  const maxRadius = orbitModel.sphereRadiusM + orbitModel.maxAltitudeM
  if (a * (1 - e) < minRadius - 1e-6 || a * (1 + e) > maxRadius + 1e-6) {
    throw new RangeError('Both apsides must be in the 300–1,500 km training altitude envelope.')
  }
}

export function propagate(elements: Elements, elapsedS: Seconds): OrbitalState {
  checkElements(elements)
  if (!Number.isFinite(elapsedS) || elapsedS < 0 || elapsedS > orbitModel.maxElapsedS) {
    throw new RangeError('Elapsed time must be within 0–86,400 seconds.')
  }
  const { semiMajorAxisM: a, eccentricity: e, inclinationRad: i, ascendingNodeRad: node,
    periapsisArgumentRad: peri, meanAnomalyRad } = elements
  const mu = earthGravity.muM3PerS2
  const n = Math.sqrt(mu / a ** 3)
  const mean = (meanAnomalyRad + n * elapsedS) % tau
  // M = E − e sin E is strictly increasing across the supported elliptic scope.
  let low = 0
  let high = tau
  for (let iteration = 0; iteration < 52; iteration++) {
    const mid = (low + high) / 2
    if (mid - e * Math.sin(mid) < mean) low = mid
    else high = mid
  }
  const anomaly = (low + high) / 2
  const cos = Math.cos(anomaly)
  const sin = Math.sin(anomaly)
  const scale = Math.sqrt(1 - e * e)
  const radius = a * (1 - e * cos)
  const velocityScale = a * a * n / radius

  function rotate<Unit extends string>(x: number, y: number, unit: Unit): Vec3<Unit> {
    const x1 = x * Math.cos(peri) - y * Math.sin(peri)
    const y1 = x * Math.sin(peri) + y * Math.cos(peri)
    const y2 = y1 * Math.cos(i)
    return [
      quantity(x1 * Math.cos(node) - y2 * Math.sin(node), unit),
      quantity(x1 * Math.sin(node) + y2 * Math.cos(node), unit),
      quantity(y1 * Math.sin(i), unit),
    ]
  }

  const positionM = rotate(a * (cos - e), a * scale * sin, 'm')
  const [x, y, z] = positionM
  const accelerationScale = -mu / radius ** 3
  return {
    frame: elements.frame,
    epochTdbSeconds: tdbEpoch(elements.epochTdbSeconds + elapsedS),
    positionM,
    velocityMps: rotate(-velocityScale * sin, velocityScale * scale * cos, 'm/s'),
    accelerationMps2: [
      quantity(x * accelerationScale, 'm/s²'),
      quantity(y * accelerationScale, 'm/s²'),
      quantity(z * accelerationScale, 'm/s²'),
    ],
    radiusM: metres(radius),
    periodS: seconds(tau / n),
    provenance: { modelRevision: orbitModel.revision, registryRevision: sourceRegistryRevision, inputIds: [earthGravity.sourceId] },
  }
}
