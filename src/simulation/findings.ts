import { simulationRules } from './catalog.ts'
import type { MissionCompletion, MissionFinding, MissionMetrics, StepTelemetry } from './types.ts'

export function explainMission(
  steps: readonly StepTelemetry[],
  metrics: MissionMetrics,
  completion: MissionCompletion,
): MissionFinding[] {
  const findings: MissionFinding[] = []
  if (!completion.scienceComplete) {
    findings.push({
      code: 'science-shortfall',
      message: `${metrics.usableObservations} of ${completion.targetScenes} required scenes reached the science team.`,
      suggestion: 'Use the observation and downlink findings to identify what held back delivery.',
    })
  }
  if (metrics.outageSteps > 0) {
    const first = steps.find(step => step.activity === 'outage')
    findings.push({
      code: 'power-outage',
      message: `Housekeeping had an energy shortfall in ${metrics.outageSteps} steps (${simulationRules.stepMinutes} minutes per step), starting in orbit ${first?.orbit}, step ${first?.step}.`,
      suggestion: 'Try a higher reserve, more battery capacity, or a lower-draw radio.',
    })
  }
  if (metrics.observationsAttempted < completion.targetScenes) {
    findings.push({
      code: 'observation-opportunities',
      message: `This orbit offered ${metrics.observationsAttempted} target views for a goal of ${completion.targetScenes} scenes.`,
      suggestion: 'Choose the orbit with more observation windows for this objective.',
    })
  }

  const skippedOperations = [
    { code: 'capture-storage', count: steps.filter(step => step.observation === 'storage-full').length,
      reason: 'captures were skipped because storage was full', suggestion: 'Clear the queue sooner with a higher-rate radio or more contact time.' },
    { code: 'capture-reserve', count: steps.filter(step => step.observation === 'reserve').length,
      reason: 'captures would have drawn the battery below the selected reserve', suggestion: 'Check solar output and battery capacity before lowering the reserve.' },
    { code: 'capture-outage', count: steps.filter(step => step.observation === 'outage').length,
      reason: 'observation windows coincided with a housekeeping outage', suggestion: 'Restore power continuity to use these observation windows.' },
    { code: 'capture-priority', count: steps.filter(step => step.observation === 'downlink-priority').length,
      reason: 'captures were skipped while queued data had downlink priority', suggestion: 'Review when the selected orbit offers observation and contact windows.' },
    { code: 'downlink-reserve', count: steps.filter(step => step.downlink === 'reserve').length,
      reason: 'contact steps with queued data would have drawn the battery below the selected reserve', suggestion: 'Try a lower-draw radio or more usable battery capacity.' },
    { code: 'downlink-outage', count: steps.filter(step => step.downlink === 'outage').length,
      reason: 'contact steps with queued data coincided with a housekeeping outage', suggestion: 'Restore power continuity to use these contacts.' },
  ] as const

  for (const { code, count, reason, suggestion } of skippedOperations) {
    if (count > 0) findings.push({ code, message: `Steps affected: ${count}. At these steps, ${reason}.`, suggestion })
  }

  if (metrics.storedMB > 0) {
    const partial = metrics.partialSceneDeliveredMB > 0
      ? ` The final incomplete scene has ${metrics.partialSceneDeliveredMB} MB already on the ground.`
      : ''
    findings.push({
      code: 'undelivered-data',
      message: `${metrics.storedMB} MB stayed on board when the contact schedule ended.${partial}`,
      suggestion: 'Compare radio throughput, contact opportunities and power-related transmission skips.',
    })
  }
  const chargeTarget = metrics.batteryCapacityWattMinutes * simulationRules.score.referenceChargePercent / 100
  if (metrics.outageSteps === 0 && metrics.minimumBatteryWattMinutes < chargeTarget) {
    findings.push({
      code: 'low-charge',
      message: `Battery charge fell to ${Math.round(100 * metrics.minimumBatteryWattMinutes / metrics.batteryCapacityWattMinutes)}%, below the scoring reference of ${simulationRules.score.referenceChargePercent}%.`,
      suggestion: 'Try more battery capacity or reduce optional loads to preserve charge through eclipse.',
    })
  }
  return findings
}
