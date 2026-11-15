import { inertialFrame, metres, orbitalDynamics, orbitModel, propagate, radians, seconds, tdbEpoch } from '../physics/twoBody.ts'
import type { Elements } from '../physics/twoBody.ts'
import { environmentModel } from './environments.ts'
import type { FlightEnvironment } from './environments.ts'

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

export function orbitElements(input: OrbitInput, frame: Elements['frame'] = inertialFrame): Elements {
  for (const [field, value] of Object.entries(input)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Enter a finite value for ' + field + '.')
  }
  const angle = (deg: number) => radians(deg * Math.PI / 180)
  return {
    frame, epochTdbSeconds: tdbEpoch(environment.startEpochTdbS),
    semiMajorAxisM: metres(orbitalDynamics(frame).limits.sphereRadiusM + input.altitudeKm * 1000),
    eccentricity: input.eccentricity, inclinationRad: angle(input.inclinationDeg),
    ascendingNodeRad: angle(input.nodeDeg), periapsisArgumentRad: angle(input.periapsisDeg),
    meanAnomalyRad: angle(input.meanAnomalyDeg),
  }
}

export function geographicSubpoint(positionM: readonly [number, number, number], elapsedS: number,
  model: Pick<ReturnType<typeof environmentModel>, 'primeMeridianAngleAtEpochRad' | 'rotationPeriodS'> = environmentModel(environment)) {
  const [x, y, z] = positionM
  const theta = model.primeMeridianAngleAtEpochRad + 2 * Math.PI * elapsedS / model.rotationPeriodS
  const longitude = (Math.atan2(y, x) - theta) * 180 / Math.PI
  return { latitudeDeg: Math.atan2(z, Math.hypot(x, y)) * 180 / Math.PI, longitudeDeg: ((longitude + 180) % 360 + 360) % 360 - 180 }
}

export function orbitalSummary(input: OrbitInput, frame: Elements['frame'] = inertialFrame) {
  const elements = orbitElements(input, frame)
  const initialState = propagate(elements, seconds(0))
  const radiusM = orbitalDynamics(frame).limits.sphereRadiusM
  return {
    elements, initialState,
    perigeeM: elements.semiMajorAxisM * (1 - elements.eccentricity) - radiusM,
    apogeeM: elements.semiMajorAxisM * (1 + elements.eccentricity) - radiusM,
  }
}

export function groundTrack(elements: Elements, durationS: number = environment.durationS, inputs: FlightEnvironment = environment) {
  if (!Number.isFinite(durationS) || durationS < 0 || durationS > orbitModel.maxElapsedS) throw new RangeError('Unsupported ground-track duration.')
  const model = environmentModel(inputs)
  if (elements.frame !== model.inertialFrame) throw new RangeError('Orbit and ground-track frame must match.')
  return Array.from({ length: Math.floor(durationS / environment.stepS) + 1 }, (_, index) => {
    const elapsedS = index * environment.stepS
    return { elapsedS, ...geographicSubpoint(propagate(elements, seconds(elapsedS)).positionM, elapsedS, model) }
  })
}
