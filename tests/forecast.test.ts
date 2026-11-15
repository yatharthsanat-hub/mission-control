import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createAgency, applyCommand } from '../src/v2/agency.ts'
import { initialAssembly, revise } from '../src/v2/assembly/engine.ts'
import { advanceBattery, fieldOfViewRad, freeSpaceLossDb, inEclipse, inertialToFixed, observationGeometry, sceneVolumeBits, siteUnit, siteView } from '../src/v2/planning/geometry.ts'
import { approvalContext, approveForecastMission, approveMission, defaultPlan, forecastApprovedMission, forecastReview, restoreMission, review } from '../src/v2/planning/mission.ts'
import { decodeSave, encodeSave } from '../src/v2/saveFormat.ts'

const close = (actual: number, expected: number, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be within ${tolerance} of ${expected}`)
const earthRadiusM = 6_371_000
const altitudeM = 400_000
const spacecraftRadiusM = earthRadiusM + altitudeM
const plan = { ...defaultPlan, orbit: { ...defaultPlan.orbit, altitudeKm: 400, inclinationDeg: 40, nodeDeg: 240 } }
const json = (value: unknown) => JSON.parse(JSON.stringify(value))
const design = () => {
  let draft = initialAssembly
  for (const [part, host] of [['solar', 'starboard'], ['imager', 'deck'], ['battery', 'battery'], ['radio', 'radio']] as const) {
    draft = revise(draft, { kind: 'install', id: part, part, parent: 'bus', host, twist: 0 }, [])
  }
  return draft
}

test('sidereal fixed-frame rotation preserves norm and handles longitude wrap and poles', () => {
  const fixed = inertialToFixed([3, 4, -2], 21_541.022635, 86_164.09054, 0)
  close(fixed[0], 4)
  close(fixed[1], -3)
  close(fixed[2], -2)
  close(Math.hypot(...fixed), Math.sqrt(29))
  const wrap = (longitudeDeg: number) => siteUnit({ latitudeDeg: 32, longitudeDeg })
  assert.deepEqual(wrap(179), wrap(-181))
  assert.deepEqual(siteUnit({ latitudeDeg: -90, longitudeDeg: -180 }), [0, 0, -1])
  assert.throws(() => wrap(Infinity), /longitude/)
  assert.throws(() => siteUnit({ latitudeDeg: 91, longitudeDeg: 0 }), /Latitude/)
  assert.throws(() => inertialToFixed([0, 0, 0], 0, 0, 0), /rotation/)
})

test('independent overhead and limb geometry resolve slant range, visibility and station mask', () => {
  const zenith = siteView([spacecraftRadiusM, 0, 0], [1, 0, 0], earthRadiusM)
  close(zenith.rangeM, 400_000)
  close(zenith.elevationRad, Math.PI / 2)
  close(zenith.offNadirRad, 0)
  // Right triangle with a tangential 1,200 km displacement from the station.
  const towardHorizon = siteView([earthRadiusM + 100_000, 1_200_000, 0], [1, 0, 0], earthRadiusM)
  close(towardHorizon.rangeM, 1_204_159.4578792297, .001)
  assert.ok(towardHorizon.elevationRad > 0 && towardHorizon.elevationRad < Math.PI / 18)
  const tangent = siteView([earthRadiusM, 2_000_000, 0], [1, 0, 0], earthRadiusM)
  close(tangent.elevationRad, 0)
  assert.ok(siteView([-spacecraftRadiusM, 0, 0], [1, 0, 0], earthRadiusM).elevationRad < 0)
  close(siteView([0, 0, spacecraftRadiusM], [0, 0, 1], earthRadiusM).elevationRad, Math.PI / 2)
  assert.throws(() => siteView([earthRadiusM, 0, 0], [1, 0, 0], earthRadiusM), /exterior/)
})

test('pinhole field, nadir GSD, projected footprint and limb restriction have independent references', () => {
  const fov = fieldOfViewRad({ widthPixels: 1024, heightPixels: 1024, pixelIfovRad: 45e-6 })
  close(fov * 180 / Math.PI, 2.639721531, 1e-6)
  const nadir = observationGeometry({ rangeM: 400_000, offNadirRad: 0, elevationRad: Math.PI / 2 }, fov, 45e-6, 1)
  assert.ok(nadir)
  close(nadir.gsdM, 18.00000001215, 1e-7)
  close(nadir.acrossM, 18_432.00001244, .001)
  close(nadir.alongM, nadir.acrossM)
  const oblique = observationGeometry({ rangeM: 475_000, offNadirRad: .3, elevationRad: Math.PI / 6 }, fov, 45e-6, 1)
  assert.ok(oblique)
  close(oblique.gsdM, 42.75, .000001)
  close(oblique.alongM, 2 * oblique.acrossM)
  assert.equal(observationGeometry({ rangeM: 2_000_000, offNadirRad: .99, elevationRad: .5 }, fov, 45e-6, 1), null)
  assert.throws(() => fieldOfViewRad({ widthPixels: 0, heightPixels: 100, pixelIfovRad: .001 }), /optics/)
})

test('cylindrical eclipse correctly distinguishes nightside, tangent and day side', () => {
  assert.equal(inEclipse([-spacecraftRadiusM, 0, 0], [1, 0, 0], earthRadiusM), true)
  assert.equal(inEclipse([spacecraftRadiusM, 0, 0], [1, 0, 0], earthRadiusM), false)
  assert.equal(inEclipse([-1_000_000, earthRadiusM - 1, 0], [1, 0, 0], earthRadiusM), true)
  assert.equal(inEclipse([-1_000_000, earthRadiusM, 0], [1, 0, 0], earthRadiusM), false)
  assert.throws(() => inEclipse([spacecraftRadiusM, 0, 0], [2, 0, 0], earthRadiusM), /geometry/)
})

test('battery reconciles constant-step load, saturation, efficiencies and unmet energy', () => {
  assert.deepEqual(advanceBattery(8, 10, 8, 2, 1, .5, .8), { endJ: 10, curtailedJ: 2, unservedJ: 0 })
  assert.deepEqual(advanceBattery(8, 10, 0, 5, 2, .5, .75), { endJ: 0, curtailedJ: 0, unservedJ: 4 })
  assert.deepEqual(advanceBattery(10, 10, 2, 2, 5), { endJ: 10, curtailedJ: 0, unservedJ: 0 })
  assert.deepEqual(advanceBattery(200, 400, 0, 2, 50), { endJ: 100, curtailedJ: 0, unservedJ: 0 })
  assert.throws(() => advanceBattery(11, 10, 1, 1, 1), /battery/)
})

test('RF path loss and scene encoding agree with independent units and analytic values', () => {
  // 2.2 GHz = 2200 MHz, 1,000 km. The rounded textbook km/MHz constant is 32.45 dB.
  close(freeSpaceLossDb(1_000_000, 2.2e9), 32.45 + 60 + 20 * Math.log10(2200), .01)
  close(freeSpaceLossDb(2_000_000, 2.2e9) - freeSpaceLossDb(1_000_000, 2.2e9), 6.02059991328)
  assert.equal(sceneVolumeBits(1024, 1024, 12, 2), 25_165_824)
  assert.throws(() => sceneVolumeBits(1, 1.2, 12, 2), /encoding/)
  assert.throws(() => freeSpaceLossDb(0, 2.2e9), /positive/)
})

test('integrated forecast distinguishes similar contact opportunities from feasible scene delivery', () => {
  const craft = design()
  const feasible = forecastReview(review(plan, craft, 50_000_000, []))
  const blocked = forecastReview(review(defaultPlan, craft, 50_000_000, []))
  assert.deepEqual(feasible, forecastReview(review(plan, craft, 50_000_000, [])))
  assert.equal(feasible.findings.some(finding => finding.status === 'FAIL'), false)
  assert.equal(blocked.findings.find(finding => finding.id === 'Forecast target access')?.status, 'FAIL')
  const forecast = feasible.forecast!
  assert.ok(blocked.forecast!.contacts.length > 0)
  const flood = forecastReview(review({ ...plan, objective: 'floods', target: 'delta' }, craft, 50_000_000, []))
  assert.equal(flood.findings.find(finding => finding.id === 'Payload spectrum')?.status, 'FAIL')
  assert.equal(flood.forecast!.instrument.spectralSuitability, false)
  assert.equal(flood.forecast!.science.captured, 0)
  assert.equal(forecast.accesses.length, 2)
  assert.equal(forecast.communications.delivered, 2)
  assert.equal(forecast.communications.deliveredBits, 50_331_648)
  assert.equal(forecast.science.onboardBits, 0)
  assert.equal(forecast.communications.linkBudget, 'NOT ASSESSED')
  assert.equal(forecast.communications.contactCapacityBits,
    forecast.contacts.reduce((seconds, window) => seconds + window.endS - window.startS, 0) * 256_000)
  assert.equal([...forecast.sunlight, ...forecast.eclipses].reduce((seconds, window) => seconds + window.endS - window.startS, 0), 86_400)
  assert.ok(forecast.power.minChargeJ >= 0)
  assert.equal(forecast.power.unmetJ, 0)
  const noBattery = revise(craft, { kind: 'remove', id: 'battery' }, [])
  const starved = forecastReview(review(plan, noBattery, 50_000_000, []))
  assert.ok(starved.forecast!.power.unmetJ > 0)
  assert.equal(starved.findings.find(finding => finding.id === 'Forecast power continuity')?.status, 'FAIL')
})

test('versioned mission forecast preserves Phase 2 saves and validates mixed approval history', () => {
  const craft = design()
  const agency = createAgency('Vector Survey')
  const old = approveMission('old', defaultPlan, craft, approvalContext('archive', agency))
  const reserved = applyCommand(agency, { id: old.id, kind: 'reserve-mission', cents: old.budget.totalCents })
  const context = approvalContext('archive', reserved)
  assert.throws(() => approveForecastMission('new', plan, craft, context, false), /Acknowledge/)
  assert.throws(() => approveForecastMission('bad', defaultPlan, craft, context, true), /forecast checks/)
  const current = approveForecastMission('new', { ...plan, revisedFrom: old.id }, craft, context, true)
  assert.equal(current.schemaVersion, 2)
  assert.equal(current.environment.durationS, 86_400)
  const decoded = decodeSave(encodeSave({ id: 'archive', revision: 2, assembly: craft, missions: [old, current],
    agency: applyCommand(reserved, { id: current.id, kind: 'reserve-mission', cents: current.budget.totalCents }),
  }))
  assert.deepEqual(decoded.missions, [old, current])
  const loaded = decoded.missions![1]
  assert.ok(loaded.schemaVersion === 2)
  assert.equal(forecastApprovedMission(loaded).communications.delivered, 2)
  assert.throws(() => restoreMission({ ...current, rfAcknowledged: false }), /acknowledgement/)
  const changed = json(current)
  changed.analysisProfile.minFootprintAcrossM = 0
  assert.throws(() => restoreMission(changed), /does not match/)
  assert.ok(Object.isFrozen(decoded.missions![1]))
})
