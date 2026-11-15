import assert from 'node:assert/strict'
import { test } from 'node:test'
import 'fake-indexeddb/auto'
import { applyCommand, createAgency, finances } from '../src/v2/agency.ts'
import { engineering, initialAssembly, revise } from '../src/v2/assembly/engine.ts'
import type { Edit } from '../src/v2/assembly/engine.ts'
import { decodeSave, encodeSave } from '../src/v2/saveFormat.ts'
import type { Save } from '../src/v2/saveFormat.ts'
import { readLocal, writeLocal } from '../src/v2/localSaves.ts'
import { approvalContext, approveMission, defaultPlan, restoreMission, review } from '../src/v2/planning/mission.ts'
import { geographicSubpoint, groundTrack, orbitalSummary } from '../src/v2/planning/orbit.ts'

const install = (part: Extract<Edit, { kind: 'install' }>['part'], host: string, parent = 'bus') =>
  ({ kind: 'install', id: part + '-' + host, part, parent, host, twist: 0 } as const)
const vehicle = (riser = false) => {
  const bus = riser ? revise(initialAssembly, install('spacer', 'deck'), []) : initialAssembly
  return [install('imager', 'deck', riser ? 'spacer-deck' : 'bus'), install('solar', 'starboard'),
    install('battery', 'battery'), install('radio', 'radio')].reduce((draft, edit) => revise(draft, edit, []), bus)
}
const agency = () => createAgency('Vector Survey')
const status = (result: ReturnType<typeof review>, id: string) => result.findings.find(finding => finding.id === id)?.status
const json = (value: unknown) => JSON.parse(JSON.stringify(value))

test('initial-state orbit quantities and sidereal ground rotation match independent hand cases', () => {
  const orbit = orbitalSummary({ ...defaultPlan.orbit, altitudeKm: 629, eccentricity: .02, inclinationDeg: 0 })
  assert.equal(orbit.perigeeM, 489_000)
  assert.equal(orbit.apogeeM, 769_000)
  assert.ok(Math.abs(orbit.initialState.periodS - 5828.516684) < .001)
  assert.ok(Math.abs(orbit.initialState.positionM[0] - 6_860_000) < 1e-6)
  // A fixed equatorial inertial +X vector moves 90 degrees west at one quarter of a sidereal day.
  assert.deepEqual(geographicSubpoint([7_000_000, 0, 0], 21_541.022635), { latitudeDeg: 0, longitudeDeg: -90 })
  const track = groundTrack(orbit.elements)
  assert.equal(track.length, 361)
  assert.deepEqual(track, groundTrack(orbit.elements))
  assert.equal(track.at(-1)?.elapsedS, 21_600)
  assert.ok(track.every(point => Math.abs(point.latitudeDeg) < 1e-10 && point.longitudeDeg >= -180 && point.longitudeDeg < 180))
})

test('reject invalid orbit inputs and unsupported service inclinations independently', () => {
  const assembly = vehicle()
  for (const orbit of [{ altitudeKm: 299 }, { eccentricity: .2 }, { inclinationDeg: -1 }, { nodeDeg: 360 }, { altitudeKm: NaN }]) {
    const result = review({ ...defaultPlan, orbit: { ...defaultPlan.orbit, ...orbit } }, assembly, 50_000_000, [])
    assert.equal(status(result, 'Orbit scope'), 'FAIL')
    assert.equal(result.orbit, null)
  }
  const plan = { ...defaultPlan, orbit: { ...defaultPlan.orbit, inclinationDeg: 110 } }
  assert.equal(status(review(plan, assembly, 50_000_000, []), 'Orbit scope'), 'PASS')
  assert.equal(status(review(plan, assembly, 50_000_000, []), 'Service inclination'), 'FAIL')
  assert.equal(status(review({ ...plan, launch: 'extended' }, assembly, 50_000_000, []), 'Service inclination'), 'PASS')
})

test('spectral, essential spacecraft, pointing eligibility, and target/funding gates are actionable', () => {
  const assembly = vehicle()
  const result = review(defaultPlan, assembly, 50_000_000, [])
  assert.equal(result.findings.some(finding => finding.status === 'FAIL'), false)
  assert.equal(status(result, 'Payload spectrum'), 'PASS')
  assert.equal(status(result, 'Observation access'), 'WARNING')
  const flood = review({ ...defaultPlan, objective: 'floods', target: 'delta' }, assembly, 50_000_000, [])
  assert.match(flood.findings.find(finding => finding.id === 'Payload spectrum')?.explanation ?? '', /Blue, Green/)
  assert.equal(status(flood, 'Payload spectrum'), 'FAIL')
  assert.equal(status(review({ ...defaultPlan, target: 'delta' }, assembly, 50_000_000, []), 'Target definition'), 'FAIL')
  assert.equal(status(review(defaultPlan, assembly, result.budget.totalCents - 1, []), 'Funding'), 'FAIL')
  assert.equal(status(review(defaultPlan, assembly, result.budget.totalCents, []), 'Funding'), 'PASS')
  for (const gate of ['Payload spectrum', 'Sunlit housekeeping', 'Battery installed', 'Radio installed']) {
    assert.equal(status(review(defaultPlan, initialAssembly, 50_000_000, []), gate), 'FAIL')
  }
  const fine = revise(assembly, install('fine', 'attitude'), ['fine-pointing-adcs'])
  assert.equal(status(review(defaultPlan, fine, 50_000_000, []), 'Research eligibility'), 'FAIL')
  assert.equal(status(review(defaultPlan, fine, 50_000_000, ['fine-pointing-adcs']), 'Research eligibility'), 'PASS')
  assert.equal(status(review({ ...defaultPlan, orbit: { ...defaultPlan.orbit, altitudeKm: 1200 } }, assembly, 50_000_000, []), 'Best-case sample spacing'), 'FAIL')
})

test('selected launch service independently gates mass and stowed fit', () => {
  const tall = vehicle(true)
  const report = review(defaultPlan, tall, 50_000_000, [])
  assert.equal(status(report, 'Stowed fit'), 'FAIL')
  assert.equal(status(report, 'Launch mass'), 'FAIL')
  const extended = review({ ...defaultPlan, launch: 'extended' }, tall, 50_000_000, [])
  assert.equal(status(extended, 'Stowed fit'), 'PASS')
  assert.equal(status(extended, 'Launch mass'), 'PASS')
  const underMass = revise(revise(initialAssembly, install('spacer', 'deck'), []), install('imager', 'deck', 'spacer-deck'), [])
  const lightTall = review(defaultPlan, underMass, 50_000_000, [])
  assert.equal(status(lightTall, 'Launch mass'), 'PASS')
  assert.equal(status(lightTall, 'Stowed fit'), 'FAIL')
})

test('approval is reproducible, deeply frozen, and retains authoritative Phase 1 geometry', () => {
  const snapshot = vehicle()
  const context = approvalContext('agency', agency())
  const plan = { ...defaultPlan, orbit: { ...defaultPlan.orbit } }
  const mission = approveMission('mission-a', plan, snapshot, context)
  assert.deepEqual(mission, approveMission('mission-a', plan, snapshot, context))
  assert.deepEqual(restoreMission(json(mission)), mission)
  assert.deepEqual(mission.spacecraft.comM, engineering(snapshot).comM)
  assert.ok(Math.abs(mission.spacecraft.wetKg - 4.17) < 1e-12)
  assert.equal(mission.spacecraft.payload?.sceneBits, 1024 * 1024 * 12 * 2)
  assert.equal(mission.orbit.initialState.frame, 'earth-centered-j2000')
  assert.equal(mission.units.timeScale, 'TDB')
  assert.ok(Object.isFrozen(mission.assembly.parts[0]))
  assert.ok(Object.isFrozen(mission.orbit.initialState.positionM))
  assert.ok(Object.isFrozen(mission.findings[0]))
  plan.orbit.inclinationDeg = 42
  context.capabilities.push('fine-pointing-adcs')
  const edited = revise(snapshot, { kind: 'remove', id: 'imager-deck' }, [])
  assert.equal(edited.parts.length + 1, mission.assembly.parts.length)
  assert.equal(mission.approval.capabilities.length, 0)
  assert.equal(mission.plan.orbit.inclinationDeg, 55)
})

test('runtime validation rejects unsupported and tampered mission contracts', () => {
  const mission = approveMission('mission-a', defaultPlan, vehicle(), approvalContext('agency', agency()))
  assert.throws(() => restoreMission({ ...mission, schemaVersion: 2 }), /schema/)
  assert.throws(() => restoreMission({ ...mission, catalogRevision: 'other' }), /does not match/)
  assert.throws(() => restoreMission({ ...mission, orbit: { ...mission.orbit, initialState: { ...mission.orbit.initialState, frame: 'fixed' } } }), /does not match/)
  assert.throws(() => restoreMission({ ...mission, spacecraft: { ...mission.spacecraft, wetKg: 1 } }), /does not match/)
  assert.throws(() => restoreMission({ ...mission, plan: { ...mission.plan, orbit: { ...mission.plan.orbit, altitudeKm: '600' } } }), /Invalid orbit/)
  assert.throws(() => restoreMission({ ...mission, environment: { ...mission.environment, durationS: 0 } }), /does not match/)
  const portable = json(mission)
  portable.orbit.initialState.velocityMps[1] += 1e-12
  assert.equal(restoreMission(portable).orbit.initialState.velocityMps[1], portable.orbit.initialState.velocityMps[1])
  portable.orbit.initialState.velocityMps[1] += .01
  assert.throws(() => restoreMission(portable), /does not match/)
  assert.throws(() => approveMission('mission-a', defaultPlan, initialAssembly, approvalContext('agency', agency())), /failed readiness/)
})

test('IndexedDB reload preserves snapshots, commitments and revisions and rejects stale approval', async () => {
  const snapshot = vehicle()
  const base: Save = { id: 'agency', revision: 0, agency: agency(), assembly: snapshot }
  const stored = await writeLocal(undefined, base)
  const mission = approveMission('mission-a', defaultPlan, snapshot, approvalContext(base.id, base.agency))
  const command = { id: mission.id, kind: 'reserve-mission', cents: mission.budget.totalCents } as const
  const funded = applyCommand(base.agency, command)
  assert.equal(applyCommand(funded, command), funded)
  assert.throws(() => applyCommand(funded, { ...command, cents: command.cents + 1 }), /identifier/)
  const revised = approveMission('mission-b', { ...defaultPlan, revisedFrom: mission.id }, snapshot, approvalContext(base.id, funded))
  const approved = { ...base, revision: 1, agency: applyCommand(funded, { ...command, id: revised.id }), missions: [mission, revised] }
  await writeLocal(stored, approved)
  await assert.rejects(writeLocal(stored, approved), /Another tab/)
  const raw = (await readLocal()).raw!
  const loaded = decodeSave(raw)
  assert.deepEqual(loaded.missions, [mission, revised])
  assert.equal(finances(loaded.agency.ledger).committed, mission.budget.totalCents * 2)
  assert.equal(finances(loaded.agency.ledger).paid, 0)
  const edited = revise(snapshot, { kind: 'remove', id: 'imager-deck' }, [])
  const updated = { ...loaded, assembly: edited, revision: 2 }
  await writeLocal(raw, updated)
  assert.deepEqual(decodeSave((await readLocal()).raw!).missions, [mission, revised])
  assert.throws(() => decodeSave(encodeSave({ ...approved, missions: [mission] })), /commitment/)
  assert.throws(() => decodeSave(encodeSave({ ...approved, agency: funded })), /matching commitment/)
  assert.throws(() => decodeSave(encodeSave({ ...approved, missions: [mission, mission] })), /Duplicate/)
})
