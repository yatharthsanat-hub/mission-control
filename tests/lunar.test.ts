import assert from 'node:assert/strict'
import { test } from 'node:test'
import 'fake-indexeddb/auto'
import { applyCommand, createAgency, finances, lunarGrantCents, unlockedCapabilities } from '../src/v2/agency.ts'
import type { Command } from '../src/v2/agency.ts'
import { initialAssembly, revise } from '../src/v2/assembly/engine.ts'
import { lunarFrame, propagate, seconds } from '../src/v2/physics/twoBody.ts'
import { environmentModel, lunarEnvironment } from '../src/v2/planning/environments.ts'
import { createFlightModel } from '../src/v2/planning/flightModel.ts'
import { fieldOfViewRad, inertialToFixed, observationGeometry } from '../src/v2/planning/geometry.ts'
import { defaultLunarPlan, lunarProfile } from '../src/v2/planning/lunarScenario.ts'
import { approvalContext, approveForecastMission, approveLunarMission, approveMission, defaultPlan, forecastApprovedMission, restoreMission, reviewLunar } from '../src/v2/planning/mission.ts'
import { environment, groundTrack, orbitalSummary } from '../src/v2/planning/orbit.ts'
import { createMissionRun } from '../src/v2/operations/run.ts'
import { assessLunarSite, readLunarSiteAssessment } from '../src/v2/operations/lunarAssessment.ts'
import { decodeSave, encodeSave } from '../src/v2/saveFormat.ts'
import { readLocal, writeLocal } from '../src/v2/localSaves.ts'

const researchOrders: Command[] = [
  { id: 'training', kind: 'fund-training' },
  { id: 'review', kind: 'submit-review', payload: 'multispectral', axisM: 7_000_000 },
  { id: 'research', kind: 'start-research' },
  { id: 'day2', kind: 'advance-day' },
  { id: 'day3', kind: 'advance-day' },
  { id: 'day4', kind: 'advance-day' },
]
const grant = { id: 'lunar-grant', kind: 'claim-lunar-grant' } as const
const starting = createAgency('Lunar Mission Fixture')
const qualified = researchOrders.reduce(applyCommand, starting)
const agency = applyCommand(qualified, grant)
const caps = unlockedCapabilities(agency)
const draft = ([['imager', 'deck'], ['solar', 'starboard'], ['battery', 'battery'], ['radio', 'radio'], ['fine', 'attitude']] as const)
  .reduce((assembly, [part, host]) => revise(assembly, { kind: 'install', part, id: part, parent: 'bus', host, twist: 0 }, caps), initialAssembly)
const context = approvalContext('agency', agency)
const lunar = approveLunarMission('luna', defaultLunarPlan, draft, context, true)
const orbit = { ...defaultPlan.orbit, altitudeKm: 400, inclinationDeg: 40, nodeDeg: 240 }
const earth = approveForecastMission('terra', { ...defaultPlan, launch: 'extended', orbit }, draft, context, true)
const bins = lunar.analysisProfile.durationS / lunar.analysisProfile.stepS
const close = (a: number, b: number, tolerance: number) => assert.ok(Math.abs(a - b) <= tolerance, a + ' ≈ ' + b)

test('Earth and Moon isolate centre, gravity, axes, limits and communication models', () => {
  const e = environmentModel(environment)
  const m = environmentModel(lunarEnvironment)
  assert.equal(e.radiusM, 6_371_000)
  assert.equal(e.communications.kind, 'surface-terminal')
  assert.equal(m.radiusM, 1_737_400)
  assert.equal(m.communications.kind, 'parallel-earth-service')
  assert.equal(m.gravity.muM3PerS2, 4.902800118e12)
  assert.equal(lunar.orbit.initialState.frame, lunarFrame)
  assert.equal(earth.orbit.initialState.frame, 'earth-centered-j2000')
  assert.throws(() => createFlightModel({ ...earth, environment: lunarEnvironment }, lunarProfile), /frame/)
  assert.throws(() => orbitalSummary({ ...defaultLunarPlan.orbit, altitudeKm: 59 }, lunarFrame), /60–400/)
  assert.throws(() => orbitalSummary({ ...defaultLunarPlan.orbit, eccentricity: .02 }, lunarFrame), /60–400/)
})

test('Moon circular and apsidal states and synthetic spin match independent analytic fixtures', () => {
  const mu = 4_902_800_118_000
  const a = 1_817_400
  const expectedPeriodS = 2 * Math.PI * Math.sqrt(a ** 3 / mu)
  close(lunar.orbit.initialState.periodS, expectedPeriodS, 1e-8)
  const afterQuarter = propagate(lunar.orbit.elements, seconds(expectedPeriodS / 4))
  close(afterQuarter.positionM[0], 0, 1e-6)
  close(afterQuarter.positionM[1], a, 1e-6)
  close(afterQuarter.velocityMps[0], -Math.sqrt(mu / a), 1e-8)
  close(afterQuarter.radiusM - 1_737_400, 80_000, 1e-7)
  const eccentric = orbitalSummary({ ...defaultLunarPlan.orbit, altitudeKm: 180, eccentricity: .05 }, lunarFrame)
  close(eccentric.perigeeM, 84_130, 1e-6)
  close(eccentric.apogeeM, 275_870, 1e-6)
  close(propagate(eccentric.elements, seconds(eccentric.initialState.periodS / 2)).radiusM, 2_013_270, 1e-6)
  const rotated = inertialToFixed([1, 0, 0], 590_148, 2_360_592, 0)
  close(rotated[0], 0, 1e-12)
  close(rotated[1], -1, 1e-12)
  const track = groundTrack(lunar.orbit.elements, 120, lunarEnvironment)
  assert.equal(track.length, 3)
  close(track[0].longitudeDeg, 0, 1e-10)
  assert.ok(track[2].longitudeDeg > track[1].longitudeDeg)
})

test('LROC sampling reference is reproduced without substituting our scenario camera', () => {
  const optics = { pixelIfovRad: 10e-6, widthPixels: 1024, heightPixels: 1024 }
  const geometry = observationGeometry({ rangeM: 50_000, elevationRad: Math.PI / 2, offNadirRad: 0 },
    fieldOfViewRad(optics), optics.pixelIfovRad, 1)
  close(geometry!.gsdM, .5, 1e-8)
  assert.equal(lunar.spacecraft.payload.pixelIfovRad, 45e-6)
})

test('lunar readiness requires optical hardware, power and eligible research', () => {
  const unauthorised = reviewLunar(defaultLunarPlan, draft, context.availableCents, [])
  assert.equal(unauthorised.findings.find(item => item.id === 'Lunar program eligibility')?.status, 'FAIL')
  const noCamera = revise(draft, { kind: 'remove', id: 'imager' }, caps)
  assert.throws(() => approveLunarMission('no-camera', defaultLunarPlan, noCamera, context, true), /failed forecast/)
  const noSolar = revise(draft, { kind: 'remove', id: 'solar' }, caps)
  assert.throws(() => approveLunarMission('no-solar', defaultLunarPlan, noSolar, context, true), /failed forecast/)
  assert.throws(() => approveLunarMission('rf', defaultLunarPlan, draft, context, false), /Acknowledge/)
})

test('lunar contact is occultation, independent of station elevation, and power uses lunar solar derating', () => {
  const model = createFlightModel(lunar, lunar.analysisProfile)
  const front = model.sample(0)
  assert.equal(front.station.inContact, true)
  assert.equal(front.station.elevationDeg, null)
  assert.equal(front.station.rangeM, null)
  assert.equal(front.station.pathLossDb, null)
  assert.equal(front.eclipse, false)
  close(front.generationW, 5.6, 1e-12)
  const back = model.sample(lunar.orbit.initialState.periodS / 2)
  assert.equal(back.station.occulted, true)
  assert.equal(back.station.inContact, false)
  assert.equal(back.eclipse, true)
  assert.equal(back.generationW, 0)
  assert.equal(model.rateBps, 96_000)
  const denied = model.advance({ ...model.initial(), pendingBits: [1000], occupiedBits: 1000 }, back, { observe: false, downlink: true })
  assert.match(denied.downlinkReject, /Moon occults/)
  assert.equal(denied.resources.occupiedBits, 1000)
  assert.equal(denied.resources.chargeJ, 71_990)
  assert.equal(forecastApprovedMission(lunar).communications.linkBudget, 'NOT ASSESSED')
})

test('lunar acquisition, delivery, replay and assessment use actual returned data', () => {
  const forecast = forecastApprovedMission(lunar)
  assert.ok(forecast.accesses.length >= lunar.objective.scenes)
  assert.equal(forecast.communications.delivered, 2)
  const run = createMissionRun(lunar)
  run.command('arm-imaging')
  run.command('arm-downlink')
  run.advance(bins)
  const success = run.snapshot()
  assert.equal(success.verdict, 'Success')
  assert.equal(success.resources.delivered, forecast.communications.delivered)
  assert.equal(success.resources.deliveredBits, 50_331_648)
  assert.equal(success.minChargeJ, forecast.power.minChargeJ)
  assert.deepEqual(createMissionRun(lunar, run.record()).snapshot(), success)
  const result = assessLunarSite(lunar, success)
  assert.equal(result.confidence, 'orbital-evidence')
  assert.equal(result.coverage.deliveredSamples.length, 2)
  assert.equal(result.findings.landingSafety, 'NOT ASSESSED')
  assert.ok(result.findings.bestGsdM! <= lunar.objective.groundSampleLimitM)
  const failed = createMissionRun(lunar)
  failed.command('arm-imaging')
  failed.advance(bins)
  assert.equal(failed.snapshot().resources.captured, 2)
  assert.equal(failed.snapshot().verdict, 'Failure')
  const incomplete = assessLunarSite(lunar, failed.snapshot())
  assert.equal(incomplete.confidence, 'incomplete')
  assert.equal(incomplete.findings.bestGsdM, null)
  assert.equal(incomplete.coverage.deliveredSamples.length, 0)
  assert.equal(incomplete.coverage.acquiredScenes, 2)
})

test('mixed save retains Earth approvals, lunar assessment replay and one-time accounting', async () => {
  assert.throws(() => applyCommand(starting, grant), /Complete/)
  assert.equal(applyCommand(agency, grant), agency)
  assert.throws(() => applyCommand(agency, { ...grant, id: 'again' }), /already been claimed/)
  assert.equal(finances(agency.ledger).cash - finances(qualified.ledger).cash, lunarGrantCents)
  const lunarReserve = { id: lunar.id, kind: 'reserve-mission', cents: lunar.budget.totalCents, destination: 'moon' } as const
  const reserved = applyCommand(agency, lunarReserve)
  assert.equal(applyCommand(reserved, lunarReserve), reserved)
  const second = approveForecastMission(earth.id, earth.plan, draft, approvalContext('agency', reserved), true)
  const both = applyCommand(reserved, { id: second.id, kind: 'reserve-mission', cents: second.budget.totalCents })
  const legacy = approveMission('legacy', { ...defaultPlan, launch: 'extended' }, draft, context)
  assert.deepEqual(restoreMission(JSON.parse(JSON.stringify(legacy))), legacy)
  assert.deepEqual(restoreMission(JSON.parse(JSON.stringify(second))), second)
  assert.deepEqual(restoreMission(JSON.parse(JSON.stringify(lunar))), lunar)
  assert.throws(() => restoreMission({ ...lunar, environment }), /does not match/)
  const flight = createMissionRun(lunar)
  flight.command('arm-imaging')
  flight.command('arm-downlink')
  flight.advance(bins)
  const saved = { id: 'agency', revision: 1, assembly: draft, agency: both, missions: [lunar, second], operations: [flight.record()] }
  await writeLocal(undefined, saved)
  const loaded = decodeSave((await readLocal()).raw!)
  const restored = loaded.missions![0]
  assert.ok(restored.schemaVersion === 3)
  assert.deepEqual(readLunarSiteAssessment(restored, loaded.operations![0]), assessLunarSite(lunar, flight.snapshot()))
  assert.deepEqual(finances(decodeSave(encodeSave(loaded)).agency.ledger), finances(both.ledger))
  assert.equal(loaded.agency.ledger.filter(entry => entry.label === 'Approved lunar reconnaissance plan').length, 1)
  assert.equal(loaded.agency.ledger.filter(entry => entry.label === 'Illustrative lunar program grant').length, 1)
})
