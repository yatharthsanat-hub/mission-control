import assert from 'node:assert/strict'
import test from 'node:test'
import { missionEntry } from '../src/v2/missionEntry.ts'
import { createDemo, demoCheckpointKey, readDemoCheckpoint } from '../src/v2/operations/demo.ts'
import { createMissionRun } from '../src/v2/operations/run.ts'
import { decodeSave, encodeSave } from '../src/v2/saveFormat.ts'

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
