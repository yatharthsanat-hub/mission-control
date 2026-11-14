import { inertialFrame, metres, orbitModel, propagate, radians, seconds, tdbEpoch } from './physics/twoBody.ts'
import { sources } from './sources.ts'

export const training = {
  title: 'Earth observation training',
  user: 'Regional agriculture team',
  deliverable: 'Submit a crop-imaging concept with a band coverage check and a calculated orbital period.',
  budgetLines: [
    ['Hardware', 14_000_000],
    ['Integration and test · 800 h × $100/h', 8_000_000],
    ['Scenario launch service', 6_000_000],
    ['Ground support · 100 h × $200/h', 2_000_000],
    ['Operations · 400 h × $100/h', 4_000_000],
  ] as const,
  reservePercent: 20,
  completionGrantCents: 6_000_000,
  requiredBands: [
    { label: 'Red', publishedUm: [0.64, 0.67], rangeM: [640e-9, 670e-9] },
    { label: 'Near infrared', publishedUm: [0.85, 0.88], rangeM: [850e-9, 880e-9] },
  ],
  maximumPeriodS: 6000,
  requirementSourceId: sources.science.id,
  bandSourceId: sources.landsat.id,
} as const

export const trainingEstimateCents = training.budgetLines.reduce((sum, [, cents]) => sum + cents, 0)
export const trainingCommitmentCents = trainingEstimateCents * (100 + training.reservePercent) / 100
export const startingGrantCents = 50_000_000
export const research = {
  name: 'Pointing stability study',
  prerequisite: 'Accepted Earth observation training review',
  capability: 'Fine-pointing attitude-control module eligibility',
  capabilityId: 'fine-pointing-adcs',
  durationDays: 3,
  costCents: 8_500_000,
} as const

export const payloads = {
  visible: { label: 'Visible camera', bandsM: [[620e-9, 690e-9]] },
  multispectral: { label: 'Red + near-infrared camera', bandsM: [[620e-9, 690e-9], [830e-9, 900e-9]] },
} as const

export type PayloadId = keyof typeof payloads
export type TrainingOrbitM = 7_000_000 | 7_500_000

export function assessTraining(payload: PayloadId, axisM: TrainingOrbitM) {
  const { periodS, velocityMps, provenance, frame, epochTdbSeconds } = propagate({
    frame: inertialFrame,
    epochTdbSeconds: tdbEpoch(0),
    semiMajorAxisM: metres(axisM),
    eccentricity: 0,
    inclinationRad: radians(0),
    ascendingNodeRad: radians(0),
    periapsisArgumentRad: radians(0),
    meanAnomalyRad: radians(0),
  }, seconds(0))
  const missingBands = training.requiredBands.filter(({ rangeM: [lo, hi] }) =>
    !payloads[payload].bandsM.some(([start, end]) => start <= lo && end >= hi)).map(band => band.label)
  return {
    payload,
    axisM,
    altitudeM: axisM - orbitModel.sphereRadiusM,
    periodS,
    frame,
    epochTdbSeconds,
    speedMps: Math.hypot(...velocityMps),
    missingBands,
    meetsPeriod: periodS <= training.maximumPeriodS,
    accepted: missingBands.length === 0 && periodS <= training.maximumPeriodS,
    sourceIds: [training.requirementSourceId, training.bandSourceId, ...provenance.inputIds],
    modelRevision: provenance.modelRevision,
    registryRevision: provenance.registryRevision,
    scenarioRevision: 'earth-training-1',
  }
}
