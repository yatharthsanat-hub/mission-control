import type { SimulationResult } from './simulate.ts'

export interface MissionDeltas {
  massGrams: number
  costCredits: number
  massHeadroomGrams: number
  remainingCredits: number
  usableObservations: number
  deliveredMB: number
  storedMB: number
  outageSteps: number
  minimumBatteryWattMinutes: number
  score: number
}

export type MissionComparison =
  | { status: 'unavailable'; reason: 'invalid-launch' | 'different-objectives'; message: string }
  | { status: 'comparable'; previousSuccess: boolean; revisedSuccess: boolean; deltas: MissionDeltas }

/** Compare completed attempts for the same brief. Each delta is revised minus previous. */
export function compareMissions(previous: SimulationResult, revised: SimulationResult): MissionComparison {
  if (previous.status !== 'completed' || revised.status !== 'completed') {
    return { status: 'unavailable', reason: 'invalid-launch', message: 'Complete both simulations to compare mission performance.' }
  }
  if (previous.configuration.objective !== revised.configuration.objective) {
    return { status: 'unavailable', reason: 'different-objectives', message: 'Start a new comparison for the selected science objective.' }
  }
  return {
    status: 'comparable',
    previousSuccess: previous.completion.success,
    revisedSuccess: revised.completion.success,
    deltas: {
      massGrams: revised.resources.massGrams - previous.resources.massGrams,
      costCredits: revised.resources.costCredits - previous.resources.costCredits,
      massHeadroomGrams: revised.resources.massHeadroomGrams - previous.resources.massHeadroomGrams,
      remainingCredits: revised.resources.remainingCredits - previous.resources.remainingCredits,
      usableObservations: revised.metrics.usableObservations - previous.metrics.usableObservations,
      deliveredMB: revised.metrics.deliveredMB - previous.metrics.deliveredMB,
      storedMB: revised.metrics.storedMB - previous.metrics.storedMB,
      outageSteps: revised.metrics.outageSteps - previous.metrics.outageSteps,
      minimumBatteryWattMinutes: revised.metrics.minimumBatteryWattMinutes - previous.metrics.minimumBatteryWattMinutes,
      score: revised.score.total - previous.score.total,
    },
  }
}
