import { createFlightModel, forecastProfile } from './flightModel.ts'
import type { ForecastInput } from './flightModel.ts'
export { forecastProfile } from './flightModel.ts'

export interface Interval { startS: number; endS: number }
interface Access extends Interval { bestGsdM: number; rangeM: number; offNadirDeg: number; acrossM: number; alongM: number }
interface Contact extends Interval { minRangeM: number; maxRangeM: number; maxElevationDeg: number; maxPathLossDb: number }
const extend = <T extends Interval>(list: T[], startS: number, stepS: number, build: () => Omit<T, keyof Interval>): T => {
  const prior = list.at(-1)
  if (prior?.endS === startS) {
    prior.endS += stepS
    return prior
  }
  const next = { startS, endS: startS + stepS, ...build() } as T
  list.push(next)
  return next
}

export function analyzeForecast(input: ForecastInput, profile: typeof forecastProfile = forecastProfile) {
  const model = createFlightModel(input, profile)
  const { durationS, stepS } = profile
  const accesses: Access[] = []
  const contacts: Contact[] = []
  const eclipses: Interval[] = []
  const sunlight: Interval[] = []
  const missed = { horizon: 0, pointing: 0, footprint: 0, lighting: 0, resolution: 0, payload: 0 }
  const blockedOperations = { imagingPower: 0, imagingStorage: 0, imagingConflict: 0, downlinkPower: 0 }
  let resources = model.initial()
  let minChargeJ = resources.chargeJ
  let unmetJ = 0
  let generatedJ = 0
  let curtailedJ = 0
  let contactCapacityBits = 0
  const batteryTrace = [{ elapsedS: 0, chargeJ: resources.chargeJ }]
  for (let startS = 0; startS < durationS; startS += stepS) {
    const frame = model.sample(startS)
    extend(frame.eclipse ? eclipses : sunlight, startS, stepS, () => ({}))
    const { station, access } = frame
    if (station.inContact && station.pathLossDb !== null) {
      const lossDb = station.pathLossDb
      const contact = extend(contacts, startS, stepS, () => ({
        minRangeM: station.rangeM, maxRangeM: station.rangeM, maxElevationDeg: station.elevationDeg, maxPathLossDb: lossDb,
      }))
      contact.minRangeM = Math.min(contact.minRangeM, station.rangeM)
      contact.maxRangeM = Math.max(contact.maxRangeM, station.rangeM)
      contact.maxPathLossDb = Math.max(contact.maxPathLossDb, lossDb)
      contact.maxElevationDeg = Math.max(contact.maxElevationDeg, station.elevationDeg)
      contactCapacityBits += model.geometryCapacity
    }
    if (access.available) {
      const { bestGsdM, rangeM, offNadirDeg, acrossM, alongM } = access
      const geometry = { bestGsdM, rangeM, offNadirDeg, acrossM, alongM }
      const window = extend(accesses, startS, stepS, () => geometry)
      if (bestGsdM < window.bestGsdM) Object.assign(window, geometry)
    } else missed[access.reason]++

    const next = model.advance(resources, frame, { observe: access.available, downlink: station.inContact })
    resources = next.resources
    if (next.captureReject === 'Insufficient power for the imager.') blockedOperations.imagingPower++
    if (next.captureReject === 'Insufficient onboard storage.') blockedOperations.imagingStorage++
    if (next.captureReject === 'Radio transmission has priority in this interval.') blockedOperations.imagingConflict++
    if (next.downlinkReject === 'Insufficient power for the radio.') blockedOperations.downlinkPower++
    minChargeJ = Math.min(minChargeJ, resources.chargeJ)
    generatedJ += frame.generationW * stepS
    unmetJ += next.energy.unservedJ
    curtailedJ += next.energy.curtailedJ
    if ((startS + stepS) % 60 === 0 || startS + stepS === durationS) batteryTrace.push({ elapsedS: startS + stepS, chargeJ: resources.chargeJ })
  }
  return {
    durationS, stepS, accesses, contacts, sunlight, eclipses, missed, instrument: model.instrument,
    power: { capacityJ: model.batteryCapacityJ, minChargeJ, endChargeJ: resources.chargeJ, unmetJ, generatedJ, curtailedJ, batteryTrace },
    communications: { rateBps: model.rateBps, contactCapacityBits, deliveredBits: resources.deliveredBits, delivered: resources.delivered,
      linkBudget: profile.linkBudget, frequencyHz: profile.downlinkFrequencyHz },
    science: { captured: resources.captured, goal: input.objective.scenes, onboardBits: resources.occupiedBits },
    blockedOperations,
  }
}

export type Forecast = ReturnType<typeof analyzeForecast>
