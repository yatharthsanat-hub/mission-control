import assert from 'node:assert/strict'
import { test } from 'node:test'
import 'fake-indexeddb/auto'
import { createAgency } from '../src/v2/agency.ts'
import { encodeSave, decodeSave } from '../src/v2/saveFormat.ts'
import { readLocal, writeLocal } from '../src/v2/localSaves.ts'
import { engineering, historyOf, initialAssembly, recordRevision, resolveAssembly, restoreAssembly, revise, travel } from '../src/v2/assembly/engine.ts'
import type { Assembly } from '../src/v2/assembly/engine.ts'

function near(actual: readonly number[], expected: readonly number[]) {
  assert.equal(actual.length, expected.length)
  for (const [index, value] of actual.entries()) assert.ok(Math.abs(value - expected[index]) < 1e-10, `${value} vs ${expected[index]}`)
}

const instrument = { kind: 'install', id: 'camera', part: 'imager', parent: 'bus', host: 'deck', twist: 90 } as const
const wing = { kind: 'install', id: 'solar', part: 'solar', parent: 'bus', host: 'starboard', twist: 0 } as const

test('headless rigid mounts match independent dimensions, axes, mass and CoM', () => {
  const draft = revise(revise(initialAssembly, instrument, []), wing, [])
  const report = engineering(draft)
  const camera = report.parts.find(part => part.id === 'camera')!
  const solar = report.parts.find(part => part.id === 'solar')!
  // Hand fixture: the +Z mount seats at z=.13; the camera base is .0525 m below its origin.
  // A quarter-turn maps its local +.02 x centroid to +.02 y.
  near(camera.pose.positionM, [0, 0, .1825])
  near(camera.pose.axes[0], [0, 1, 0])
  near(camera.pose.axes[1], [-1, 0, 0])
  near(camera.bounds.min, [-.055, -.07, .13])
  near(camera.bounds.max, [.055, .07, .235])
  // The side mount seats at x=.11 and the wing entirely extends .025 m outward.
  near(solar.bounds.min, [.11, -.1, -.14])
  near(solar.bounds.max, [.135, .1, .14])
  near([report.dryKg, report.wetKg, report.generationW, report.peakLoadW], [3.2, 3.2, 8, 8])
  near(report.comM, [.35 * .1225 / 3.2, .85 * .02 / 3.2, .85 * .1975 / 3.2])
  near(report.dimensionsM, [.245, .22, .375])
  assert.equal(report.costCents, 5_340_000)
  assert.equal(report.fitsEnvelope, true)
  assert.deepEqual(JSON.parse(JSON.stringify(draft)), draft)
  assert.deepEqual(restoreAssembly(JSON.parse(JSON.stringify(draft))), draft)
  assert.ok(Object.isFrozen(draft.parts[0]))
})

test('stowed envelope rejects a tall stack even when mass fits, with affected part', () => {
  const spacer = revise(initialAssembly, { ...instrument, part: 'spacer', id: 'riser', twist: 0 }, [])
  const tall = revise(spacer, { ...instrument, parent: 'riser' }, [])
  const report = engineering(tall)
  near([report.bounds.max[2]], [.34])
  assert.equal(report.fitsEnvelope, false)
  assert.equal(report.fitsMass, true)
  assert.ok(report.warnings.some(warning => warning.part === 'camera'))
})

test('reject incompatible, colliding, occupied, cyclic, malformed and locked assemblies', () => {
  assert.throws(() => revise(initialAssembly, { ...instrument, host: 'battery' }, []), /Incompatible/)
  assert.throws(() => revise(initialAssembly, { ...instrument, twist: 45 } as unknown as typeof instrument, []), /rotation/)
  const draft = revise(initialAssembly, instrument, [])
  assert.throws(() => revise(draft, instrument, []), /Duplicate/)
  assert.throws(() => revise(draft, { ...instrument, id: 'other' }, []), /occupied/)
  assert.throws(() => restoreAssembly({ ...draft, parts: [...draft.parts, { id: 'u', part: 'sphere' }] }), /geometry/)
  assert.throws(() => restoreAssembly({ ...draft, revision: Infinity }), /revision/)
  assert.throws(() => restoreAssembly({
    ...initialAssembly,
    parts: [...initialAssembly.parts, { id: 'a', part: 'spacer' }, { id: 'b', part: 'spacer' }],
    joints: [{ parent: 'a', child: 'b', host: 'deck', twist: 0 }, { parent: 'b', child: 'a', host: 'deck', twist: 0 }],
  }), /Cyclic/)
  const radio = revise(initialAssembly, { ...instrument, part: 'radio', id: 'tx', host: 'radio', twist: 0 }, [])
  assert.throws(() => revise(radio, { ...wing, twist: 90 }, []), /collision.*tx.*solar/)
  const fine = { ...instrument, part: 'fine', id: 'precise', host: 'attitude' } as const
  assert.throws(() => revise(initialAssembly, fine, []), /research/)
  assert.equal(resolveAssembly(revise(initialAssembly, fine, ['fine-pointing-adcs'])).length, 2)
})

test('detach, reattach, removal and undo/redo preserve stable IDs and immutable revisions', () => {
  const bus = historyOf(initialAssembly)
  const mounted = recordRevision(bus, revise(bus.present, instrument, []))
  const detached = recordRevision(mounted, revise(mounted.present, { kind: 'detach', id: 'camera' }, []))
  assert.equal(engineering(detached.present).dryKg, 2)
  assert.equal(resolveAssembly(detached.present).find(part => part.id === 'camera')?.mounted, false)
  const undone = travel(detached, 'undo')
  assert.equal(engineering(undone.present).dryKg, 2.85)
  assert.equal(travel(undone, 'redo').present.revision, 4)
  const joined = revise(detached.present, { kind: 'attach', id: 'camera', parent: 'bus', host: 'deck', twist: 180 }, [])
  assert.equal(joined.parts[1].id, 'camera')
  assert.equal(revise(joined, { kind: 'remove', id: 'camera' }, []).parts.length, 1)
  assert.equal(recordRevision(undone, revise(undone.present, { kind: 'rotate', id: 'camera', twist: 0 }, [])).future.length, 0)
})

test('assembly save round trips and agency save version 2 remains readable', () => {
  const save = { id: 'survey', revision: 0, agency: createAgency('Survey company') }
  assert.deepEqual(decodeSave(encodeSave(save)), save)
  const draft: Assembly = revise(initialAssembly, instrument, [])
  const restored = decodeSave(encodeSave({ ...save, assembly: draft })).assembly
  assert.ok(restored)
  assert.deepEqual(restored, draft)
  assert.deepEqual(engineering(restored), engineering(draft))
  assert.throws(() => decodeSave(encodeSave({ ...save, assembly: revise(initialAssembly, {
    ...instrument, part: 'fine', host: 'attitude',
  }, ['fine-pointing-adcs']) })), /research-locked/)
})

test('IndexedDB retrieves preserved archives, restores explicitly, and handles duplicates and stale writers', async () => {
  const alpha = { id: 'alpha', revision: 0, agency: createAgency('Agency Alpha') }
  const beta = { id: 'beta', revision: 0, agency: createAgency('Agency Beta') }
  const first = await writeLocal(undefined, alpha)
  await assert.rejects(writeLocal(undefined, beta, 'replace'), /Another tab/)
  const second = await writeLocal(first, beta, 'replace')
  const archived = (await readLocal()).archives
  assert.equal(archived.length, 1)
  assert.equal(archived[0].raw, first)
  assert.deepEqual(decodeSave(archived[0].raw).agency, alpha.agency)
  assert.equal(await writeLocal(second, { ...beta, id: 'same-beta' }, 'replace'), second)
  const restored = await writeLocal(second, { ...decodeSave(archived[0].raw), id: 'restored-alpha' }, 'replace')
  assert.equal(decodeSave(restored).agency.name, 'Agency Alpha')
  assert.equal((await readLocal()).archives.length, 2)
  await writeLocal(restored, { ...beta, id: 'restored-beta' }, 'replace')
  assert.equal((await readLocal()).archives.length, 2)
})
