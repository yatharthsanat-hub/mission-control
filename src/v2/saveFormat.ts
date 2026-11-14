import { agencyName, applyCommand, createAgency, maxCommands } from './agency.ts'
import type { Agency, Command } from './agency.ts'
import { sourceRegistryRevision } from './sources.ts'
import { orbitModel } from './physics/twoBody.ts'

export const maxSaveSize = 500_000
const catalogRevision = 'earth-training-1'

export interface Save {
  id: string
  revision: number
  agency: Agency
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
    case 'submit-review':
      if ((input.payload !== 'visible' && input.payload !== 'multispectral') ||
          (input.axisM !== 7_000_000 && input.axisM !== 7_500_000)) break
      return { id, kind: input.kind, payload: input.payload, axisM: input.axisM }
  }
  throw new Error('Unsupported or invalid agency command.')
}

export function encodeSave(save: Save) {
  const payload = JSON.stringify({
    schemaVersion: 2, id: save.id, revision: save.revision, catalogRevision,
    sourceRegistryRevision, modelRevision: orbitModel.revision,
    name: save.agency.name, commands: save.agency.commands,
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
  if (input.schemaVersion !== 2) throw new Error('Unsupported save schema version.')
  if (input.catalogRevision !== catalogRevision || input.sourceRegistryRevision !== sourceRegistryRevision ||
    input.modelRevision !== orbitModel.revision) throw new Error('Save requires an unavailable catalog, source registry, or model revision.')
  const id = identifier(input.id)
  const revision = input.revision
  if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0 || revision >= Number.MAX_SAFE_INTEGER) {
    throw new Error('Invalid save revision.')
  }
  if (!Array.isArray(input.commands) || input.commands.length > maxCommands) throw new Error('Invalid command history.')

  let agency = createAgency(agencyName(input.name))
  const applied = new Set<string>()
  for (const value of input.commands) {
    const command = decodeCommand(value)
    if (applied.has(command.id)) throw new Error('Duplicate transaction in save history.')
    applied.add(command.id)
    agency = applyCommand(agency, command)
  }
  return { id, revision, agency }
}
