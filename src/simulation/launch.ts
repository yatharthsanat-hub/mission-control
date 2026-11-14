import { batteries, bus, imagers, missionObjectives, orbitOptions, radios, simulationRules, solarArrays } from './catalog.ts'
import type { SpacecraftConfiguration } from './catalog.ts'
import type { LaunchResources, LaunchViolation, SpectralBand } from './types.ts'

export interface LaunchCheck {
  resources: LaunchResources | null
  violations: readonly LaunchViolation[]
}

export function sumLaunchResources(
  massGrams: number,
  massLimitGrams: number,
  costCredits: number,
  budgetCredits: number,
): LaunchResources {
  return {
    massGrams,
    massLimitGrams,
    massHeadroomGrams: massLimitGrams - massGrams,
    costCredits,
    budgetCredits,
    remainingCredits: budgetCredits - costCredits,
  }
}

export function checkResourceLimits(resources: LaunchResources): LaunchViolation[] {
  const violations: LaunchViolation[] = []
  if (resources.massHeadroomGrams < 0) {
    const excessGrams = -resources.massHeadroomGrams
    violations.push({ code: 'mass-limit', excessGrams, message: `The spacecraft exceeds the launch mass limit by ${excessGrams} g. Choose lighter parts or another launch offer.` })
  }
  if (resources.remainingCredits < 0) {
    const excessCredits = -resources.remainingCredits
    violations.push({ code: 'budget-limit', excessCredits, message: `The design is ${excessCredits} credits over budget. Choose lower-cost parts or a cheaper launch offer.` })
  }
  return violations
}

function lookup<Catalog extends Record<string, unknown>>(
  catalog: Catalog,
  key: Extract<keyof Catalog, string> | undefined,
): Catalog[keyof Catalog] | undefined {
  return typeof key === 'string' && Object.hasOwn(catalog, key) ? catalog[key] : undefined
}

export function validateLaunch(draft: Readonly<Partial<SpacecraftConfiguration>>): LaunchCheck {
  const objective = lookup(missionObjectives, draft.objective)
  const orbit = lookup(orbitOptions, draft.orbit)
  const imager = lookup(imagers, draft.imager)
  const solarArray = lookup(solarArrays, draft.solarArray)
  const battery = lookup(batteries, draft.battery)
  const radio = lookup(radios, draft.radio)
  const allowedReserve = draft.reservePercent !== undefined &&
    simulationRules.reservePercents.includes(draft.reservePercent)
  const selections = { objective, orbit, imager, solarArray, battery, radio, reservePercent: allowedReserve }
  const selectionLabels = {
    objective: 'science objective', orbit: 'launch and orbit offer', imager: 'imager',
    solarArray: 'solar array', battery: 'battery', radio: 'radio', reservePercent: 'battery reserve policy',
  }
  const violations: LaunchViolation[] = []
  for (const field of Object.keys(selections) as (keyof SpacecraftConfiguration)[]) {
    if (!selections[field]) {
      violations.push({ code: 'invalid-selection', field, message: `Select a valid ${selectionLabels[field]}.` })
    }
  }

  if (objective && imager) {
    const bands: readonly SpectralBand[] = imager.bands
    const missingBands = objective.requiredBands.filter(band => !bands.includes(band))
    if (missingBands.length > 0) {
      violations.push({ code: 'incompatible-imager', missingBands, message: `Choose an imager with the required bands. Missing: ${missingBands.join(', ')}.` })
    }
  }

  if (!objective || !orbit || !imager || !solarArray || !battery || !radio) {
    return { resources: null, violations }
  }

  const parts = [bus, imager, solarArray, battery, radio]
  const resources = sumLaunchResources(
    parts.reduce((mass, part) => mass + part.massGrams, 0),
    orbit.massLimitGrams,
    parts.reduce((cost, part) => cost + part.costCredits, orbit.launchCostCredits),
    objective.budgetCredits,
  )
  return { resources, violations: [...violations, ...checkResourceLimits(resources)] }
}
