import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { SphereGeometry } from 'three'
import { missionEntry } from '../src/v2/missionEntry.ts'
import { createDemo, demoCheckpointKey, readDemoCheckpoint } from '../src/v2/operations/demo.ts'
import { createMissionRun } from '../src/v2/operations/run.ts'
import { decodeSave, encodeSave } from '../src/v2/saveFormat.ts'
import { approvalContext, approveForecastMission, approveMission, forecastApprovedMission, forecastReview, restoreMission, review, targets, wildfirePlan } from '../src/v2/planning/mission.ts'
import { analyzeForecast } from '../src/v2/planning/forecast.ts'
import { inertialToFixed, siteUnit } from '../src/v2/planning/geometry.ts'
import { environment, geographicSubpoint } from '../src/v2/planning/orbit.ts'
import { chartPoint, fixedCoordinates, fixedToScene, regionalBasemaps } from '../src/v2/operations/geography.ts'
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

function close(actual: number, expected: number, tolerance = 1e-8) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} should be near ${expected}`)
}

test('known US coordinates align with north-up raster crop edges and the fixed frame', () => {
  const { west, gulf } = regionalBasemaps
  assert.deepEqual(chartPoint({ longitudeDeg: -140, latitudeDeg: 52 }, west), [0, 0])
  assert.deepEqual(chartPoint({ longitudeDeg: -100, latitudeDeg: 28 }, west), [360, 216])
  const sites = [
    [targets.valley, west, 166.59, 120.78],
    [targets.paradise, west, 165.4027407, 110.1635451],
    [targets.delta, gulf, 186.3, 106.2],
    [environment.groundStation, west, 306, 153],
  ] as const
  for (const [site, bounds, x, y] of sites) {
    const fixed = siteUnit(site)
    assert.ok(fixed[1] < 0)
    const geographic = fixedCoordinates(fixed)
    close(geographic.latitudeDeg, site.latitudeDeg)
    close(geographic.longitudeDeg, site.longitudeDeg)
    const marker = chartPoint(geographic, bounds)
    close(marker[0], x)
    close(marker[1], y)
  }
  const t = environment.siderealDayS / 4
  const inertial = [1, 0, 0] as const
  const fixed = fixedCoordinates(inertialToFixed(inertial, t, environment.siderealDayS, 0))
  close(fixed.longitudeDeg, -90)
  close(fixed.longitudeDeg, geographicSubpoint(inertial, t).longitudeDeg)
  close(fixed.latitudeDeg, 0)
})

test('Three sphere UVs agree with the basemap meridians and fixed-coordinate markers', () => {
  const geometry = new SphereGeometry(1, 8, 4)
  try {
    const { uv, position } = geometry.attributes
    for (const [longitudeDeg, latitudeDeg, u, v] of [
      [0, 0, .5, .5], [-90, 0, .25, .5], [90, 0, .75, .5], [-135, 45, .125, .75],
    ]) {
      const vertex = Array.from({ length: uv.count }, (_, i) => i)
        .find(i => uv.getX(i) === u && uv.getY(i) === v)
      assert.ok(vertex !== undefined)
      const expected = fixedToScene(siteUnit({ longitudeDeg, latitudeDeg }))
      const actual = [position.getX(vertex), position.getY(vertex), position.getZ(vertex)]
      actual.forEach((component, axis) => close(component, expected[axis], 1e-7))
    }
  } finally { geometry.dispose() }
})

test('wildfire requires a visible-red delivery before the deadline and replays under the saved profile', () => {
  const { mission: crop, save } = createDemo()
  const context = approvalContext(save.id, save.agency)
  const mission = approveForecastMission('wildfire-test', wildfirePlan, save.assembly, context, true)
  assert.equal(crop.analysisProfile.durationS, 86_400)
  assert.equal(mission.analysisProfile.durationS, 21_600)
  assert.deepEqual(mission.objective.bands.map(band => band.label), ['Red'])
  assert.equal(mission.spacecraft.payload.bandCount, 2)
  const forecast = forecastApprovedMission(mission)
  assert.equal(forecast.accesses.length, 1)
  assert.equal(forecast.communications.delivered, 1)
  const laterContact = analyzeForecast(mission).contacts.find(window => window.startS > forecast.durationS)
  assert.ok(laterContact)
  const run = createMissionRun(mission)
  run.command('arm-imaging')
  run.command('arm-downlink')
  run.advance(forecast.durationS / forecast.stepS)
  assert.equal(run.snapshot().verdict, 'Success')
  const missed = createMissionRun(mission)
  missed.command('arm-imaging')
  missed.advance(laterContact.startS / forecast.stepS)
  assert.equal(missed.snapshot().elapsedS, 21_600)
  assert.equal(missed.snapshot().resources.captured, 1)
  assert.equal(missed.snapshot().verdict, 'Failure')
  assert.throws(() => missed.command('arm-downlink'), /unavailable/)
  const restored = restoreMission(JSON.parse(JSON.stringify(mission)))
  assert.deepEqual(createMissionRun(restored, run.record()).snapshot(), run.snapshot())
  assert.throws(() => restoreMission({ ...mission, analysisProfile: crop.analysisProfile }), /does not match/)
  assert.throws(() => approveMission('legacy-test', wildfirePlan, save.assembly, context), /deadline-aware/)
  const poorOrbit = { ...wildfirePlan, orbit: { ...wildfirePlan.orbit, nodeDeg: 244 } }
  assert.ok(forecastReview(review(poorOrbit, save.assembly, context.availableCents, context.capabilities))
    .findings.some(item => item.id === 'Forecast target access' && item.status === 'FAIL'))
})

test('release theme uses the approved palette and ships all three licensed fonts locally', () => {
  const css = readFileSync(new URL('../src/design.css', import.meta.url), 'utf8')
  const palette = Object.fromEntries([...css.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)]
    .map(([, key, value]) => [key, value.toUpperCase()]))
  const required = {
    bg: '#080C14', surface: '#111827', line: '#1F2937', ink: '#F8FAFC', muted: '#94A3B8',
    accent: '#38BDF8', telemetry: '#00E5FF', execute: '#F97316',
  }
  for (const [name, color] of Object.entries(required)) assert.equal(palette[name], color)
  assert.notEqual(palette['execute-hover'], palette.execute)
  const files = [...css.matchAll(/src:\s*url\("\/fonts\/([\w-]+)\.woff2"\)/g)].map(([, name]) => name)
  assert.deepEqual(files.sort(), ['inter', 'jetbrains-mono', 'space-grotesk'])
  for (const name of files) {
    const font = readFileSync(new URL(`../public/fonts/${name}.woff2`, import.meta.url))
    const license = readFileSync(new URL(`../public/fonts/${name}-OFL.txt`, import.meta.url), 'utf8')
    assert.equal(font.subarray(0, 4).toString('ascii'), 'wOF2')
    assert.match(license, /SIL OPEN FONT LICENSE Version 1\.1/i)
  }
})
