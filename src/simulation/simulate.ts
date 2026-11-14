import { batteries, bus, imagers, missionObjectives, orbitOptions, radios, simulationRules, solarArrays } from './catalog.ts'
import type { SpacecraftConfiguration } from './catalog.ts'
import { explainMission } from './findings.ts'
import { validateLaunch } from './launch.ts'
import type {
  DownlinkOutcome, LaunchResources, LaunchViolation, MissionCompletion, MissionFinding,
  MissionMetrics, MissionScore, ObservationOutcome, StepActivity, StepTelemetry,
} from './types.ts'

export interface RejectedMission {
  status: 'invalid-launch'
  configuration: Readonly<Partial<SpacecraftConfiguration>>
  resources: LaunchResources | null
  violations: readonly LaunchViolation[]
  score: null
}

export interface CompletedMission {
  status: 'completed'
  configuration: Readonly<SpacecraftConfiguration>
  resources: LaunchResources
  violations: readonly []
  timeline: readonly StepTelemetry[]
  metrics: MissionMetrics
  completion: MissionCompletion
  score: MissionScore
  findings: readonly MissionFinding[]
}

export type SimulationResult = RejectedMission | CompletedMission

function scoreMission(
  metrics: MissionMetrics,
  resources: LaunchResources,
  targetScenes: number,
  totalSteps: number,
): MissionScore {
  const rules = simulationRules.score
  const scienceFraction = Math.min(metrics.usableObservations / targetScenes, 1)
  const referenceCharge = metrics.batteryCapacityWattMinutes * rules.referenceChargePercent / 100
  const science = rules.sciencePoints * scienceFraction
  const operations = rules.continuityPoints * metrics.poweredSteps / totalSteps +
    rules.chargePoints * Math.min(metrics.minimumBatteryWattMinutes / referenceCharge, 1)
  const efficiency = scienceFraction * (
    rules.budgetPoints * Math.min(resources.remainingCredits / rules.referenceCredits, 1) +
    rules.massPoints * Math.min(resources.massHeadroomGrams / rules.referenceMassGrams, 1)
  )
  const total = science + operations + efficiency
  return { science, operations, efficiency, total, displayTotal: Math.round(total) }
}

type RunState = {
  batteryWattMinutes: number
  capturedMB: number
  transmittedMB: number
}

function simulateStep(
  configuration: Readonly<SpacecraftConfiguration>,
  state: RunState,
  orbitNumber: number,
  step: number,
): StepTelemetry {
  const orbit = orbitOptions[configuration.orbit]
  const imager = imagers[configuration.imager]
  const radio = radios[configuration.radio]
  const capacity = batteries[configuration.battery].capacityWh * 60
  const { stepMinutes } = simulationRules
  const reserve = capacity * configuration.reservePercent / 100

  const sunlit = step < orbit.sunlightSteps
  const inContact = orbit.contactStepsByOrbit[orbitNumber - 1].includes(step)
  const hasTarget = sunlit && orbit.observationSteps[configuration.objective].includes(step)
  const queuedMB = state.capturedMB - state.transmittedMB
  const hasDownlink = inContact && queuedMB > 0
  const solarWatts = sunlit ? solarArrays[configuration.solarArray].sunlightWatts : 0
  const available = state.batteryWattMinutes + (solarWatts - bus.housekeepingWatts) * stepMinutes

  let activity: StepActivity = 'idle'
  let observation: ObservationOutcome = 'none'
  let downlink: DownlinkOutcome = inContact ? 'empty' : 'no-contact'
  let optionalWatts = 0
  let capturedMB = 0
  let transmittedMB = 0

  if (available < 0) {
    activity = 'outage'
    if (hasTarget) observation = 'outage'
    if (hasDownlink) downlink = 'outage'
  } else if (hasDownlink) {
    if (hasTarget) observation = 'downlink-priority'
    if (available - radio.activeWatts * stepMinutes < reserve) {
      downlink = 'reserve'
    } else {
      activity = 'downlink'
      downlink = 'transmitted'
      optionalWatts = radio.activeWatts
      transmittedMB = Math.min(queuedMB, radio.rateMBPerMinute * stepMinutes)
    }
  } else if (hasTarget) {
    if (queuedMB + imager.sceneMB > bus.storageMB) {
      observation = 'storage-full'
    } else if (available - imager.activeWatts * stepMinutes < reserve) {
      observation = 'reserve'
    } else {
      activity = 'capture'
      observation = 'captured'
      optionalWatts = imager.activeWatts
      capturedMB = imager.sceneMB
    }
  }

  const remaining = available - optionalWatts * stepMinutes
  state.batteryWattMinutes = Math.min(capacity, Math.max(remaining, 0))
  state.capturedMB += capturedMB
  state.transmittedMB += transmittedMB
  // One imager makes fixed-size scenes. FIFO delivery keeps any partial scene at the head.
  return {
    orbit: orbitNumber,
    step,
    sunlit,
    inContact,
    activity,
    observation,
    downlink,
    solarWatts,
    batteryWattMinutes: state.batteryWattMinutes,
    curtailedWattMinutes: Math.max(remaining - capacity, 0),
    housekeepingShortfallWattMinutes: Math.max(-available, 0),
    optionalWatts,
    capturedMB,
    transmittedMB,
    storedMB: state.capturedMB - state.transmittedMB,
    deliveredScenes: Math.floor(state.transmittedMB / imager.sceneMB),
  }
}

export function simulateMission(configuration: Readonly<SpacecraftConfiguration>): SimulationResult {
  const { resources, violations } = validateLaunch(configuration)
  const design = { ...configuration }
  if (!resources || violations.length > 0) {
    return { status: 'invalid-launch', configuration: design, resources, violations, score: null }
  }

  const batteryCapacityWattMinutes = batteries[design.battery].capacityWh * 60
  const state: RunState = { batteryWattMinutes: batteryCapacityWattMinutes, capturedMB: 0, transmittedMB: 0 }
  const timeline: StepTelemetry[] = []
  for (let orbit = 1; orbit <= simulationRules.orbitCount; orbit++) {
    for (let step = 0; step < simulationRules.stepsPerOrbit; step++) {
      timeline.push(simulateStep(design, state, orbit, step))
    }
  }

  const sceneMB = imagers[design.imager].sceneMB
  const outageSteps = timeline.filter(step => step.activity === 'outage').length
  const metrics: MissionMetrics = {
    observationsAttempted: timeline.filter(step => step.observation !== 'none').length,
    observationsCaptured: state.capturedMB / sceneMB,
    usableObservations: Math.floor(state.transmittedMB / sceneMB),
    capturedMB: state.capturedMB,
    deliveredMB: state.transmittedMB,
    storedMB: state.capturedMB - state.transmittedMB,
    partialSceneDeliveredMB: state.transmittedMB % sceneMB,
    poweredSteps: timeline.length - outageSteps,
    outageSteps,
    minimumBatteryWattMinutes: Math.min(...timeline.map(step => step.batteryWattMinutes)),
    batteryCapacityWattMinutes,
    finalBatteryWattMinutes: state.batteryWattMinutes,
  }
  const targetScenes = missionObjectives[design.objective].targetScenes
  const scienceComplete = metrics.usableObservations >= targetScenes
  const completion = { targetScenes, scienceComplete, success: scienceComplete && outageSteps === 0 }
  return {
    status: 'completed',
    configuration: design,
    resources,
    violations: [],
    timeline,
    metrics,
    completion,
    score: scoreMission(metrics, resources, targetScenes, timeline.length),
    findings: explainMission(timeline, metrics, completion),
  }
}
