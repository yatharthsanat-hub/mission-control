import type { OrbitInput } from './orbit.ts'
import { forecastProfile } from './flightModel.ts'
import { training } from '../training.ts'

export const lunarObjectives = {
  screening: { label: 'Lunar landing-site reconnaissance', product: 'Repeat sunlit optical samples for candidate screening',
    bands: [training.requiredBands[0]], scenes: 2, groundSampleLimitM: 12, minSunElevationDeg: 12 },
  survey: { label: 'Lunar regional context survey', product: 'Three sunlit optical samples of a designated survey tile',
    bands: [training.requiredBands[0]], scenes: 3, groundSampleLimitM: 15, minSunElevationDeg: 12 },
} as const

export const lunarSites = {
  tranquility: { id: 'tranquility', label: 'Tranquillitatis survey tile', latitudeDeg: 0, longitudeDeg: 22,
    radiusM: 20_000, interest: 'Illustrative mare context for repeat optical reconnaissance.' },
  central: { id: 'central', label: 'Central nearside survey tile', latitudeDeg: 0, longitudeDeg: -8,
    radiusM: 20_000, interest: 'Illustrative comparison tile for lighting and apparent texture.' },
} as const
export type LunarSiteId = keyof typeof lunarSites
export interface LunarPlan {
  body: 'moon'
  objective: keyof typeof lunarObjectives
  target: LunarSiteId
  launch: 'lunar-service'
  orbit: OrbitInput
  revisedFrom: string | null
}
export const defaultLunarPlan: LunarPlan = {
  body: 'moon', objective: 'screening', target: 'tranquility', launch: 'lunar-service', revisedFrom: null,
  orbit: { altitudeKm: 80, eccentricity: 0, inclinationDeg: 0, nodeDeg: 0, periapsisDeg: 0, meanAnomalyDeg: 0 },
}
export const lunarProfile = Object.freeze({
  ...forecastProfile, revision: 'moon-forecast-1', fixedFrame: 'moon-fixed-synthetic-mean-spin-1',
  minFootprintAcrossM: 2_500, solarOutputFraction: .7, downlinkFrequencyHz: null,
} as const)
