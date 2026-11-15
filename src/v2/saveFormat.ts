import { agencyName, applyCommand, createAgency, maxCommands, unlockedCapabilities } from './agency.ts'
import type { Agency, Command } from './agency.ts'
import { sourceRegistryRevision } from './sources.ts'
import { orbitModel } from './physics/twoBody.ts'
import { restoreAssembly } from './assembly/engine.ts'
import type { Assembly } from './assembly/engine.ts'
import { partDefinition } from './assembly/catalog.ts'
import { approvalContext, maxApprovedMissions, restoreMission } from './planning/mission.ts'
import type { ApprovedMission } from './planning/mission.ts'

export const maxSaveSize = 500_000
const catalogRevision = 'earth-training-1'

export interface Save {
  id: string
  revision: number
  agency: Agency
  assembly?: Assembly
  missions?: readonly ApprovedMission[]
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid save record.')
  return value as Record<string, unknown>
}

function identifier(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(value)) throw new Error('Invalid save or command identifier.')
  return value
}

// Detects accidental corruption. This checksum does not authenticate a save.
function checksum(payload: string) {
  let hash = 0x811c9dc5
  for (let i = 0; i < payload.length; i++) hash = Math.imul(hash ^ payload.charCodeAt(i), 0x01000193)
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function decodeCommand(value: unknown): Command {
  const input = object(value)
  const id = identifier(input.id)
  switch (input.kind) {
    case 'fund-training':
    case 'start-research':
    case 'advance-day':
      return { id, kind: input.kind }
    case 'reserve-mission':
      if (typeof input.cents !== 'number' || !Number.isSafeInteger(input.cents) || input.cents <= 0) break
      return { id, kind: input.kind, cents: input.cents }
    case 'submit-review':
      if ((input.payload !== 'visible' && input.payload !== 'multispectral') ||
          (input.axisM !== 7_000_000 && input.axisM !== 7_500_000)) break
      return { id, kind: input.kind, payload: input.payload, axisM: input.axisM }
  }
  throw new Error('Unsupported or invalid agency command.')
}

export function encodeSave(save: Save) {
  const payload = JSON.stringify({
    schemaVersion: save.missions?.length ? 4 : save.assembly ? 3 : 2, id: save.id, revision: save.revision, catalogRevision,
    sourceRegistryRevision, modelRevision: orbitModel.revision,
    name: save.agency.name, commands: save.agency.commands, assembly: save.assembly,
    missions: save.missions?.length ? save.missions : undefined,
  })
  return JSON.stringify({ payload, checksum: checksum(payload) })
}

export function decodeSave(raw: string): Save {
  if (raw.length > maxSaveSize) throw new Error('Save exceeds the Phase 0 size limit.')
  const envelope = object(JSON.parse(raw))
  if (typeof envelope.payload !== 'string' || checksum(envelope.payload) !== envelope.checksum) {
    throw new Error('Save checksum failed. The file may be corrupted.')
  }
  const original = object(JSON.parse(envelope.payload))
  // Schema 1 is the initial Phase 0 command log with its context implicit.
  const input = original.schemaVersion === 1
    ? { ...original, schemaVersion: 2, sourceRegistryRevision, modelRevision: orbitModel.revision }
    : original
  if (input.schemaVersion !== 2 && input.schemaVersion !== 3 && input.schemaVersion !== 4) throw new Error('Unsupported save schema version.')
  if (input.schemaVersion !== 4 && Object.hasOwn(input, 'missions')) throw new Error('Approved missions require agency save schema 4.')
  if (input.catalogRevision !== catalogRevision || input.sourceRegistryRevision !== sourceRegistryRevision ||
    input.modelRevision !== orbitModel.revision) throw new Error('Save requires an unavailable catalog, source registry, or model revision.')
  const id = identifier(input.id)
  const revision = input.revision
  if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0 || revision >= Number.MAX_SAFE_INTEGER) {
    throw new Error('Invalid save revision.')
  }
  if (!Array.isArray(input.commands) || input.commands.length > maxCommands) throw new Error('Invalid command history.')

  let agency = createAgency(agencyName(input.name))
  const missions = new Map<string, ApprovedMission>()
  if (input.schemaVersion === 4) {
    if (!Array.isArray(input.missions) || !input.missions.length || input.missions.length > maxApprovedMissions) {
      throw new Error('Invalid approved mission history.')
    }
    for (const value of input.missions) {
      const mission = restoreMission(value)
      if (missions.has(mission.id)) throw new Error('Duplicate approved mission identifier.')
      missions.set(mission.id, mission)
    }
  }
  const applied = new Set<string>()
  const approved: ApprovedMission[] = []
  for (const value of input.commands) {
    const command = decodeCommand(value)
    if (applied.has(command.id)) throw new Error('Duplicate transaction in save history.')
    if (command.kind === 'reserve-mission') {
      const mission = missions.get(command.id)
      if (!mission || mission.budget.totalCents !== command.cents) throw new Error('Missing or inconsistent mission commitment.')
      // An imported or restored agency can have a new local storage identifier.
      const context = approvalContext(mission.approval.agencyId, agency)
      if (mission.approval.agencyName !== context.agencyName || mission.approval.programDay !== context.programDay ||
        mission.approval.availableCents !== context.availableCents || mission.approval.capabilities.join() !== context.capabilities.join() ||
        (mission.plan.revisedFrom && !approved.some(prior => prior.id === mission.plan.revisedFrom))) {
        throw new Error('Mission approval does not match its ledger or revision history.')
      }
      approved.push(mission)
    }
    applied.add(command.id)
    agency = applyCommand(agency, command)
  }
  if (missions.size !== approved.length) throw new Error('An approved mission has no matching commitment.')
  if (input.schemaVersion === 2) return { id, revision, agency }
  const assembly = restoreAssembly(input.assembly)
  const capabilities = unlockedCapabilities(agency)
  for (const part of assembly.parts) {
    const required = partDefinition(part.part).capability
    if (required && !capabilities.includes(required)) throw new Error('Assembly contains a research-locked component.')
  }
  return { id, revision, agency, assembly, ...(approved.length ? { missions: Object.freeze(approved) } : {}) }
}

export function sameSaveContents(first: string, second: string): boolean {
  if (first === second) return true
  try {
    const canonical = (raw: string) => encodeSave({ ...decodeSave(raw), id: 'comparison', revision: 0 })
    return canonical(first) === canonical(second)
  } catch {
    return false
  }
}
