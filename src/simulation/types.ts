export interface MissionObjective {
  name: string
  scienceUser: string
  requiredBands: readonly SpectralBand[]
  targetScenes: number
  budgetCredits: number
}

export type SpectralBand = 'blue' | 'green' | 'red' | 'near-infrared'

interface Component {
  name: string
  massGrams: number
  costCredits: number
}

export interface Bus extends Component {
  housekeepingWatts: number
  storageMB: number
}

export interface Imager extends Component {
  bands: readonly SpectralBand[]
  activeWatts: number
  sceneMB: number
}

export interface SolarArray extends Component {
  sunlightWatts: number
}

export interface Battery extends Component {
  capacityWh: number
}

export interface Radio extends Component {
  activeWatts: number
  rateMBPerMinute: number
}

export interface OrbitOption<ObjectiveId extends string> {
  name: string
  launchCostCredits: number
  massLimitGrams: number
  sunlightSteps: number
  observationSteps: Readonly<Record<ObjectiveId, readonly number[]>>
  contactStepsByOrbit: readonly (readonly number[])[]
}

export type LaunchViolation =
  | { code: 'invalid-selection'; field: string; message: string }
  | { code: 'incompatible-imager'; missingBands: readonly SpectralBand[]; message: string }
  | { code: 'mass-limit'; excessGrams: number; message: string }
  | { code: 'budget-limit'; excessCredits: number; message: string }

export interface LaunchResources {
  massGrams: number
  massLimitGrams: number
  massHeadroomGrams: number
  costCredits: number
  budgetCredits: number
  remainingCredits: number
}

export type StepActivity = 'idle' | 'capture' | 'downlink' | 'outage'
export type ObservationOutcome = 'none' | 'captured' | 'storage-full' | 'reserve' | 'outage' | 'downlink-priority'
export type DownlinkOutcome = 'no-contact' | 'empty' | 'transmitted' | 'reserve' | 'outage'

export interface StepTelemetry {
  orbit: number
  step: number
  sunlit: boolean
  inContact: boolean
  activity: StepActivity
  observation: ObservationOutcome
  downlink: DownlinkOutcome
  solarWatts: number
  batteryWattMinutes: number
  curtailedWattMinutes: number
  housekeepingShortfallWattMinutes: number
  optionalWatts: number
  capturedMB: number
  transmittedMB: number
  storedMB: number
  deliveredScenes: number
}

export interface MissionMetrics {
  /** Scheduled observation opportunities evaluated, including skipped captures. */
  observationsAttempted: number
  observationsCaptured: number
  usableObservations: number
  capturedMB: number
  deliveredMB: number
  storedMB: number
  partialSceneDeliveredMB: number
  poweredSteps: number
  outageSteps: number
  minimumBatteryWattMinutes: number
  batteryCapacityWattMinutes: number
  finalBatteryWattMinutes: number
}

export interface MissionCompletion {
  targetScenes: number
  scienceComplete: boolean
  success: boolean
}

export interface MissionScore {
  science: number
  operations: number
  efficiency: number
  total: number
  displayTotal: number
}

export interface MissionFinding {
  code: 'science-shortfall' | 'power-outage' | 'capture-storage' | 'capture-reserve' |
    'capture-outage' | 'capture-priority' | 'downlink-reserve' | 'downlink-outage' |
    'undelivered-data' | 'observation-opportunities' | 'low-charge'
  message: string
  suggestion: string
}
