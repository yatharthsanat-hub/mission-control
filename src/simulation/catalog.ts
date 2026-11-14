import type { Battery, Bus, Imager, MissionObjective, OrbitOption, Radio, SolarArray } from './types.ts'

// All numbers and schedules are illustrative game assumptions. See docs/GAME_DESIGN.md.
// Qualitative evidence and NASA source links are in docs/SOURCE_AUDIT.md.
export const missionObjectives = {
  coastal: { name: 'Coastal flood mapping', scienceUser: 'Emergency mapping team', requiredBands: ['blue', 'green', 'red'], targetScenes: 7, budgetCredits: 100 },
  crop: { name: 'Crop condition monitoring', scienceUser: 'Agriculture team', requiredBands: ['red', 'near-infrared'], targetScenes: 8, budgetCredits: 100 },
} as const satisfies Record<string, MissionObjective>

export type ObjectiveId = keyof typeof missionObjectives

export const bus: Bus = {
  name: 'Fixed 3U bus',
  massGrams: 2000,
  costCredits: 22,
  housekeepingWatts: 2,
  storageMB: 300,
}

export const imagers = {
  visible: { name: 'Visible camera', massGrams: 400, costCredits: 12, bands: ['blue', 'green', 'red'], activeWatts: 4, sceneMB: 30 },
  redNir: { name: 'Red/NIR camera', massGrams: 800, costCredits: 23, bands: ['red', 'near-infrared'], activeWatts: 7, sceneMB: 60 },
} satisfies Record<string, Imager>

export const solarArrays = {
  bodyMounted: { name: 'Body-mounted', massGrams: 350, costCredits: 11, sunlightWatts: 6 },
  deployable: { name: 'Deployable', massGrams: 800, costCredits: 20, sunlightWatts: 10 },
} satisfies Record<string, SolarArray>

export const batteries = {
  compact: { name: 'Compact', massGrams: 300, costCredits: 8, capacityWh: 2 },
  extended: { name: 'Extended', massGrams: 700, costCredits: 15, capacityWh: 5 },
} satisfies Record<string, Battery>

export const radios = {
  lowRate: { name: 'Low-rate', massGrams: 250, costCredits: 8, activeWatts: 3, rateMBPerMinute: 6 },
  highRate: { name: 'High-rate', massGrams: 550, costCredits: 17, activeWatts: 8, rateMBPerMinute: 18 },
} satisfies Record<string, Radio>

export const orbitOptions = {
  midInclination: {
    name: 'Mid-inclination LEO rideshare',
    launchCostCredits: 12,
    massLimitGrams: 3800,
    sunlightSteps: 11,
    observationSteps: { coastal: [2, 3, 4], crop: [3] },
    contactStepsByOrbit: [[9, 10], [], [9, 10], [], [9, 10], [10]],
  },
  nearPolar: {
    name: 'Near-polar LEO rideshare',
    launchCostCredits: 17,
    massLimitGrams: 4600,
    sunlightSteps: 12,
    observationSteps: { coastal: [3], crop: [2, 3, 4] },
    contactStepsByOrbit: [[12, 13], [12, 13], [12, 13], [12, 13], [12, 13], [12, 13]],
  },
} satisfies Record<string, OrbitOption<ObjectiveId>>

export const simulationRules = {
  orbitCount: 6,
  stepsPerOrbit: 18,
  stepMinutes: 5,
  reservePercents: [15, 35],
  score: {
    sciencePoints: 70,
    continuityPoints: 10,
    chargePoints: 10,
    referenceChargePercent: 25,
    budgetPoints: 5,
    referenceCredits: 20,
    massPoints: 5,
    referenceMassGrams: 500,
  },
} as const

export interface SpacecraftConfiguration {
  objective: ObjectiveId
  orbit: keyof typeof orbitOptions
  imager: keyof typeof imagers
  solarArray: keyof typeof solarArrays
  battery: keyof typeof batteries
  radio: keyof typeof radios
  reservePercent: (typeof simulationRules.reservePercents)[number]
}
