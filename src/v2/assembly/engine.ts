import { catalog, catalogRevision, launchEnvelope, partDefinition } from './catalog.ts'
import type { PartId, Node } from './catalog.ts'
import { add, mate, origin, transform, twists } from './geometry.ts'
import type { Pose, Twist, Vec3 } from './geometry.ts'

export interface Instance { readonly id: string; readonly part: PartId }
export interface Joint { readonly parent: string; readonly host: string; readonly child: string; readonly twist: Twist }
export interface Assembly {
  readonly catalog: typeof catalogRevision
  readonly revision: number
  readonly parts: readonly Instance[]
  readonly joints: readonly Joint[]
}
export interface Bounds { readonly min: Vec3; readonly max: Vec3 }
export interface ResolvedPart extends Instance { readonly pose: Pose; readonly bounds: Bounds; readonly mounted: boolean }
export type Edit =
  | { kind: 'install'; id: string; part: Exclude<PartId, 'bus'>; parent: string; host: string; twist: Twist }
  | { kind: 'attach'; id: string; parent: string; host: string; twist: Twist }
  | { kind: 'rotate'; id: string; twist: Twist }
  | { kind: 'detach' | 'remove'; id: string }

export const initialAssembly: Assembly = freezeAssembly({
  catalog: catalogRevision, revision: 0, parts: [{ id: 'bus', part: 'bus' }], joints: [],
})
const toleranceM = 1e-9
const axes = [0, 1, 2] as const

function freezeAssembly(value: Assembly): Assembly {
  return Object.freeze({ ...value,
    parts: Object.freeze(value.parts.map(item => Object.freeze({ ...item }))),
    joints: Object.freeze(value.joints.map(item => Object.freeze({ ...item }))),
  })
}

export function guestNode(part: PartId) {
  return partDefinition(part).nodes.find(node => node.role === 'guest')
}

export function compatible(host: Node, guest: Node | undefined, twist: Twist): boolean {
  return host.role === 'host' && !!guest && guest.role === 'guest' &&
    host.interfaceId === guest.interfaceId && host.allowedTwists.includes(twist) && guest.allowedTwists.includes(twist)
}

export function freeMounts(assembly: Assembly, resolved: readonly ResolvedPart[], part: PartId, twist: Twist) {
  return resolved.flatMap(owner => partDefinition(owner.part).nodes.flatMap(node => {
    if (!owner.mounted || !compatible(node, guestNode(part), twist) ||
      assembly.joints.some(joint => joint.parent === owner.id && joint.host === node.id)) return []
    return [{ key: `${owner.id}/${node.id}`, parent: owner.id, host: node.id,
      label: `${partDefinition(owner.part).name} · ${node.label}`,
      position: add(owner.pose.positionM, transform(owner.pose.axes, node.pose.positionM)) }]
  }))
}

function boundsOf(pose: Pose, size: Vec3): Bounds {
  // All approved mount rotations are signed axis permutations. OBBs are AABBs in root coordinates.
  const half: Vec3 = [size[0] / 2, size[1] / 2, size[2] / 2]
  function extent(i: 0 | 1 | 2) {
    return Math.abs(pose.axes[0][i]) * half[0] + Math.abs(pose.axes[1][i]) * half[1] + Math.abs(pose.axes[2][i]) * half[2]
  }
  const margin: Vec3 = [extent(0), extent(1), extent(2)]
  return { min: add(pose.positionM, [-margin[0], -margin[1], -margin[2]]), max: add(pose.positionM, margin) }
}

function partMap(assembly: Assembly) {
  return new Map(assembly.parts.map(part => [part.id, part]))
}

export function resolveAssembly(assembly: Assembly): readonly ResolvedPart[] {
  const parts = partMap(assembly)
  if (parts.size !== assembly.parts.length) throw new Error('Duplicate part identifier.')
  if (parts.get('bus')?.part !== 'bus' || assembly.parts.some(part => part.part === 'bus' && part.id !== 'bus')) {
    throw new Error('Exactly one root survey bus is required.')
  }
  const occupied = new Set<string>()
  const parents = new Map<string, Joint>()
  for (const joint of assembly.joints) {
    const parent = parts.get(joint.parent)
    const child = parts.get(joint.child)
    if (!parent || !child || child.id === 'bus') throw new Error('Joint references an invalid part.')
    if (parents.has(child.id)) throw new Error('A part can have only one parent.')
    const host = partDefinition(parent.part).nodes.find(node => node.id === joint.host)
    const guest = guestNode(child.part)
    if (!host || !compatible(host, guest, joint.twist)) throw new Error(`Incompatible interface or rotation at ${joint.parent}/${joint.host}.`)
    const key = `${parent.id}/${host.id}`
    if (occupied.has(key)) throw new Error(`Attachment node ${key} is occupied.`)
    occupied.add(key)
    parents.set(child.id, joint)
  }
  const reached = new Map<string, { result: ResolvedPart; group: string }>()
  function resolve(part: Instance, chain: Set<string>): { result: ResolvedPart; group: string } {
    const prior = reached.get(part.id)
    if (prior) return prior
    if (chain.has(part.id)) throw new Error('Cyclic assembly attachment.')
    chain.add(part.id)
    const joint = parents.get(part.id)
    let pose = origin
    let group = part.id
    if (joint) {
      const parent = parts.get(joint.parent)!
      const top = resolve(parent, chain)
      group = top.group
      const host = partDefinition(parent.part).nodes.find(node => node.id === joint.host)!
      pose = mate(top.result.pose, host.pose, guestNode(part.part)!.pose, joint.twist)
    }
    const spec = partDefinition(part.part)
    if (!spec || spec.sizeM.some(size => !Number.isFinite(size) || size <= 0) ||
        !Number.isFinite(spec.massKg) || spec.massKg <= 0 || !spec.comM.every(Number.isFinite) ||
        ![spec.generationW, spec.capacityJ, spec.loadW].every(value => Number.isFinite(value) && value >= 0) ||
        !Number.isSafeInteger(spec.costCents) || spec.costCents < 0) {
      throw new Error(`Invalid engineering data for ${part.id}.`)
    }
    const resolved = { result: { ...part, pose, bounds: boundsOf(pose, spec.sizeM), mounted: group === 'bus' }, group }
    reached.set(part.id, resolved)
    chain.delete(part.id)
    return resolved
  }
  const resolved = assembly.parts.map(part => resolve(part, new Set()))
  resolved.forEach(({ result: a, group }, index) => {
    for (const { result: b, group: otherGroup } of resolved.slice(index + 1)) {
      if (group === otherGroup && axes.every(i =>
        Math.min(a.bounds.max[i], b.bounds.max[i]) - Math.max(a.bounds.min[i], b.bounds.min[i]) > toleranceM)) {
        throw new Error(`Stowed geometry collision between ${partDefinition(a.part).name} (${a.id.slice(0, 8)}) and ${partDefinition(b.part).name} (${b.id.slice(0, 8)}).`)
      }
    }
  })
  return resolved.map(item => item.result)
}

export function engineering(assembly: Assembly) {
  const parts = resolveAssembly(assembly).filter(part => part.mounted)
  let dryKg = 0, costCents = 0, generationW = 0, capacityJ = 0, peakLoadW = 0
  let moment: Vec3 = [0, 0, 0]
  let min = parts[0].bounds.min
  let max = parts[0].bounds.max
  const warnings: { part?: string; message: string }[] = []
  for (const part of parts) {
    const spec = partDefinition(part.part)
    const com = add(part.pose.positionM, transform(part.pose.axes, spec.comM))
    dryKg += spec.massKg
    moment = add(moment, [spec.massKg * com[0], spec.massKg * com[1], spec.massKg * com[2]])
    min = axes.map(i => Math.min(min[i], part.bounds.min[i])) as unknown as Vec3
    max = axes.map(i => Math.max(max[i], part.bounds.max[i])) as unknown as Vec3
    costCents += spec.costCents
    generationW += spec.generationW
    capacityJ += spec.capacityJ
    peakLoadW += spec.loadW
    if (axes.some(i => part.bounds.min[i] < launchEnvelope.minM[i] - toleranceM || part.bounds.max[i] > launchEnvelope.maxM[i] + toleranceM)) {
      warnings.push({ part: part.id, message: `${spec.name} extends beyond the stowed envelope.` })
    }
  }
  const comM: Vec3 = [moment[0] / dryKg, moment[1] / dryKg, moment[2] / dryKg]
  const wetKg = dryKg // no supported tanks or propellant in this catalog
  const fitsEnvelope = warnings.length === 0
  const fitsMass = wetKg <= launchEnvelope.maxWetKg + 1e-9
  const fitsCom = axes.every(i => Math.abs(comM[i]) <= launchEnvelope.maxComOffsetM[i] + toleranceM)
  if (!fitsMass) warnings.push({ message: 'Wet mass exceeds the rideshare limit.' })
  if (!fitsCom) warnings.push({ message: 'Center of mass exceeds the rideshare offset limit from bus origin.' })
  if (generationW < peakLoadW) warnings.push({ message: 'Nominal sun-pointed generation is below simultaneous peak load.' })
  if (capacityJ === 0) warnings.push({ message: 'No battery is mounted.' })
  for (const [id, label] of [['imager', 'imager'], ['radio', 'telemetry radio']] as const) {
    if (!parts.some(part => part.part === id)) warnings.push({ message: `No ${label} is mounted.` })
  }
  return { parts, dryKg, wetKg, comM, costCents, generationW, capacityJ, peakLoadW,
    bounds: { min, max }, dimensionsM: add(max, [-min[0], -min[1], -min[2]]),
    fitsEnvelope, fitsMass, fitsCom, warnings }
}

function validId(id: unknown): id is string {
  return typeof id === 'string' && /^[a-zA-Z0-9-]{1,64}$/.test(id)
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid assembly record.')
  return value as Record<string, unknown>
}

function validTwist(value: unknown): value is Twist {
  return twists.some(twist => twist === value)
}

function validPart(value: unknown): value is PartId {
  return typeof value === 'string' && Object.hasOwn(catalog, value)
}

export function restoreAssembly(input: unknown): Assembly {
  const data = record(input)
  if (data.catalog !== catalogRevision) throw new Error('Unsupported assembly catalog.')
  const revision = data.revision
  if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0 || revision >= Number.MAX_SAFE_INTEGER) {
    throw new Error('Invalid assembly revision.')
  }
  if (!Array.isArray(data.parts) || !Array.isArray(data.joints) || data.parts.length > 64 || data.joints.length > 63) {
    throw new Error('Unsupported assembly size.')
  }
  const parts = data.parts.map(value => {
    const { id, part } = record(value)
    if (!validId(id) || !validPart(part)) throw new Error('Invalid part ID or unsupported component geometry.')
    return { id, part }
  })
  const joints = data.joints.map(value => {
    const { parent, host, child, twist } = record(value)
    if (!validId(parent) || !validId(host) || !validId(child) || !validTwist(twist)) throw new Error('Invalid joint or rotation.')
    return { parent, host, child, twist }
  })
  const result = { catalog: catalogRevision, revision, parts, joints } as const
  resolveAssembly(result)
  return freezeAssembly(result)
}

export function revise(assembly: Assembly, edit: Edit, capabilities: readonly string[]): Assembly {
  let parts = [...assembly.parts]
  let joints = [...assembly.joints]
  const attached = joints.find(joint => joint.child === edit.id)
  const current = parts.find(part => part.id === edit.id)
  if (edit.id === 'bus') throw new Error('The root bus is fixed.')
  if (edit.kind === 'install' || edit.kind === 'attach') {
    const part = edit.kind === 'install' ? edit.part : current?.part
    if (!validPart(part) || part === 'bus') throw new Error('Select an available component.')
    const required = partDefinition(part).capability
    if (required && !capabilities.includes(required)) throw new Error('This component requires completed pointing research.')
    if (edit.kind === 'install') {
      if (current) throw new Error('Duplicate part identifier.')
      parts.push({ id: edit.id, part })
    } else if (attached) throw new Error('Detach the part before attaching it again.')
    if (!resolveAssembly(assembly).some(candidate => candidate.id === edit.parent && candidate.mounted)) {
      throw new Error('Select a mount on the spacecraft.')
    }
    joints.push({ parent: edit.parent, child: edit.id, host: edit.host, twist: edit.twist })
  } else {
    if (!current) throw new Error('Select an existing part.')
    if (edit.kind === 'rotate') {
      if (!attached) throw new Error('Attach this part before rotating its mount.')
      if (attached.twist === edit.twist) return assembly
      joints = joints.map(joint => joint === attached ? { ...joint, twist: edit.twist } : joint)
    } else if (edit.kind === 'detach') {
      if (!attached) throw new Error('This part is already detached.')
      joints = joints.filter(joint => joint !== attached)
    } else {
      const removed = new Set([edit.id])
      function removeChildren(parent: string) {
        for (const joint of joints.filter(joint => joint.parent === parent)) {
          removed.add(joint.child)
          removeChildren(joint.child)
        }
      }
      removeChildren(edit.id)
      parts = parts.filter(part => !removed.has(part.id))
      joints = joints.filter(joint => !removed.has(joint.child))
    }
  }
  return restoreAssembly({ ...assembly, revision: assembly.revision + 1, parts, joints })
}

export interface History { readonly past: readonly Assembly[]; readonly present: Assembly; readonly future: readonly Assembly[] }
export const historyOf = (present: Assembly): History => ({ past: [], present, future: [] })

export function recordRevision(history: History, present: Assembly): History {
  return present === history.present ? history : { past: [...history.past.slice(-49), history.present], present, future: [] }
}

export function travel(history: History, direction: 'undo' | 'redo'): History {
  const target = direction === 'undo' ? history.past.at(-1) : history.future[0]
  if (!target) return history
  const present = freezeAssembly({ ...target, revision: history.present.revision + 1 })
  return direction === 'undo'
    ? { past: history.past.slice(0, -1), present, future: [history.present, ...history.future] }
    : { past: [...history.past, history.present], present, future: history.future.slice(1) }
}
