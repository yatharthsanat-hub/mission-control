import assert from 'node:assert/strict'
import { test } from 'node:test'
import 'fake-indexeddb/auto'
import { applyCommand, createAgency, finances } from '../src/v2/agency.ts'
import { initialAssembly, revise } from '../src/v2/assembly/engine.ts'
import { createFlightModel } from '../src/v2/planning/flightModel.ts'
import { approvalContext, approveForecastMission, approveMission, defaultPlan, forecastApprovedMission } from '../src/v2/planning/mission.ts'
import { createMissionRun, restoreRecord } from '../src/v2/operations/run.ts'
import { decodeSave, encodeSave } from '../src/v2/saveFormat.ts'
import type { Save } from '../src/v2/saveFormat.ts'
import { readLocal, writeLocal } from '../src/v2/localSaves.ts'

const assembly = ([['imager', 'deck'], ['solar', 'starboard'], ['battery', 'battery'], ['radio', 'radio']] as const)
  .reduce((draft, [part, host]) => revise(draft, { kind: 'install', id: part, part, host, parent: 'bus', twist: 0 }, []), initialAssembly)
const agency = createAgency('Operations Fixture Agency')
const context = approvalContext('ops-agency', agency)
const plan = { ...defaultPlan, orbit: { ...defaultPlan.orbit, altitudeKm: 400, inclinationDeg: 40, nodeDeg: 240 } }
const mission = approveForecastMission('ops-fixture', plan, assembly, context, true)
const horizon = mission.analysisProfile.durationS
const step = mission.analysisProfile.stepS
const forecast = forecastApprovedMission(mission)
const move = (run: ReturnType<typeof createMissionRun>, to: number) => run.advance((to - run.record().elapsedS) / step)

test('operations initialize approved position, energy, storage and standby; legacy has explicit handling', () => {
  const run = createMissionRun(mission)
  const start = run.snapshot()
  assert.equal(start.elapsedS, 0)
  assert.equal(start.imaging, false)
  assert.equal(start.radio, false)
  assert.equal(start.resources.chargeJ, 72_000)
  assert.equal(start.resources.occupiedBits, 0)
  assert.deepEqual(start.orbital.positionM, mission.orbit.initialState.positionM)
  assert.ok(Math.abs(start.orbital.altitudeM - 400_000) < 1e-8)
  const legacy = approveMission('legacy', defaultPlan, assembly, context)
  assert.throws(() => createMissionRun(legacy), /reapprove/)
  assert.throws(() => run.advance(-1), /integration bins/)
})

test('manual commands outside opportunity reject and eclipse consumes housekeeping energy', () => {
  const run = createMissionRun(mission)
  run.command('image-now')
  run.command('downlink-now')
  run.advance(1)
  const after = run.snapshot()
  assert.equal(after.resources.captured, 0)
  assert.equal(after.resources.deliveredBits, 0)
  assert.equal(after.events.filter(event => event.kind === 'command').length, 2)
  assert.ok(after.events.some(event => event.text.startsWith('Capture rejected.')))
  assert.ok(after.events.some(event => event.text.startsWith('Transmission rejected. Station')))
  const eclipse = forecast.eclipses.find(window => window.startS >= after.elapsedS)!
  move(run, eclipse.startS)
  const before = run.snapshot()
  assert.equal(before.upcoming.eclipse, true)
  assert.equal(before.upcoming.generationW, 0)
  run.advance(1)
  assert.equal(run.snapshot().resources.chargeJ, before.resources.chargeJ - 2 * step)
})

test('valid manual capture stores a scene and partial downlink conserves data', () => {
  const run = createMissionRun(mission)
  move(run, forecast.accesses[0].startS)
  assert.equal(run.snapshot().upcoming.access.available, true)
  run.command('image-now')
  run.advance(1)
  assert.equal(run.snapshot().resources.captured, 1)
  const sceneBits = mission.spacecraft.payload.sceneBits
  assert.equal(run.snapshot().resources.occupiedBits, sceneBits)
  const contact = forecast.contacts.find(window => window.startS >= run.record().elapsedS)!
  move(run, contact.startS)
  assert.equal(run.snapshot().upcoming.station.inContact, true)
  run.command('downlink-now')
  run.advance(1)
  const partial = run.snapshot().resources
  assert.equal(partial.deliveredBits, 256_000 * step)
  assert.equal(partial.delivered, 0)
  assert.equal(partial.occupiedBits + partial.deliveredBits, sceneBits)
  run.command('arm-downlink')
  move(run, horizon)
  assert.equal(run.snapshot().verdict, 'Partial success')
  assert.equal(run.snapshot().resources.delivered, 1)
  assert.equal(run.snapshot().resources.occupiedBits, 0)
})

test('shared operations rule rejects unsuitable spectral bands, storage and energy deficits', () => {
  const model = createFlightModel(mission, mission.analysisProfile)
  const frame = model.sample(forecast.accesses[0].startS)
  const eclipseFrame = { ...frame, eclipse: true, generationW: 0 }
  const requests = { observe: true, downlink: false }
  const drained = model.advance({ ...model.initial(), chargeJ: 0 }, eclipseFrame, requests)
  assert.match(drained.captureReject, /Insufficient power/)
  assert.equal(drained.resources.captured, 0)
  assert.equal(drained.energy.unservedJ, 10)
  const storage = model.advance({ ...model.initial(), occupiedBits: mission.spacecraft.storageCapacityBits }, frame, requests)
  assert.match(storage.captureReject, /storage/)
  const unsuitable = createFlightModel({ ...mission, spacecraft: { ...mission.spacecraft,
    payload: { ...mission.spacecraft.payload, bandsM: [] } } }, mission.analysisProfile)
  assert.match(unsuitable.advance(unsuitable.initial(), frame, requests).captureReject, /spectrally/)
})

test('imaging without downlink yields missed waiting contacts and fails despite two captures', () => {
  const run = createMissionRun(mission)
  run.command('arm-imaging')
  move(run, horizon)
  const end = run.snapshot()
  assert.equal(end.complete, true)
  assert.equal(end.verdict, 'Failure')
  assert.equal(end.resources.captured, 2)
  assert.equal(end.resources.delivered, 0)
  assert.equal(end.resources.occupiedBits, 2 * mission.spacecraft.payload.sceneBits)
  assert.ok(end.missedContacts > 0)
  assert.throws(() => run.command('downlink-now'), /unavailable/)
})

test('equivalent command boundaries reproduce forecast independently of playback batching and replay', () => {
  const fine = createMissionRun(mission)
  const coarse = createMissionRun(mission)
  for (const run of [fine, coarse]) {
    run.command('arm-imaging')
    run.command('arm-downlink')
  }
  for (let elapsed = 0; elapsed < horizon; elapsed += 60) fine.advance(12)
  coarse.advance(horizon / step)
  const end = coarse.snapshot()
  assert.deepEqual(fine.snapshot(), end)
  assert.deepEqual(createMissionRun(mission, JSON.parse(JSON.stringify(fine.record()))).snapshot(), end)
  assert.equal(end.verdict, 'Success')
  assert.equal(end.resources.captured, forecast.science.captured)
  assert.equal(end.resources.delivered, forecast.communications.delivered)
  assert.equal(end.resources.deliveredBits, forecast.communications.deliveredBits)
  assert.equal(end.minChargeJ, forecast.power.minChargeJ)
  assert.equal(end.resources.chargeJ, forecast.power.endChargeJ)
  assert.equal(end.targetWindows, forecast.accesses.length)
  assert.equal(end.contactWindows, forecast.contacts.length)
  assert.equal(end.missedObservations, 0)
})

test('schema 5 checkpoints round-trip pending commands without repeating financial entries', async () => {
  const funded = applyCommand(agency, { id: mission.id, kind: 'reserve-mission', cents: mission.budget.totalCents })
  const base: Save = { id: 'ops-agency', revision: 0, agency: funded, assembly, missions: [mission] }
  const raw = await writeLocal(undefined, base)
  const run = createMissionRun(mission)
  run.command('arm-imaging')
  run.command('arm-downlink')
  run.advance(120)
  run.command('image-now')
  const working = { ...base, revision: 1, operations: [run.record()] }
  await writeLocal(raw, working)
  const stored = (await readLocal()).raw!
  const loaded = decodeSave(stored)
  assert.deepEqual(loaded.agency.ledger, funded.ledger)
  assert.deepEqual(createMissionRun(loaded.missions![0], loaded.operations![0]).snapshot(), run.snapshot())
  assert.throws(() => restoreRecord({ ...run.record(), elapsedS: 1 }, mission), /checkpoint/)
  assert.throws(() => restoreRecord({ ...run.record(), orders: [{ atS: 605, kind: 'image-now' }] }, mission), /command/)
  move(run, horizon)
  const finished = { ...loaded, revision: 2, operations: [run.record()] }
  await writeLocal(stored, finished)
  const rerun = decodeSave(encodeSave(finished))
  assert.deepEqual(finances(rerun.agency.ledger), finances(funded.ledger))
  assert.equal(rerun.agency.commands.filter(command => command.kind === 'reserve-mission').length, 1)
  assert.throws(() => decodeSave(encodeSave({ ...working, operations: [run.record(), run.record()] })), /checkpoint/)
})
