import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { applyCommand, createAgency, finances, unlockedCapabilities } from '../src/v2/agency.ts'
import { decodeSave, encodeSave } from '../src/v2/saveFormat.ts'
import { earthGravity, inertialFrame, metres, propagate, radians, seconds, tdbEpoch } from '../src/v2/physics/twoBody.ts'
import { assessTraining } from '../src/v2/training.ts'

const initial = () => createAgency('Vector Research')
const fund = { id: 'fund-1', kind: 'fund-training' } as const
const review = { id: 'review-1', kind: 'submit-review', payload: 'multispectral', axisM: 7_000_000 } as const

test('agency creation, funding, review settlement and idempotency reconcile to exact cents', () => {
  const agency = initial()
  assert.throws(() => createAgency('  '), /agency name/)
  const funded = applyCommand(agency, fund)
  assert.equal(agency.mission, 'available')
  assert.deepEqual(finances(funded.ledger), { cash: 50_000_000, committed: 40_800_000, paid: 0, available: 9_200_000 })
  assert.equal(applyCommand(funded, fund), funded)
  assert.throws(() => applyCommand(funded, { ...fund, id: 'fund-2' }), /already/)
  assert.throws(() => applyCommand(funded, { id: fund.id, kind: 'advance-day' }), /identifier/)
  const missed = applyCommand(funded, { ...review, id: 'miss', payload: 'visible' })
  assert.equal(missed.mission, 'funded')
  assert.equal(missed.review?.accepted, false)
  assert.deepEqual(missed.ledger, funded.ledger)
  const accepted = applyCommand(missed, review)
  assert.equal(accepted.mission, 'accepted')
  assert.equal(applyCommand(accepted, review), accepted)
  assert.throws(() => applyCommand(accepted, { ...review, axisM: 7_500_000 }), /identifier/)
  assert.deepEqual(finances(accepted.ledger), { cash: 22_000_000, committed: 0, paid: 34_000_000, available: 22_000_000 })
})

test('research prerequisite, completion, payment and capability remain consistent after reload', () => {
  const startResearch = { id: 'research-1', kind: 'start-research' } as const
  const funded = applyCommand(initial(), fund)
  assert.throws(() => applyCommand(funded, startResearch), /training review/)
  const accepted = applyCommand(funded, review)
  let agency = applyCommand(accepted, startResearch)
  assert.deepEqual(agency.research, { status: 'scheduled', readyDay: 4 })
  assert.deepEqual(unlockedCapabilities(agency), [])
  assert.deepEqual(finances(agency.ledger), { cash: 22_000_000, committed: 8_500_000, paid: 34_000_000, available: 13_500_000 })
  for (let day = 2; day <= 5; day++) {
    agency = applyCommand(agency, { id: `day-${day}`, kind: 'advance-day' })
  }
  const save = { id: 'agency-1', revision: 7, agency }
  assert.deepEqual(decodeSave(encodeSave(save)), save)
  assert.deepEqual(agency.research, { status: 'complete', readyDay: 4 })
  assert.deepEqual(unlockedCapabilities(decodeSave(encodeSave(save)).agency), ['fine-pointing-adcs'])
  assert.deepEqual(finances(agency.ledger), { cash: 13_500_000, committed: 0, paid: 42_500_000, available: 13_500_000 })
  assert.equal(agency.ledger.filter(line => line.account === 'research' && line.kind === 'payment').length, 1)
})

// Independent construction of an export envelope for migration and tamper cases.
function wrap(record: object) {
  const payload = JSON.stringify(record)
  let hash = 2166136261
  for (const character of payload) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
  return JSON.stringify({ payload, checksum: (hash >>> 0).toString(16).padStart(8, '0') })
}

test('save migration is lossless and exports in the current schema', () => {
  const earlier = { schemaVersion: 1, id: 'old-1', revision: 1, catalogRevision: 'earth-training-1', name: 'Vector Research', commands: [fund] }
  const migrated = decodeSave(wrap(earlier))
  assert.deepEqual(migrated.agency, applyCommand(initial(), fund))
  assert.equal(JSON.parse(JSON.parse(encodeSave(migrated)).payload).schemaVersion, 2)
  assert.deepEqual(decodeSave(encodeSave(migrated)), migrated)
})

test('malformed, corrupted, future and semantically invalid save histories are rejected', () => {
  const earlier = { schemaVersion: 1, id: 'old-1', revision: 1, catalogRevision: 'earth-training-1', name: 'Vector Research', commands: [fund] }
  assert.throws(() => decodeSave('{broken'))
  assert.throws(() => decodeSave(wrap(earlier).replace('Vector', 'VectorX')), /checksum/)
  assert.throws(() => decodeSave(wrap({ ...earlier, schemaVersion: 999 })), /schema/)
  assert.throws(() => decodeSave(wrap({ ...earlier, catalogRevision: 'unknown' })), /unavailable/)
  assert.throws(() => decodeSave(wrap({ ...earlier, commands: [fund, fund] })), /Duplicate/)
  assert.throws(() => decodeSave(wrap({ ...earlier, commands: [review] })), /Fund the/)
  assert.throws(() => decodeSave(wrap({ ...earlier, commands: [{ ...review, axisM: '7000000' }] })), /invalid agency command/)
  assert.throws(() => decodeSave(wrap({ ...earlier, revision: -1 })), /revision/)
})

test('training verdicts distinguish payload coverage and derived orbital period and retain sources', () => {
  assert.deepEqual(assessTraining('visible', 7_000_000).missingBands, ['Near infrared'])
  assert.equal(assessTraining('multispectral', 7_500_000).meetsPeriod, false)
  const outcome = assessTraining('multispectral', 7_000_000)
  assert.equal(outcome.accepted, true)
  assert.deepEqual(outcome.sourceIds, ['nasa-science-missions-2025', 'nasa-landsat9-oli-bands', 'jpl-de440-earth-gm'])
  assert.deepEqual(outcome, assessTraining('multispectral', 7_000_000))
})

const circular = {
  frame: inertialFrame, epochTdbSeconds: tdbEpoch(0), semiMajorAxisM: metres(7_000_000), eccentricity: 0,
  inclinationRad: radians(0), ascendingNodeRad: radians(0), periapsisArgumentRad: radians(0), meanAnomalyRad: radians(0),
}

function near(actual: number, expected: number, tolerance: number) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected} by more than ${tolerance}`)
}

test('circular analytic quarter-orbit fixture with inclined axes, velocity and acceleration', () => {
  const elapsed = seconds(1457.129170923892)
  const result = propagate({ ...circular, inclinationRad: radians(Math.PI / 2) }, elapsed)
  near(result.periodS, 5828.516683695568, 1e-8)
  result.positionM.forEach((value, index) => near(value, [0, 0, 7_000_000][index], 1e-5))
  result.velocityMps.forEach((value, index) => near(value, [-7546.05323054, 0, 0][index], 1e-7))
  near(result.accelerationMps2[2], -8.134702765449, 1e-8)
  assert.equal(result.epochTdbSeconds, elapsed)
  assert.equal(result.frame, inertialFrame)
})

test('elliptic propagation matches independent Cartesian integration and conserves arc invariants', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/earth-elliptic.json', import.meta.url), 'utf8'))
  const elements = { ...circular, semiMajorAxisM: metres(fixture.semiMajorAxisM), eccentricity: fixture.eccentricity }
  const result = propagate(elements, seconds(fixture.elapsedS))
  assert.deepEqual(result, propagate(elements, seconds(fixture.elapsedS)))
  result.positionM.forEach((value, index) => near(value, fixture.positionM[index], 0.01))
  result.velocityMps.forEach((value, index) => near(value, fixture.velocityMps[index], 1e-5))
  const start = propagate(elements, seconds(0))
  const energy = (state: typeof start) => Math.hypot(...state.velocityMps) ** 2 / 2 - earthGravity.muM3PerS2 / state.radiusM
  const angularMomentum = (state: typeof start) => state.positionM[0] * state.velocityMps[1] - state.positionM[1] * state.velocityMps[0]
  for (const time of [145, 4321, 86400]) {
    const state = propagate(elements, seconds(time))
    near(energy(state) / energy(start), 1, 1e-13)
    near(angularMomentum(state) / angularMomentum(start), 1, 1e-13)
  }
})

test('orbit boundaries accept the documented edge and reject unsupported inputs', () => {
  assert.doesNotThrow(() => propagate({ ...circular, semiMajorAxisM: metres(6_671_000) }, seconds(86400)))
  assert.throws(() => propagate({ ...circular, frame: 'earth-fixed' as typeof inertialFrame }, seconds(0)), /J2000/)
  assert.throws(() => propagate({ ...circular, semiMajorAxisM: metres(6_670_999) }, seconds(0)), /apsides/)
  assert.throws(() => propagate({ ...circular, eccentricity: 1 }, seconds(0)), /elliptic/)
  assert.throws(() => propagate({ ...circular, eccentricity: Number.NaN }, seconds(0)), /Invalid elements/)
  assert.throws(() => propagate(circular, seconds(-1)), /Elapsed time/)
  assert.throws(() => propagate(circular, seconds(86401)), /Elapsed time/)
  assert.throws(() => tdbEpoch(Infinity), /finite/)
})
