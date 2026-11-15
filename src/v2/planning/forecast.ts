import { propagate, seconds } from '../physics/twoBody.ts'
import type { Elements } from '../physics/twoBody.ts'
import type { environment } from './orbit.ts'
import { advanceBattery, fieldOfViewRad, freeSpaceLossDb, inEclipse, inertialToFixed, missingSpectralBands, observationGeometry, sceneVolumeBits, siteUnit, siteView, solarElevationRad } from './geometry.ts'
import type { Optics, Site } from './geometry.ts'

const rad = Math.PI / 180
export const forecastProfile = Object.freeze({
  revision: 'earth-forecast-1',
  durationS: 86_400,
  stepS: 5,
  fixedFrame: 'synthetic-earth-fixed-z-spin-1',
  geometry: 'target-centered-conical-fov-spherical-1',
  eclipse: 'parallel-sun-cylindrical-shadow-1',
  scheduling: 'midpoint-fifo-downlink-priority-one-scene-per-window-1',
  imagerSlewDeg: 25,
  fineSlewDeg: 40,
  minFootprintAcrossM: 10_000,
  solarOutputFraction: .8,
  lowChargeFraction: .15,
  downlinkFrequencyHz: 2_200_000_000,
  linkBudget: 'NOT ASSESSED',
} as const)

interface ForecastInput {
  readonly orbit: { readonly elements: Elements }
  readonly environment: Omit<typeof environment, 'durationS' | 'stepS'>
  readonly target: Site & { readonly radiusM: number }
  readonly objective: { readonly scenes: number; readonly groundSampleLimitM: number; readonly minSunElevationDeg: number
    readonly bands: readonly { readonly rangeM: readonly [number, number] }[] }
  readonly spacecraft: {
    readonly payload: (Optics & { readonly activeLoadW: number; readonly bitsPerPixelPerBand: number; readonly bandCount: number
      readonly bandsM: readonly (readonly [number, number])[] }) | null
    readonly communications: { readonly activeLoadW: number; readonly maxBitRateBps: number } | null
    readonly parts: readonly { readonly part: string; readonly loadW: number }[]
    readonly storageCapacityBits: number
    readonly power: { readonly nominalGenerationW: number; readonly batteryCapacityJ: number; readonly housekeepingW: number
      readonly chargeEfficiency: number; readonly dischargeEfficiency: number }
  }
}

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
  const { orbit, environment: env, spacecraft, target, objective } = input
  const { payload, power, communications } = spacecraft
  const { durationS, stepS } = profile
  const targetUp = siteUnit(target)
  const stationUp = siteUnit(env.groundStation)
  const steering = spacecraft.parts.find(part => part.part === 'fine')
  const maxPointingDeg = steering ? profile.fineSlewDeg : profile.imagerSlewDeg
  const fovRad = payload ? fieldOfViewRad(payload) : null
  const sceneBits = payload ? sceneVolumeBits(payload.widthPixels, payload.heightPixels, payload.bitsPerPixelPerBand, payload.bandCount) : 0
  const spectralSuitability = missingSpectralBands(objective.bands, payload?.bandsM).length === 0
  const rateBps = communications ? Math.min(communications.maxBitRateBps, env.groundStation.maxBitRateBps) : 0
  const geometryCapacity = rateBps * stepS
  const accesses: Access[] = []
  const contacts: Contact[] = []
  const eclipses: Interval[] = []
  const sunlight: Interval[] = []
  const missed = { horizon: 0, pointing: 0, footprint: 0, lighting: 0, resolution: 0, payload: 0 }
  const batteryCapacityJ = power.batteryCapacityJ
  let chargeJ = batteryCapacityJ * env.initialBatteryFraction
  let minChargeJ = chargeJ
  let unmetJ = 0
  let generatedJ = 0
  let curtailedJ = 0
  let captured = 0
  let delivered = 0
  let deliveredBits = 0
  let contactCapacityBits = 0
  let occupiedBits: number = env.initialStorageBits
  const blockedOperations = { imagingPower: 0, imagingStorage: 0, imagingConflict: 0, downlinkPower: 0 }
  const queue: number[] = []
  let usedWindow: Access | undefined
  const batteryTrace = [{ elapsedS: 0, chargeJ }]
  const snapshotStride = 60
  for (let startS = 0; startS < durationS; startS += stepS) {
    const t = startS + stepS / 2
    const position = propagate(orbit.elements, seconds(t)).positionM
    const fixed = inertialToFixed(position, t, env.siderealDayS, env.primeMeridianAngleAtEpochRad)
    const sunFixed = inertialToFixed(env.sunDirectionInertial, t, env.siderealDayS, env.primeMeridianAngleAtEpochRad)
    const eclipse = inEclipse(position, env.sunDirectionInertial, env.earthRadiusM)
    extend(eclipse ? eclipses : sunlight, startS, stepS, () => ({}))
    const generationW = eclipse ? 0 : power.nominalGenerationW * profile.solarOutputFraction
    const stationView = siteView(fixed, stationUp, env.earthRadiusM)
    const inContact = stationView.elevationRad + 1e-12 >= env.groundStation.minElevationDeg * rad
    if (inContact) {
      const lossDb = freeSpaceLossDb(stationView.rangeM, profile.downlinkFrequencyHz)
      const contact = extend(contacts, startS, stepS, () => ({
        minRangeM: stationView.rangeM, maxRangeM: stationView.rangeM,
        maxElevationDeg: stationView.elevationRad / rad, maxPathLossDb: lossDb,
      }))
      contact.minRangeM = Math.min(contact.minRangeM, stationView.rangeM)
      contact.maxRangeM = Math.max(contact.maxRangeM, stationView.rangeM)
      contact.maxPathLossDb = Math.max(contact.maxPathLossDb, lossDb)
      contact.maxElevationDeg = Math.max(contact.maxElevationDeg, stationView.elevationRad / rad)
      contactCapacityBits += geometryCapacity
    }

    const view = siteView(fixed, targetUp, env.earthRadiusM)
    let access: Access | undefined
    if (!payload || fovRad === null) missed.payload++
    else if (view.elevationRad <= 0) missed.horizon++
    else if (view.offNadirRad > maxPointingDeg * rad + 1e-12) missed.pointing++
    else {
      const geometry = observationGeometry(view, fovRad, payload.pixelIfovRad, Math.asin(env.earthRadiusM / Math.hypot(...position)))
      if (!geometry || geometry.acrossM < profile.minFootprintAcrossM || geometry.alongM > 2 * target.radiusM) missed.footprint++
      else if (solarElevationRad(targetUp, sunFixed) < objective.minSunElevationDeg * rad) missed.lighting++
      else if (geometry.gsdM > objective.groundSampleLimitM) missed.resolution++
      else {
        const sample = { bestGsdM: geometry.gsdM, rangeM: view.rangeM, offNadirDeg: view.offNadirRad / rad,
          acrossM: geometry.acrossM, alongM: geometry.alongM }
        access = extend(accesses, startS, stepS, () => sample)
        if (geometry.gsdM < access.bestGsdM) Object.assign(access, sample)
      }
    }

    const tryLoad = (loadW: number) => advanceBattery(chargeJ, batteryCapacityJ, generationW, loadW,
      stepS, power.chargeEfficiency, power.dischargeEfficiency)
    let energy = tryLoad(power.housekeepingW)
    let downlink = false
    if (communications && inContact && geometryCapacity > 0 && queue.length) {
      const transmit = tryLoad(power.housekeepingW + communications.activeLoadW)
      if (transmit.unservedJ === 0) {
        downlink = true
        energy = transmit
        let remaining = geometryCapacity
        while (remaining && queue.length) {
          const bits = Math.min(queue[0], remaining)
          queue[0] -= bits
          remaining -= bits
          occupiedBits -= bits
          deliveredBits += bits
          if (!queue[0]) { queue.shift(); delivered++ }
        }
      } else blockedOperations.downlinkPower++
    }
    if (payload && spectralSuitability && access && access !== usedWindow && captured < objective.scenes) {
      if (downlink) blockedOperations.imagingConflict++
      else if (occupiedBits + sceneBits > spacecraft.storageCapacityBits) blockedOperations.imagingStorage++
      else {
        const expose = tryLoad(power.housekeepingW + payload.activeLoadW + (steering?.loadW ?? 0))
        if (expose.unservedJ === 0) {
          energy = expose
          queue.push(sceneBits)
          occupiedBits += sceneBits
          captured++
          usedWindow = access
        } else blockedOperations.imagingPower++
      }
    }
    chargeJ = energy.endJ
    minChargeJ = Math.min(minChargeJ, chargeJ)
    generatedJ += generationW * stepS
    unmetJ += energy.unservedJ
    curtailedJ += energy.curtailedJ
    if ((startS + stepS) % snapshotStride === 0 || startS + stepS === durationS) batteryTrace.push({ elapsedS: startS + stepS, chargeJ })
  }
  return {
    durationS, stepS, accesses, contacts, sunlight, eclipses, missed,
    instrument: { fieldOfViewDeg: fovRad === null ? null : fovRad / rad, maxPointingDeg, sceneBits, spectralSuitability },
    power: { capacityJ: batteryCapacityJ, minChargeJ, endChargeJ: chargeJ, unmetJ, generatedJ, curtailedJ, batteryTrace },
    communications: { rateBps, contactCapacityBits, deliveredBits, delivered, linkBudget: profile.linkBudget, frequencyHz: profile.downlinkFrequencyHz },
    science: { captured, goal: objective.scenes, onboardBits: occupiedBits },
    blockedOperations,
  }
}

export type Forecast = ReturnType<typeof analyzeForecast>
