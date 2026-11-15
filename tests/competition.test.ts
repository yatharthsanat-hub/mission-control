import assert from 'node:assert/strict'
import test from 'node:test'
import { missionEntry } from '../src/v2/missionEntry.ts'
import { createDemo, demoCheckpointKey, readDemoCheckpoint } from '../src/v2/operations/demo.ts'
import { createMissionRun } from '../src/v2/operations/run.ts'
import { decodeSave, encodeSave } from '../src/v2/saveFormat.ts'
import { forecastApprovedMission } from '../src/v2/planning/mission.ts'
import { finishControl, nextOpportunity, restoreInspection, tutorialParts, tutorialStage } from '../src/v2/operations/tutorial.ts'

test('mission entry points retain agency, assembly and lunar research prerequisites', () => {
  const { save } = createDemo()
  assert.equal(missionEntry('earth', null).href, '?mode=headquarters&next=earth')
  assert.equal(missionEntry('moon', null).href, '?mode=headquarters&next=moon')
  assert.equal(missionEntry('earth', { ...save, assembly: undefined }).href, '?mode=assembly&next=earth')
  assert.equal(missionEntry('moon', save).href, '?mode=headquarters&next=moon')
  assert.equal(missionEntry('earth', save).href, '?mode=planning')
})

test('demo is a valid funded approval with distinct success and undelivered-science outcomes', () => {
  const { save, mission } = createDemo()
  assert.deepEqual(decodeSave(encodeSave(save)).missions, [mission])
  const success = createMissionRun(mission)
  success.command('arm-imaging')
  success.command('arm-downlink')
  success.advance(100_000)
  assert.equal(success.snapshot().verdict, 'Success')
  assert.equal(success.snapshot().resources.delivered, mission.objective.scenes)
  const failure = createMissionRun(mission)
  failure.command('arm-imaging')
  failure.advance(100_000)
  assert.equal(failure.snapshot().verdict, 'Failure')
  assert.ok(failure.snapshot().resources.captured > 0)
  assert.equal(failure.snapshot().resources.delivered, 0)
})

test('isolated demo checkpoint replays and ignores invalid or inaccessible session data', () => {
  const { mission } = createDemo()
  const run = createMissionRun(mission)
  run.command('arm-imaging')
  run.advance(25)
  const record = run.record()
  const restored = readDemoCheckpoint(mission, {
    getItem(key) {
      assert.equal(key, demoCheckpointKey)
      return JSON.stringify(record)
    },
  })
  assert.deepEqual(createMissionRun(mission, restored).snapshot(), run.snapshot())
  assert.equal(readDemoCheckpoint(mission, { getItem: () => '{"elapsedS":"invalid"}' }), undefined)
  assert.equal(readDemoCheckpoint(mission, { getItem: () => { throw new Error('Storage blocked') } }), undefined)
})

test('guided stages require hardware inspection, a real exposure and a complete downlink', () => {
  const { mission } = createDemo()
  const run = createMissionRun(mission)
  const forecast = forecastApprovedMission(mission)
  const stage = (started = true, inspected: readonly (typeof tutorialParts)[number][] = tutorialParts) =>
    tutorialStage(started, inspected, run.snapshot())
  assert.equal(stage(false, []), 0)
  assert.equal(stage(true, tutorialParts.slice(0, 3)), 1)
  assert.equal(stage(), 2)
  assert.equal(finishControl(true, false, true, 0).enabled, false)
  const pass = nextOpportunity(forecast.accesses, 0)!
  run.advance(pass.startS / forecast.stepS)
  assert.equal(stage(), 3)
  assert.equal(run.snapshot().resources.captured, 0)
  run.command('arm-imaging')
  run.advance(1)
  assert.equal(stage(), 4)
  assert.ok(run.snapshot().resources.occupiedBits > 0)
  assert.equal(finishControl(true, false, true, 0).enabled, false)
  run.command('arm-downlink')
  while (run.snapshot().resources.delivered === 0) {
    const one = nextOpportunity(forecast.contacts, run.snapshot().elapsedS)
    assert.ok(one)
    run.advance((one.endS - run.snapshot().elapsedS) / forecast.stepS)
  }
  assert.equal(stage(), 5)
  assert.equal(run.snapshot().complete, false)
  assert.equal(finishControl(true, false, true, run.snapshot().resources.delivered).enabled, true)
  run.advance(forecast.durationS / forecast.stepS)
  const outcome = run.snapshot()
  assert.equal(outcome.verdict, 'Success')
  assert.deepEqual(createMissionRun(mission, run.record()).snapshot(), outcome)
  assert.equal(finishControl(true, true, true, outcome.resources.delivered).enabled, false)
})

test('independent finish may fail after start and explains flight availability', () => {
  assert.match(finishControl(false, false, false, 0).explanation, /Start the mission/)
  assert.equal(finishControl(false, false, false, 0).enabled, false)
  const allowed = finishControl(true, false, false, 0)
  assert.equal(allowed.enabled, true)
  assert.match(allowed.explanation, /every remaining five-second interval/)
  assert.match(finishControl(true, true, false, 0).explanation, /science review/)
  assert.equal(finishControl(true, true, false, 0).enabled, false)
  assert.deepEqual(restoreInspection({ getItem: () => '["radio","bogus","radio"]' }), ['radio'])
})
