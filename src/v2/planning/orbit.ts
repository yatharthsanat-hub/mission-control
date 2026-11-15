import { inertialFrame, metres, orbitModel, propagate, radians, seconds, tdbEpoch } from '../physics/twoBody.ts'
import type { Elements } from '../physics/twoBody.ts'

export const orbitDefaults = { altitudeKm: 600, eccentricity: 0, inclinationDeg: 55, nodeDeg: 0, periapsisDeg: 0, meanAnomalyDeg: 0 }
export type OrbitInput = typeof orbitDefaults

export const environment = {
  revision: 'spherical-spin-1',
  durationS: 21_600,
  stepS: 60,
  startEpochTdbS: 0,
  earthRadiusM: orbitModel.sphereRadiusM,
  siderealDayS: 86_164.09054,
  primeMeridianAngleAtEpochRad: 0,
  sunDirectionInertial: [1, 0, 0],
  groundStation: { id: 'training-terminal', latitudeDeg: 35, longitudeDeg: -106, minElevationDeg: 10, maxBitRateBps: 256_000 },
  initialBatteryFraction: 1,
  initialStorageBits: 0,
} as const

export function orbitElements(input: OrbitInput): Elements {
  for (const [field, value] of Object.entries(input)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Enter a finite value for ' + field + '.')
  }
  const angle = (deg: number) => radians(deg * Math.PI / 180)
  return {
    frame: inertialFrame, epochTdbSeconds: tdbEpoch(environment.startEpochTdbS),
    semiMajorAxisM: metres(orbitModel.sphereRadiusM + input.altitudeKm * 1000),
    eccentricity: input.eccentricity, inclinationRad: angle(input.inclinationDeg),
    ascendingNodeRad: angle(input.nodeDeg), periapsisArgumentRad: angle(input.periapsisDeg),
    meanAnomalyRad: angle(input.meanAnomalyDeg),
  }
}

export function geographicSubpoint(positionM: readonly [number, number, number], elapsedS: number) {
  const [x, y, z] = positionM
  const theta = environment.primeMeridianAngleAtEpochRad + 2 * Math.PI * elapsedS / environment.siderealDayS
  const longitude = (Math.atan2(y, x) - theta) * 180 / Math.PI
  return { latitudeDeg: Math.atan2(z, Math.hypot(x, y)) * 180 / Math.PI, longitudeDeg: ((longitude + 180) % 360 + 360) % 360 - 180 }
}

export function orbitalSummary(input: OrbitInput) {
  const elements = orbitElements(input)
  const initialState = propagate(elements, seconds(0))
  return {
    elements, initialState,
    perigeeM: elements.semiMajorAxisM * (1 - elements.eccentricity) - orbitModel.sphereRadiusM,
    apogeeM: elements.semiMajorAxisM * (1 + elements.eccentricity) - orbitModel.sphereRadiusM,
  }
}

export function groundTrack(elements: Elements, durationS: number = environment.durationS) {
  if (!Number.isFinite(durationS) || durationS < 0 || durationS > orbitModel.maxElapsedS) throw new RangeError('Unsupported ground-track duration.')
  return Array.from({ length: Math.floor(durationS / environment.stepS) + 1 }, (_, index) => {
    const elapsedS = index * environment.stepS
    return { elapsedS, ...geographicSubpoint(propagate(elements, seconds(elapsedS)).positionM, elapsedS) }
  })
}
