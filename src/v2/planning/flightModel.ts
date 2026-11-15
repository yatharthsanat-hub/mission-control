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

export interface ForecastInput {
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


export interface FlightResources {
  readonly chargeJ: number
  readonly occupiedBits: number
  readonly captured: number
  readonly delivered: number
  readonly deliveredBits: number
  readonly pendingBits: readonly number[]
  readonly windowCaptured: boolean
}

export const accessReasons = {
  horizon: 'Target is below the horizon.',
  pointing: 'Target exceeds the spacecraft pointing limit.',
  footprint: 'Footprint or limb clearance fails the requirement.',
  lighting: 'Target illumination is below the requirement.',
  resolution: 'Ground sample distance exceeds the requirement.',
  payload: 'No imager is mounted.',
} as const

type Access = { available: false; reason: keyof typeof accessReasons } | {
  available: true; bestGsdM: number; rangeM: number; offNadirDeg: number; acrossM: number; alongM: number
}

export function createFlightModel(input: ForecastInput, profile: typeof forecastProfile = forecastProfile) {
  const { orbit, environment: env, spacecraft, target, objective } = input
  const { payload, power, communications } = spacecraft
  const { stepS } = profile
  const targetUp = siteUnit(target)
  const stationUp = siteUnit(env.groundStation)
  const steering = spacecraft.parts.find(part => part.part === 'fine')
  const maxPointingDeg = steering ? profile.fineSlewDeg : profile.imagerSlewDeg
  const fovRad = payload ? fieldOfViewRad(payload) : null
  const sceneBits = payload ? sceneVolumeBits(payload.widthPixels, payload.heightPixels, payload.bitsPerPixelPerBand, payload.bandCount) : 0
  const spectralSuitability = missingSpectralBands(objective.bands, payload?.bandsM).length === 0
  const rateBps = communications ? Math.min(communications.maxBitRateBps, env.groundStation.maxBitRateBps) : 0
  const geometryCapacity = rateBps * stepS
  const batteryCapacityJ = power.batteryCapacityJ

  const at = (elapsedS: number) => {
    const state = propagate(orbit.elements, seconds(elapsedS))
    const fixed = inertialToFixed(state.positionM, elapsedS, env.siderealDayS, env.primeMeridianAngleAtEpochRad)
    return { ...state, fixed, altitudeM: state.radiusM - env.earthRadiusM }
  }

  function targetAccess(fixed: ReturnType<typeof at>['fixed'], elapsedS: number, radiusM: number): Access {
    if (!payload || fovRad === null) return { available: false, reason: 'payload' }
    const view = siteView(fixed, targetUp, env.earthRadiusM)
    if (view.elevationRad <= 0) return { available: false, reason: 'horizon' }
    if (view.offNadirRad > maxPointingDeg * rad + 1e-12) return { available: false, reason: 'pointing' }
    const geometry = observationGeometry(view, fovRad, payload.pixelIfovRad, Math.asin(env.earthRadiusM / radiusM))
    if (!geometry || geometry.acrossM < profile.minFootprintAcrossM || geometry.alongM > 2 * target.radiusM) {
      return { available: false, reason: 'footprint' }
    }
    const sunFixed = inertialToFixed(env.sunDirectionInertial, elapsedS, env.siderealDayS, env.primeMeridianAngleAtEpochRad)
    if (solarElevationRad(targetUp, sunFixed) < objective.minSunElevationDeg * rad) return { available: false, reason: 'lighting' }
    if (geometry.gsdM > objective.groundSampleLimitM) return { available: false, reason: 'resolution' }
    return { available: true, bestGsdM: geometry.gsdM, rangeM: view.rangeM, offNadirDeg: view.offNadirRad / rad,
      acrossM: geometry.acrossM, alongM: geometry.alongM }
  }

  function sample(startS: number) {
    const elapsedS = startS + stepS / 2
    const orbitState = at(elapsedS)
    const eclipse = inEclipse(orbitState.positionM, env.sunDirectionInertial, env.earthRadiusM)
    const generationW = eclipse ? 0 : power.nominalGenerationW * profile.solarOutputFraction
    const stationView = siteView(orbitState.fixed, stationUp, env.earthRadiusM)
    const inContact = stationView.elevationRad + 1e-12 >= env.groundStation.minElevationDeg * rad
    return { orbit: orbitState, eclipse, generationW, access: targetAccess(orbitState.fixed, elapsedS, Math.hypot(...orbitState.positionM)),
      station: { inContact, rangeM: stationView.rangeM, elevationDeg: stationView.elevationRad / rad,
        pathLossDb: inContact ? freeSpaceLossDb(stationView.rangeM, profile.downlinkFrequencyHz) : null } }
  }

  function initial(): FlightResources {
    return { chargeJ: batteryCapacityJ * env.initialBatteryFraction, occupiedBits: env.initialStorageBits,
      captured: 0, delivered: 0, deliveredBits: 0, pendingBits: [], windowCaptured: false }
  }

  function advance(previous: FlightResources, frame: ReturnType<typeof sample>, requests: { observe: boolean; downlink: boolean }) {
    const { chargeJ } = previous
    let { captured, delivered, deliveredBits, occupiedBits, pendingBits } = previous
    let windowCaptured = frame.access.available && previous.windowCaptured
    let captureReject = ''
    let downlinkReject = ''
    let activity: 'housekeeping' | 'imaging' | 'downlink' = 'housekeeping'
    const tryLoad = (loadW: number) => ({
      ...advanceBattery(chargeJ, batteryCapacityJ, frame.generationW, loadW, stepS, power.chargeEfficiency, power.dischargeEfficiency),
      loadW,
    })
    let energy = tryLoad(power.housekeepingW)
    let sentBits = 0
    if (requests.downlink) {
      if (!communications || geometryCapacity <= 0) downlinkReject = 'No supported radio.'
      else if (!frame.station.inContact) downlinkReject = 'Station is outside the contact elevation mask.'
      else if (!pendingBits.length) downlinkReject = 'No science data is onboard.'
      else {
        const transmit = tryLoad(power.housekeepingW + communications.activeLoadW)
        if (transmit.unservedJ > 0) downlinkReject = 'Insufficient power for the radio.'
        else {
          activity = 'downlink'
          energy = transmit
          const remainingScenes = [...pendingBits]
          let remaining = geometryCapacity
          while (remaining > 0 && remainingScenes.length) {
            const bits = Math.min(remainingScenes[0], remaining)
            remainingScenes[0] -= bits
            remaining -= bits
            occupiedBits -= bits
            sentBits += bits
            if (remainingScenes[0] === 0) { remainingScenes.shift(); delivered++ }
          }
          pendingBits = remainingScenes
          deliveredBits += sentBits
        }
      }
    }
    if (requests.observe) {
      if (!payload || !spectralSuitability) captureReject = 'No spectrally suitable imager is mounted.'
      else if (!frame.access.available) captureReject = accessReasons[frame.access.reason]
      else if (windowCaptured) captureReject = 'This access window already has a scene.'
      else if (captured >= objective.scenes) captureReject = 'The acquisition quota is filled.'
      else if (activity === 'downlink') captureReject = 'Radio transmission has priority in this interval.'
      else if (occupiedBits + sceneBits > spacecraft.storageCapacityBits) captureReject = 'Insufficient onboard storage.'
      else {
        const expose = tryLoad(power.housekeepingW + payload.activeLoadW + (steering?.loadW ?? 0))
        if (expose.unservedJ > 0) captureReject = 'Insufficient power for the imager.'
        else {
          energy = expose
          activity = 'imaging'
          pendingBits = [...pendingBits, sceneBits]
          occupiedBits += sceneBits
          captured++
          windowCaptured = true
        }
      }
    }
    const resources: FlightResources = { chargeJ: energy.endJ, captured, delivered, deliveredBits, occupiedBits, pendingBits, windowCaptured }
    return { resources, energy, activity, sentBits, captureReject, downlinkReject }
  }

  return { at, sample, initial, advance, geometryCapacity, rateBps, batteryCapacityJ,
    instrument: { fieldOfViewDeg: fovRad === null ? null : fovRad / rad, maxPointingDeg, sceneBits, spectralSuitability } }
}
