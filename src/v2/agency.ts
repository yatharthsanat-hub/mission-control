import { assessTraining, research, startingGrantCents, training, trainingCommitmentCents, trainingEstimateCents } from './training.ts'
import type { PayloadId, TrainingOrbitM } from './training.ts'

type Cents = number & { readonly unit: 'USD cents' }
type Account = 'agency' | 'training' | 'research'

export interface LedgerEntry {
  id: string
  day: number
  account: Account
  kind: 'grant' | 'commitment' | 'payment' | 'release'
  cents: Cents
  label: string
}

export type Command =
  | { id: string; kind: 'fund-training' | 'start-research' | 'advance-day' }
  | { id: string; kind: 'submit-review'; payload: PayloadId; axisM: TrainingOrbitM }

export interface Agency {
  name: string
  day: number
  mission: 'available' | 'funded' | 'accepted'
  review: ReturnType<typeof assessTraining> | null
  research: { status: 'available' } | { status: 'scheduled' | 'complete'; readyDay: number }
  ledger: readonly LedgerEntry[]
  commands: readonly Command[]
}

export function agencyName(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Enter an agency name.')
  const name = value.trim()
  if (name.length < 2 || name.length > 60 || /\p{Cc}/u.test(name)) {
    throw new Error('Use 2–60 characters for the agency name, without control characters.')
  }
  return name
}

function cents(amount: number): Cents {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('Invalid USD cents.')
  return amount as Cents
}

function entry(id: string, day: number, account: Account, kind: LedgerEntry['kind'], value: number, label: string): LedgerEntry {
  return { id, day, account, kind, cents: cents(value), label }
}

export function createAgency(name: string): Agency {
  return {
    name: agencyName(name), day: 1, mission: 'available', review: null,
    research: { status: 'available' }, commands: [],
    ledger: [entry('initial-grant', 1, 'agency', 'grant', startingGrantCents, 'Agency startup grant')],
  }
}

export function finances(ledger: readonly LedgerEntry[]) {
  let grants = 0
  let paid = 0
  let committed = 0
  for (const line of ledger) {
    if (line.kind === 'grant') grants += line.cents
    if (line.kind === 'commitment') committed += line.cents
    if (line.kind === 'release' || line.kind === 'payment') committed -= line.cents
    if (line.kind === 'payment') paid += line.cents
  }
  const cash = cents(grants - paid)
  return { cash, committed: cents(committed), paid: cents(paid), available: cents(cash - committed) }
}

export const maxCommands = 2000

export function unlockedCapabilities(agency: Agency): readonly (typeof research.capabilityId)[] {
  return agency.research.status === 'complete' ? [research.capabilityId] : []
}

export function applyCommand(agency: Agency, command: Command): Agency {
  const duplicate = agency.commands.find(item => item.id === command.id)
  if (duplicate) {
    if (duplicate.kind !== command.kind ||
      (duplicate.kind === 'submit-review' && command.kind === 'submit-review' &&
        (duplicate.payload !== command.payload || duplicate.axisM !== command.axisM))) {
      throw new Error('A different transaction already used this identifier.')
    }
    return agency
  }
  if (agency.commands.length >= maxCommands) throw new Error('The Phase 0 save has reached its command limit.')
  const ledger = [...agency.ledger]
  const next: Agency = { ...agency, ledger, commands: [...agency.commands, command] }
  function add(account: Account, kind: LedgerEntry['kind'], amount: number, label: string) {
    ledger.push(entry(`${command.id}/${ledger.length}`, next.day, account, kind, amount, label))
  }

  switch (command.kind) {
    case 'fund-training':
      if (agency.mission !== 'available') throw new Error('Training funds are already committed or settled.')
      if (finances(ledger).available < trainingCommitmentCents) throw new Error('Insufficient available cash.')
      next.mission = 'funded'
      add('training', 'commitment', trainingCommitmentCents, 'Training contract and contingency')
      break
    case 'submit-review': {
      if (agency.mission !== 'funded') throw new Error('Fund the training contract before submitting a review.')
      const review = assessTraining(command.payload, command.axisM)
      next.review = review
      if (review.accepted) {
        next.mission = 'accepted'
        add('training', 'payment', trainingEstimateCents, 'Training contract settlement')
        add('training', 'release', trainingCommitmentCents - trainingEstimateCents, 'Unused training contingency')
        add('training', 'grant', training.completionGrantCents, 'Training acceptance grant')
      }
      break
    }
    case 'start-research':
      if (agency.mission !== 'accepted') throw new Error('Complete the training review before starting research.')
      if (agency.research.status !== 'available') throw new Error('Research has already been scheduled.')
      if (finances(ledger).available < research.costCents) throw new Error('Insufficient available cash.')
      next.research = { status: 'scheduled', readyDay: next.day + research.durationDays }
      add('research', 'commitment', research.costCents, 'Pointing stability research')
      break
    case 'advance-day':
      next.day++
      if (agency.research.status === 'scheduled' && next.day >= agency.research.readyDay) {
        next.research = { ...agency.research, status: 'complete' }
        add('research', 'payment', research.costCents, 'Completed pointing stability research')
      }
      break
  }
  return next
}
