import { finances, unlockedCapabilities } from '../agency.ts'
import type { Agency } from '../agency.ts'
import { assemblySources, launchEnvelope, partDefinition } from '../assembly/catalog.ts'
import { engineering, restoreAssembly } from '../assembly/engine.ts'
import type { Assembly } from '../assembly/engine.ts'
import { earthGravity, orbitModel } from '../physics/twoBody.ts'
import { sourceRegistryRevision, sources } from '../sources.ts'
import { payloads, training } from '../training.ts'
import { environment, orbitalSummary, orbitDefaults } from './orbit.ts'
import type { OrbitInput } from './orbit.ts'

export const objectives = {
  crops: { label: 'Crop monitoring', product: 'Red and near-infrared scenes for vegetation assessment', bands: training.requiredBands, scenes: 2, groundSampleLimitM: 40, minSunElevationDeg: 15 },
  floods: { label: 'Coastal flood mapping', product: 'Blue, green and red scenes for water-boundary review', bands: [
    { label: 'Blue', publishedUm: [0.45, 0.51], rangeM: [450e-9, 510e-9] },
    { label: 'Green', publishedUm: [0.53, 0.59], rangeM: [530e-9, 590e-9] },
    training.requiredBands[0],
  ], scenes: 2, groundSampleLimitM: 60, minSunElevationDeg: 15 },
} as const

export const targets = {
  valley: { label: 'Sacramento Valley', latitudeDeg: 38.58, longitudeDeg: -121.49, radiusM: 45_000, objective: 'crops' },
  delta: { label: 'Mississippi River Delta', latitudeDeg: 29.20, longitudeDeg: -89.30, radiusM: 45_000, objective: 'floods' },
} as const

export const launches = {
  survey: { ...launchEnvelope, costCents: 2_500_000, minInclinationDeg: 0, maxInclinationDeg: 100 },
  extended: { label: 'Illustrative extended rideshare', minM: [-.24, -.24, -.24], maxM: [.24, .24, .45],
    maxWetKg: 6, maxComOffsetM: [.08, .08, .20], costCents: 4_000_000, minInclinationDeg: 0, maxInclinationDeg: 180 },
} as const

export const missionSources = {
  gravity: sources.earthGm,
  spin: { title: 'JPL Astrodynamic Parameters', locator: 'Astrodynamic Parameters, mean sidereal day', url: sources.earthGm.url },
  science: sources.science,
  maturity: { title: 'Space Mission Concept Development Using Concept Maturity Levels', locator: '§II, Figs. 1, 3–4',
    url: 'https://ntrs.nasa.gov/citations/20150007816' },
  spectral: { ...sources.landsat, locator: 'Operational Land Imager, bands 2–5' },
  interface: assemblySources.interface,
  power: assemblySources.power,
  radio: assemblySources.radio,
  attitude: assemblySources.attitude,
} as const

export interface Plan {
  objective: keyof typeof objectives
  target: keyof typeof targets
  launch: keyof typeof launches
  orbit: OrbitInput
  revisedFrom: string | null
}

export interface Finding {
  id: string
  status: 'PASS' | 'WARNING' | 'FAIL'
  explanation: string
  source?: keyof typeof missionSources
}

export const defaultPlan: Plan = { objective: 'crops', target: 'valley', launch: 'survey', orbit: orbitDefaults, revisedFrom: null }
export const contractId = 'earth-observation-training' as const
export const maxApprovedMissions = 8
const operationsCents = 1_000_000
const scenarioRevision = 'earth-observation-plan-1'

export function review(plan: Plan, assembly: Assembly, availableCents: number, capabilities: readonly string[]) {
  const totals = engineering(assembly)
  const parts = totals.parts.map(part => {
    const { generationW, capacityJ, loadW, massKg, costCents, capability } = partDefinition(part.part)
    return { ...part, generationW, capacityJ, loadW, massKg, costCents, capability: capability ?? null }
  })
  const camera = parts.find(part => part.part === 'imager')
  const radio = parts.find(part => part.part === 'radio')
  const housekeepingW = partDefinition('bus').loadW
  const objective = objectives[plan.objective]
  const target = targets[plan.target]
  const launch = launches[plan.launch]
  const budget = { availableCents, hardwareCents: totals.costCents, launchCents: launch.costCents,
    operationsCents, totalCents: totals.costCents + launch.costCents + operationsCents }
  const cameraProfile = { widthPixels: 1024, heightPixels: 1024, bitsPerPixelPerBand: 12, bandCount: 2 }
  const spacecraft = {
    parts, dryKg: totals.dryKg, wetKg: totals.wetKg, comM: totals.comM, bounds: totals.bounds, dimensionsM: totals.dimensionsM,
    power: { nominalGenerationW: totals.generationW, batteryCapacityJ: totals.capacityJ, housekeepingW,
      maxConcurrentLoadW: totals.peakLoadW, chargeEfficiency: 1, dischargeEfficiency: 1 },
    payload: camera ? { instanceId: camera.id, bandsM: payloads.multispectral.bandsM, activeLoadW: camera.loadW,
      pixelIfovRad: 45e-6, ...cameraProfile,
      sceneBits: cameraProfile.widthPixels * cameraProfile.heightPixels * cameraProfile.bitsPerPixelPerBand * cameraProfile.bandCount } : null,
    communications: radio ? { instanceId: radio.id, activeLoadW: radio.loadW, maxBitRateBps: 256_000 } : null,
    storageCapacityBits: 268_435_456,
  }
  const findings: Finding[] = []
  function add(id: string, status: Finding['status'], explanation: string, source?: Finding['source']) {
    findings.push(source ? { id, status, explanation, source } : { id, status, explanation })
  }
  let orbit: ReturnType<typeof orbitalSummary> | null = null
  try {
    orbit = orbitalSummary(plan.orbit)
    add('Orbit scope', 'PASS', 'Both apsides and all elements are in the documented two-body range.', 'gravity')
  } catch (error) {
    add('Orbit scope', 'FAIL', error instanceof Error ? error.message : 'Unsupported orbit.', 'gravity')
  }
  const missing = objective.bands.filter(band => !spacecraft.payload?.bandsM.some(([lo, hi]) => lo <= band.rangeM[0] && hi >= band.rangeM[1]))
  add('Payload spectrum', !camera || missing.length ? 'FAIL' : 'PASS',
    !camera ? 'Mount an imaging payload on the vehicle.' : missing.length ? 'Mounted camera lacks ' + missing.map(band => band.label).join(', ') + '. Choose an objective supported by the camera.' :
      'Mounted camera covers all required wavelength intervals.', 'spectral')
  if (orbit && spacecraft.payload) {
    const bestGsdM = orbit.perigeeM * spacecraft.payload.pixelIfovRad
    add('Best-case sample spacing', bestGsdM <= objective.groundSampleLimitM ? 'PASS' : 'FAIL',
      `Ideal nadir spacing at perigee is ${bestGsdM.toFixed(1)} m per pixel against a ${objective.groundSampleLimitM} m limit. This check assumes the illustrative optics and shows the best case along the orbit.`)
  }
  add('Target definition', target.objective === plan.objective ? 'PASS' : 'FAIL',
    target.objective === plan.objective ? 'The selected region is assigned to this science objective.' : 'Select the target region assigned to the science objective.', 'science')
  add('Observation access', 'WARNING', 'The geographic preview shows sampled subpoints. Footprint, resolution, illumination and usable observations still need evaluation.', 'spin')
  const locked = parts.some(part => part.capability && !capabilities.includes(part.capability))
  add('Research eligibility', locked ? 'FAIL' : 'PASS', locked ? 'Complete pointing research or remove the locked part.' : 'All mounted parts are eligible at approval.', 'attitude')
  add('Draft completeness', assembly.parts.length === parts.length ? 'PASS' : 'FAIL',
    assembly.parts.length === parts.length ? 'All draft parts are mounted.' : 'Mount or remove detached parts before approval.')
  const fits = [0, 1, 2].every(axis => totals.bounds.min[axis] >= launch.minM[axis] - 1e-9 &&
    totals.bounds.max[axis] <= launch.maxM[axis] + 1e-9 && Math.abs(totals.comM[axis]) <= launch.maxComOffsetM[axis] + 1e-9)
  add('Stowed fit', fits ? 'PASS' : 'FAIL', fits ? 'Mounted geometry and center of mass fit the selected fictional service.' :
    'Change the stowed assembly geometry or select a larger service. Fit includes center-of-mass limits.', 'interface')
  add('Launch mass', totals.wetKg <= launch.maxWetKg + 1e-9 ? 'PASS' : 'FAIL',
    'Wet mass ' + totals.wetKg.toFixed(2) + ' kg against a ' + launch.maxWetKg + ' kg scenario limit. Reduce mass or change service if over.', 'interface')
  const launchOrbit = orbit && plan.orbit.inclinationDeg >= launch.minInclinationDeg && plan.orbit.inclinationDeg <= launch.maxInclinationDeg
  add('Service inclination', launchOrbit ? 'PASS' : 'FAIL', 'Selected service supports ' + launch.minInclinationDeg + '–' + launch.maxInclinationDeg + '° in this scenario. Match the orbit or switch services.', 'interface')
  add('Sunlit housekeeping', totals.generationW >= housekeepingW ? 'PASS' : 'FAIL',
    totals.generationW >= housekeepingW ? 'Nominal sun-pointed output covers housekeeping.' : 'Add solar generation to cover housekeeping in nominal sunlight.', 'power')
  add('Concurrent loads', 'WARNING', totals.generationW < totals.peakLoadW ?
    'Peak load exceeds nominal generation. Schedule imaging and downlink separately or add generation.' :
    'Nominal generation covers simultaneous nameplate loads. Time-dependent energy balance remains open.', 'power')
  add('Battery installed', totals.capacityJ > 0 ? 'PASS' : 'FAIL', totals.capacityJ > 0 ?
    'Stored energy is available. Eclipse duration and load scheduling remain open.' : 'Mount a battery for eclipse operations.', 'power')
  add('Radio installed', radio ? 'PASS' : 'FAIL', radio ? 'A compatible radio is mounted.' : 'Mount a telemetry radio.', 'radio')
  if (radio) add('Ground link', 'WARNING', 'A fictional terminal and capped bit rate are defined. Contact timing and RF margin remain open.', 'radio')
  add('Funding', budget.totalCents <= availableCents ? 'PASS' : 'FAIL', budget.totalCents <= availableCents ?
    'Available USD covers the projected commitment.' : 'Reduce cost or return after agency funding increases.', 'maturity')
  return { orbit, launch, target, objective, budget, spacecraft, findings }
}

function parsePlan(raw: unknown): Plan {
  const input = record(raw)
  const orbit = record(input.orbit)
  const values = Object.keys(orbitDefaults)
  if (Object.keys(orbit).length !== values.length || values.some(key => typeof orbit[key] !== 'number' || !Number.isFinite(orbit[key]))) {
    throw new Error('Invalid orbit input.')
  }
  return { objective: choice(input.objective, objectives), target: choice(input.target, targets), launch: choice(input.launch, launches),
    orbit: { ...orbit } as OrbitInput, revisedFrom: input.revisedFrom === null ? null : identifier(input.revisedFrom) }
}

function record(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid mission record.')
  return raw as Record<string, unknown>
}

function identifier(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(value)) throw new Error('Invalid mission identifier.')
  return value
}

function choice<T extends object>(value: unknown, choices: T): keyof T & string {
  if (typeof value !== 'string' || !Object.hasOwn(choices, value)) throw new Error('Unsupported mission option.')
  return value as keyof T & string
}

export function approvalContext(agencyId: string, agency: Agency) {
  return { agencyId, agencyName: agency.name, programDay: agency.day, availableCents: Number(finances(agency.ledger).available),
    capabilities: [...unlockedCapabilities(agency)] as string[] }
}

type Approval = ReturnType<typeof approvalContext>
type Immutable<T> = { readonly [K in keyof T]: Immutable<T[K]> }

function freeze<T>(value: T): Immutable<T> {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value as Immutable<T>
}

function buildMission(id: string, plan: Plan, assembly: Assembly, approval: Approval) {
  const assessed = review(plan, assembly, approval.availableCents, approval.capabilities)
  const { spacecraft } = assessed
  if (!assessed.orbit || !spacecraft.payload || !spacecraft.communications ||
    assessed.findings.some(finding => finding.status === 'FAIL')) throw new Error('Resolve failed readiness checks before approval.')
  return {
    schemaVersion: 1 as const, id, contractId, approval, plan, assembly, ...assessed, orbit: assessed.orbit,
    spacecraft: { ...spacecraft, payload: spacecraft.payload, communications: spacecraft.communications },
    models: { orbit: orbitModel.revision, scenario: scenarioRevision, environment: environment.revision, sourceRegistry: sourceRegistryRevision },
    catalogRevision: assembly.catalog,
    units: { position: 'm', velocity: 'm/s', time: 's', timeScale: 'TDB', epochOrigin: 'J2000', orbitalAngle: 'rad', geographicAngle: 'deg',
      mass: 'kg', power: 'W', energy: 'J', data: 'bit', currency: 'USD cents' },
    environment, earthGravity, sources: missionSources,
    executionInputs: {
      geometry: 'spherical-nadir-target-radius-1',
      eclipse: 'parallel-sun-cylindrical-shadow-1',
      groundLink: 'spherical-station-elevation-capped-rate-1',
      energy: 'ideal-battery-nominal-in-sun-1',
      payloadAccounting: 'one-scene-per-contiguous-target-window-1',
      activityLoadPolicy: 'housekeeping-always-attitude-load-when-imaging',
      operationPolicy: 'downlink-existing-data-before-imaging-fifo-1',
      powerReserveJ: 0,
    },
  }
}

export type MissionConfiguration = Immutable<ReturnType<typeof buildMission>>

export function approveMission(id: string, rawPlan: Plan, snapshot: Assembly, approval: Approval): MissionConfiguration {
  const plan = parsePlan(rawPlan)
  if (plan.revisedFrom === id) throw new Error('A mission cannot revise itself.')
  return freeze(structuredClone(buildMission(identifier(id), plan, restoreAssembly(snapshot), parseApproval(approval))))
}

// JS engines can produce different last bits for trigonometric functions.
const stateVectorTolerance: Readonly<Record<string, number>> = {
  'orbit.initialState.positionM': 1e-7,
  'orbit.initialState.velocityMps': 1e-10,
  'orbit.initialState.accelerationMps2': 1e-12,
}

function matches(value: unknown, expected: unknown, path = '', tolerance = 0): boolean {
  if (Object.is(value, expected) || value === expected) return true
  if (tolerance && typeof value === 'number' && typeof expected === 'number' && Number.isFinite(value)) {
    return Math.abs(value - expected) <= tolerance
  }
  if (!value || !expected || typeof value !== 'object' || typeof expected !== 'object' || Array.isArray(value) !== Array.isArray(expected)) return false
  const actual = value as Record<string, unknown>
  const canonical = expected as Record<string, unknown>
  return Object.keys(actual).length === Object.keys(canonical).length &&
    Object.keys(canonical).every(key => Object.hasOwn(actual, key) &&
      matches(actual[key], canonical[key], path ? path + '.' + key : key, stateVectorTolerance[path] ?? 0))
}

export function restoreMission(value: unknown): MissionConfiguration {
  const input = record(value)
  if (input.schemaVersion !== 1) throw new Error('Unsupported mission schema version.')
  const rebuilt = approveMission(identifier(input.id), parsePlan(input.plan), restoreAssembly(input.assembly), parseApproval(input.approval))
  if (!matches(input, rebuilt)) throw new Error('Mission configuration does not match its supported scenario, inputs and models.')
  // Shape and vector components have been checked above. Preserve the original
  // approved vectors instead of replacing them with local trig results.
  const { positionM, velocityMps, accelerationMps2 } = (input as unknown as MissionConfiguration).orbit.initialState
  return freeze({
    ...rebuilt, orbit: { ...rebuilt.orbit, initialState: {
      ...rebuilt.orbit.initialState, positionM: [...positionM] as typeof positionM,
      velocityMps: [...velocityMps] as typeof velocityMps,
      accelerationMps2: [...accelerationMps2] as typeof accelerationMps2,
    } },
  })
}

function parseApproval(value: unknown): Approval {
  const approval = record(value)
  if (typeof approval.agencyName !== 'string' || approval.agencyName.trim() !== approval.agencyName ||
    approval.agencyName.length < 2 || approval.agencyName.length > 60 || /\p{Cc}/u.test(approval.agencyName) ||
    typeof approval.programDay !== 'number' || !Number.isSafeInteger(approval.programDay) || approval.programDay < 1 ||
    typeof approval.availableCents !== 'number' || !Number.isSafeInteger(approval.availableCents) || approval.availableCents < 0 ||
    !Array.isArray(approval.capabilities) || approval.capabilities.length > 1 ||
    approval.capabilities.some(item => item !== 'fine-pointing-adcs')) throw new Error('Invalid mission approval context.')
  return {
    agencyId: identifier(approval.agencyId), agencyName: approval.agencyName, programDay: approval.programDay,
    availableCents: approval.availableCents, capabilities: approval.capabilities,
  }
}
