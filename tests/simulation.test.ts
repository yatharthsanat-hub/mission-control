import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  batteries, bus, imagers, missionObjectives, orbitOptions, radios, simulationRules,
} from '../src/simulation/catalog.ts'
import type { SpacecraftConfiguration } from '../src/simulation/catalog.ts'
import { compareMissions } from '../src/simulation/compare.ts'
import { checkResourceLimits, sumLaunchResources, validateLaunch } from '../src/simulation/launch.ts'
import { simulateMission } from '../src/simulation/simulate.ts'

const coastal = {
  objective: 'coastal', orbit: 'midInclination', imager: 'visible', solarArray: 'bodyMounted',
  battery: 'compact', radio: 'lowRate', reservePercent: 15,
} as const satisfies SpacecraftConfiguration

const crop = {
  ...coastal, objective: 'crop', orbit: 'nearPolar', imager: 'redNir', radio: 'highRate',
} as const satisfies SpacecraftConfiguration

function run(design: SpacecraftConfiguration) {
  const result = simulateMission(design)
  assert.equal(result.status, 'completed')
  return result
}

test('coastal flood mapping returns seven scenes and scores full points on a light, low-cost design', () => {
  const result = run(coastal)
  assert.equal(result.resources.massGrams, 3300)
  assert.equal(result.resources.costCredits, 73)
  assert.deepEqual(result.completion, { targetScenes: 7, scienceComplete: true, success: true })
  assert.equal(result.metrics.observationsAttempted, 18)
  assert.equal(result.metrics.observationsCaptured, 16)
  assert.equal(result.metrics.usableObservations, 7)
  assert.equal(result.metrics.deliveredMB, 210)
  assert.equal(result.metrics.storedMB, 270)
  assert.equal(result.metrics.outageSteps, 0)
  assert.equal(result.metrics.minimumBatteryWattMinutes, 50)
  assert.deepEqual(result.score, { science: 70, operations: 20, efficiency: 10, total: 100, displayTotal: 100 })
  const upgraded = run({ ...coastal, radio: 'highRate' })
  assert.equal(upgraded.completion.success, true)
  assert.ok(upgraded.metrics.usableObservations > result.metrics.usableObservations)
  assert.equal(upgraded.score.science, 70)
  assert.ok(upgraded.score.total < result.score.total)
  assert.ok(upgraded.findings.some(finding => finding.code === 'low-charge'))
})

test('imager compatibility and missing selections give specific launch violations', () => {
  const incomplete = validateLaunch({ objective: 'crop', imager: 'visible' })
  assert.equal(incomplete.resources, null)
  assert.equal(incomplete.violations.filter(violation => violation.code === 'invalid-selection').length, 5)
  const rejected = simulateMission({ ...crop, imager: 'visible' })
  assert.equal(rejected.status, 'invalid-launch')
  assert.equal(rejected.score, null)
  assert.deepEqual(rejected.violations.map(violation => violation.code), ['incompatible-imager'])
  const [violation] = rejected.violations
  assert.equal(violation.code, 'incompatible-imager')
  assert.deepEqual(violation.missingBands, ['near-infrared'])
})

test('launch validation rejects non-string catalog selections from parsed inputs', () => {
  const malformed = { ...coastal, objective: ['coastal'], radio: ['lowRate'] }
  const result = simulateMission(malformed as unknown as SpacecraftConfiguration)
  assert.equal(result.status, 'invalid-launch')
  assert.deepEqual(result.violations.map(violation => {
    assert.equal(violation.code, 'invalid-selection')
    return violation.field
  }), ['objective', 'radio'])
  assert.equal(result.score, null)
})

test('exact limits pass and one gram or credit over each limit fails', () => {
  assert.deepEqual(checkResourceLimits(sumLaunchResources(3800, 3800, 100, 100)), [])
  assert.deepEqual(checkResourceLimits(sumLaunchResources(3801, 3800, 100, 100)).map(v => v.code), ['mass-limit'])
  assert.deepEqual(checkResourceLimits(sumLaunchResources(3800, 3800, 101, 100)).map(v => v.code), ['budget-limit'])
})

test('an over-mass and over-budget design reports both overages without running', () => {
  const result = simulateMission({ ...crop, orbit: 'midInclination', solarArray: 'deployable', battery: 'extended' })
  assert.equal(result.status, 'invalid-launch')
  assert.equal(result.score, null)
  assert.equal('timeline' in result, false)
  assert.equal(result.resources?.massHeadroomGrams, -1050)
  assert.equal(result.resources?.remainingCredits, -9)
  assert.deepEqual(result.violations.map(v => v.code), ['mass-limit', 'budget-limit'])
})

test('crop low-rate downlink falls short, fills storage, and leaves only fully returned scenes usable', () => {
  const result = run({ ...crop, radio: 'lowRate' })
  assert.equal(result.resources.massGrams, 3700)
  assert.equal(result.resources.costCredits, 89)
  assert.deepEqual(result.completion, { targetScenes: 8, scienceComplete: false, success: false })
  assert.equal(result.metrics.usableObservations, 6)
  assert.equal(result.metrics.outageSteps, 0)
  assert.equal(result.metrics.storedMB, 240)
  assert.equal(result.timeline.filter(step => step.observation === 'storage-full').length, 8)
  assert.ok(result.findings.some(finding => finding.code === 'capture-storage'))
  assert.ok(result.findings.some(finding => finding.code === 'undelivered-data'))
  const firstContact = result.timeline[12]
  assert.equal(firstContact.transmittedMB, 30)
  assert.equal(firstContact.deliveredScenes, 0)
  assert.equal(result.timeline[13].deliveredScenes, 1)
})

test('crop reserve change trades returned scenes for power continuity and a successful mission', () => {
  const aggressive = run(crop)
  const conservative = run({ ...crop, reservePercent: 35 })
  assert.equal(aggressive.resources.massGrams, 4000)
  assert.equal(aggressive.resources.costCredits, 98)
  assert.deepEqual(aggressive.resources, conservative.resources)
  assert.deepEqual(aggressive.completion, { targetScenes: 8, scienceComplete: true, success: false })
  assert.equal(conservative.completion.success, true)
  assert.equal(aggressive.metrics.usableObservations, 13)
  assert.equal(conservative.metrics.usableObservations, 9)
  assert.equal(aggressive.metrics.deliveredMB, 780)
  assert.equal(conservative.metrics.deliveredMB, 540)
  assert.equal(conservative.metrics.storedMB, 180)
  assert.deepEqual(aggressive.timeline.filter(step => step.activity === 'outage').map(step => step.step),
    [16, 17, 16, 17, 16, 17, 16, 17, 16, 17, 16, 17])
  assert.ok(aggressive.findings.some(finding => finding.code === 'power-outage'))
  assert.ok(conservative.findings.some(finding => finding.code === 'downlink-reserve'))
  assert.equal(conservative.metrics.outageSteps, 0)

  // The first eclipse starts at 120 W·min. Each radio step draws 50 including housekeeping.
  assert.deepEqual(aggressive.timeline.slice(11, 18).map(step => step.batteryWattMinutes), [120, 70, 20, 10, 0, 0, 0])
  assert.deepEqual(conservative.timeline.slice(11, 18).map(step => step.batteryWattMinutes), [120, 70, 60, 50, 40, 30, 20])
  assert.equal(aggressive.timeline[15].activity, 'idle')
  assert.equal(aggressive.timeline[15].housekeepingShortfallWattMinutes, 0)
  assert.equal(aggressive.timeline[16].housekeepingShortfallWattMinutes, 10)
  assert.equal(aggressive.timeline[18].activity, 'idle')
  assert.equal(aggressive.timeline[18].batteryWattMinutes, 20)
  assert.deepEqual([aggressive.score.displayTotal, conservative.score.displayTotal], [84, 92])

  const comparison = compareMissions(aggressive, conservative)
  assert.equal(comparison.status, 'comparable')
  assert.equal(comparison.previousSuccess, false)
  assert.equal(comparison.revisedSuccess, true)
  assert.equal(comparison.deltas.usableObservations, -4)
  assert.equal(comparison.deltas.outageSteps, -12)
  assert.ok(comparison.deltas.score > 0)
})

test('an orbit with too few suitable views explains the observation limit and partial delivery', () => {
  const result = run({ ...crop, orbit: 'midInclination', radio: 'lowRate' })
  assert.equal(result.metrics.observationsAttempted, 6)
  assert.equal(result.metrics.usableObservations, 3)
  assert.equal(result.metrics.partialSceneDeliveredMB, 30)
  assert.equal(result.metrics.deliveredMB, 210)
  assert.equal(result.metrics.storedMB, 150)
  assert.equal(result.score.science, 70 * (3 / 8))
  assert.equal(result.completion.success, false)
  assert.ok(result.findings.some(finding => finding.code === 'observation-opportunities'))
  assert.ok(result.findings.some(finding => finding.code === 'science-shortfall'))
})

test('sunlight supplies simultaneous loads at full charge before excess energy is curtailed', () => {
  const result = run(coastal)
  const firstStep = result.timeline[0]
  assert.equal(firstStep.batteryWattMinutes, 120)
  assert.equal(firstStep.curtailedWattMinutes, 20)
  assert.equal(firstStep.storedMB, 0)
  assert.equal(firstStep.deliveredScenes, 0)

  // On step 2 the 6 W array exactly covers the 2 W bus and 4 W imager.
  const capture = result.timeline[2]
  assert.equal(capture.activity, 'capture')
  assert.equal(capture.batteryWattMinutes, 120)
  assert.equal(capture.curtailedWattMinutes, 0)

  // On step 9 the radio and bus use 5 W. Only the remaining 1 W spills.
  const contact = result.timeline[9]
  assert.equal(contact.activity, 'downlink')
  assert.equal(contact.batteryWattMinutes, 120)
  assert.equal(contact.curtailedWattMinutes, 5)
})

test('overlapping contact and imaging use the start-of-step queue and reserve policy', (context) => {
  const contacts = orbitOptions.nearPolar.contactStepsByOrbit
  const original = contacts.map(steps => [...steps])
  context.after(() => contacts.splice(0, contacts.length, ...original))
  contacts[0] = [2, 3, 12, 13]
  contacts[2] = [2, 12, 13]

  const result = run({ ...crop, reservePercent: 35 })
  const [emptyQueue, queuedData] = result.timeline.slice(2, 4)
  assert.equal(emptyQueue.downlink, 'empty')
  assert.equal(emptyQueue.observation, 'captured')
  assert.equal(emptyQueue.transmittedMB, 0)
  assert.equal(queuedData.downlink, 'transmitted')
  assert.equal(queuedData.transmittedMB, 60)
  assert.equal(queuedData.optionalWatts, radios.highRate.activeWatts)
  assert.equal(queuedData.observation, 'downlink-priority')
  assert.equal(queuedData.capturedMB, 0)

  const blockedByReserve = result.timeline[38]
  assert.equal(result.timeline[37].storedMB, 30)
  assert.equal(blockedByReserve.downlink, 'reserve')
  assert.equal(blockedByReserve.observation, 'downlink-priority')
  assert.equal(blockedByReserve.activity, 'idle')
  assert.equal(blockedByReserve.batteryWattMinutes, 80)
  assert.equal(blockedByReserve.storedMB, 30)
})

test('repeat runs are identical and completed results retain a snapshot of the submitted design', () => {
  const draft: SpacecraftConfiguration = { ...crop }
  const original = run(draft)
  assert.deepEqual(run(draft), original)
  draft.reservePercent = 35
  assert.deepEqual(original.configuration, crop)
  assert.notDeepEqual(run(draft), original)
  const differentBrief = compareMissions(original, run(coastal))
  assert.equal(differentBrief.status, 'unavailable')
  assert.equal(differentBrief.reason, 'different-objectives')
  const invalidComparison = compareMissions(original, simulateMission({ ...crop, imager: 'visible' }))
  assert.equal(invalidComparison.status, 'unavailable')
  assert.equal(invalidComparison.reason, 'invalid-launch')
})

test('the full catalog respects launch, resource, and scoring rules', () => {
  const objectives = ['coastal', 'crop'] as const
  const orbits = ['midInclination', 'nearPolar'] as const
  const arrays = ['bodyMounted', 'deployable'] as const
  const batteryOptions = ['compact', 'extended'] as const
  const radioOptions = ['lowRate', 'highRate'] as const
  const { stepMinutes, orbitCount, stepsPerOrbit, reservePercents } = simulationRules
  const imagerOptions = ['visible', 'redNir'] as const

  for (const objective of objectives) {
    const successes: number[] = []
    const failures: number[] = []
    let rejected = 0
    for (const orbit of orbits) {
      for (const solarArray of arrays) {
        for (const battery of batteryOptions) {
          for (const radio of radioOptions) {
            for (const reservePercent of reservePercents) {
              for (const imager of imagerOptions) {
                const result = simulateMission({ objective, orbit, solarArray, battery, radio, reservePercent, imager })
                if (result.status === 'invalid-launch') {
                  assert.ok(result.violations.length > 0)
                  assert.equal(result.score, null)
                  rejected++
                  continue
                }
                assert.equal(imager, objective === 'coastal' ? 'visible' : 'redNir')
                assert.equal(result.timeline.length, orbitCount * stepsPerOrbit)
                const capacity = batteries[battery].capacityWh * 60
                let charge = capacity
                let captured = 0
                let delivered = 0
                for (const step of result.timeline) {
                  assert.ok(step.transmittedMB <= captured - delivered)
                  captured += step.capturedMB
                  delivered += step.transmittedMB
                  assert.ok(step.batteryWattMinutes >= 0 && step.batteryWattMinutes <= capacity)
                  assert.ok(step.storedMB >= 0 && step.storedMB <= bus.storageMB)
                  assert.equal(step.storedMB, captured - delivered)
                  assert.equal(step.deliveredScenes, Math.floor(delivered / imagers[imager].sceneMB))
                  if (!step.sunlit) assert.equal(step.solarWatts, 0)
                  if (!step.inContact) assert.equal(step.transmittedMB, 0)
                  assert.ok(step.transmittedMB <= radios[radio].rateMBPerMinute * stepMinutes)
                  if (step.optionalWatts > 0) assert.ok(step.batteryWattMinutes >= capacity * reservePercent / 100)
                  assert.equal(
                    charge + (step.solarWatts - bus.housekeepingWatts - step.optionalWatts) * stepMinutes,
                    step.batteryWattMinutes + step.curtailedWattMinutes - step.housekeepingShortfallWattMinutes,
                  )
                  charge = step.batteryWattMinutes
                }
                assert.equal(result.metrics.deliveredMB + result.metrics.storedMB, result.metrics.capturedMB)
                assert.equal(result.metrics.finalBatteryWattMinutes, charge)
                assert.ok(result.score.total >= 0 && result.score.total <= 100)
                assert.ok(result.score.science <= 70 && result.score.operations <= 20 && result.score.efficiency <= 10)
                assert.equal(result.completion.success,
                  result.metrics.usableObservations >= missionObjectives[objective].targetScenes && result.metrics.outageSteps === 0)
                const scores = result.completion.success ? successes : failures
                scores.push(result.score.total)
              }
            }
          }
        }
      }
    }
    assert.equal(rejected + successes.length + failures.length, 64)
    assert.ok(successes.length > 0 && failures.length > 0)
    assert.ok(Math.min(...successes) > Math.max(...failures))
  }
})
