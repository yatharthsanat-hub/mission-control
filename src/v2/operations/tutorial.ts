import type { PartId } from '../assembly/catalog.ts'
import type { MissionTelemetry } from './run.ts'

export const tutorialParts = ['imager', 'solar', 'battery', 'radio'] as const satisfies readonly PartId[]
export type TutorialPart = typeof tutorialParts[number]
export const tutorialStages = ['Briefing', 'Spacecraft', 'Plan the pass', 'Acquire', 'Downlink', 'Review'] as const
export const tutorialInspectionKey = 'mission-control-tutorial-inspection-1'

export function tutorialStage(started: boolean, inspected: readonly TutorialPart[], data: MissionTelemetry) {
  if (data.complete) return 5
  if (!started) return 0
  if (data.resources.captured > 0) return data.resources.delivered > 0 ? 5 : 4
  if (data.elapsedS === 0 && !tutorialParts.every(part => inspected.includes(part))) return 1
  if (data.upcoming.access.available || data.imaging) return 3
  return 2
}

export function finishControl(started: boolean, complete: boolean, guided: boolean, delivered: number) {
  if (complete) return { enabled: false, explanation: 'The approved flight duration has ended. Open the science review to see the outcome.' }
  if (!started) return { enabled: false, explanation: 'Start the mission to enable flight controls.' }
  if (guided && delivered === 0) return { enabled: false, explanation: 'In the tutorial, acquire and deliver one complete scene yourself before finishing.' }
  return { enabled: true, explanation: 'Simulate every remaining five-second interval with the current imaging and radio settings, then open the science review. Available windows can still pass unused.' }
}

export function nextOpportunity(windows: readonly { startS: number; endS: number }[], elapsedS: number) {
  return windows.find(window => window.endS > elapsedS)
}

export function restoreInspection(storage: Pick<Storage, 'getItem'>): TutorialPart[] {
  try {
    const parts: unknown = JSON.parse(storage.getItem(tutorialInspectionKey) ?? '[]')
    return Array.isArray(parts) ? tutorialParts.filter(part => parts.includes(part)) : []
  } catch { return [] }
}
