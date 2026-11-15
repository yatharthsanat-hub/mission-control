import { inertialFrame, lunarFrame, orbitalDynamics } from '../physics/twoBody.ts'
import type { Vector } from './geometry.ts'
import type { environment } from './orbit.ts'

export const lunarSources = {
  gravity: { title: 'JPL Astrodynamic Parameters', url: 'https://ssd.jpl.nasa.gov/astro_par.html',
    locator: 'Planetary Masses · Moon · DE440 GM 4902.800118 km³/s²', accessed: '2026-11-14' },
  spin: { title: 'NASA NSSDCA Moon Fact Sheet', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html',
    locator: 'Volumetric mean radius 1737.4 km · Sidereal rotation 655.720 h', accessed: '2026-11-14' },
  science: { title: 'NASA Lunar Reconnaissance Orbiter', url: 'https://science.nasa.gov/mission/lro/',
    locator: 'Mission overview and landing-site reconnaissance', accessed: '2026-11-14' },
  instrument: { title: 'Lunar Reconnaissance Orbiter Camera specifications', url: 'https://lroc.im-ldi.com/about/specs',
    locator: 'NAC · 10 μrad IFOV, 0.5 m/pixel at 50 km (reference fixture only)', accessed: '2026-11-14' },
  uncertainty: { title: 'NASA · From Apollo to Artemis: Exploring the Lunar Surface', url: 'https://www.nasa.gov/moonbase-environment-visualization/',
    locator: 'Surface lighting and terrain context', accessed: '2026-11-14' },
} as const

export const lunarEnvironment = {
  body: 'moon', revision: 'moon-mean-spin-1', inertialFrame: lunarFrame, fixedFrame: 'moon-fixed-synthetic-mean-spin-1',
  durationS: 86_400, stepS: 5, startEpochTdbS: 0,
  epochConvention: 'Elapsed TDB seconds from the J2000 epoch; synthetic axes and orientation',
  surfaceCoordinates: 'Planetocentric latitude and east-positive longitude in degrees',
  radiusM: orbitalDynamics(lunarFrame).limits.sphereRadiusM,
  rotationPeriodS: 655.720 * 3600, primeMeridianAngleAtEpochRad: 0, sunDirectionInertial: [1, 0, 0],
  initialBatteryFraction: 1, initialStorageBits: 0,
  communications: { kind: 'parallel-earth-service', earthDirectionFixed: [1, 0, 0], maxBitRateBps: 96_000 },
  modelSources: [lunarSources.gravity, lunarSources.spin],
} as const

export type FlightEnvironment = Omit<typeof environment, 'durationS' | 'stepS'> | typeof lunarEnvironment

type Terminal = typeof environment.groundStation
type Link = { kind: 'surface-terminal'; station: Terminal; maxBitRateBps: number } | typeof lunarEnvironment.communications

export interface EnvironmentModel {
  body: 'earth' | 'moon'
  label: string
  inertialFrame: typeof inertialFrame | typeof lunarFrame
  fixedFrame: string
  radiusM: number
  gravity: ReturnType<typeof orbitalDynamics>['gravity']
  epochConvention: string
  surfaceCoordinates: string
  rotationPeriodS: number
  primeMeridianAngleAtEpochRad: number
  sunDirectionInertial: Vector
  initialBatteryFraction: number
  initialStorageBits: number
  communications: Link
}

// Legacy schemas retain their original serialized shape.
export function environmentModel(input: FlightEnvironment): EnvironmentModel {
  if ('body' in input) return { ...input, label: 'Moon', gravity: orbitalDynamics(lunarFrame).gravity }
  return {
    body: 'earth', label: 'Earth', inertialFrame, fixedFrame: 'synthetic-earth-fixed-z-spin-1',
    gravity: orbitalDynamics(inertialFrame).gravity, epochConvention: 'TDB seconds since J2000',
    surfaceCoordinates: 'Spherical latitude and east-positive longitude in degrees',
    radiusM: input.earthRadiusM, rotationPeriodS: input.siderealDayS,
    primeMeridianAngleAtEpochRad: input.primeMeridianAngleAtEpochRad, sunDirectionInertial: input.sunDirectionInertial,
    initialBatteryFraction: input.initialBatteryFraction, initialStorageBits: input.initialStorageBits,
    communications: { kind: 'surface-terminal', station: input.groundStation, maxBitRateBps: input.groundStation.maxBitRateBps },
  }
}
