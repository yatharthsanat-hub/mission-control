export type Vector = readonly [number, number, number]
export interface Site { readonly latitudeDeg: number; readonly longitudeDeg: number }
const rad = Math.PI / 180
const dot = (a: Vector, b: Vector) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const norm = (a: Vector) => Math.hypot(...a)
const sub = (a: Vector, b: Vector): Vector => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const scale = (a: Vector, k: number): Vector => [a[0] * k, a[1] * k, a[2] * k]
const cross = (a: Vector, b: Vector): Vector => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

export function inertialToFixed(position: Vector, elapsedS: number, siderealDayS: number, angleAtEpochRad: number): Vector {
  if (![...position, elapsedS, siderealDayS, angleAtEpochRad].every(Number.isFinite) || !(siderealDayS > 0)) {
    throw new RangeError('Invalid inertial vector or Earth rotation.')
  }
  const theta = angleAtEpochRad + 2 * Math.PI * (elapsedS % siderealDayS) / siderealDayS
  const [x, y, z] = position
  return [Math.cos(theta) * x + Math.sin(theta) * y, -Math.sin(theta) * x + Math.cos(theta) * y, z]
}

export function siteUnit({ latitudeDeg, longitudeDeg }: Site): Vector {
  if (!Number.isFinite(latitudeDeg) || Math.abs(latitudeDeg) > 90 || !Number.isFinite(longitudeDeg) || Math.abs(longitudeDeg) > 360) {
    throw new RangeError('Latitude must be within ±90° and longitude within ±360°.')
  }
  if (Math.abs(latitudeDeg) === 90) return [0, 0, Math.sign(latitudeDeg)]
  const lat = latitudeDeg * rad
  const lon = (((longitudeDeg + 180) % 360 + 360) % 360 - 180) * rad
  return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)]
}

export function siteView(positionFixedM: Vector, up: Vector, radiusM: number) {
  if (![...positionFixedM, ...up, radiusM].every(Number.isFinite) || !(radiusM > 0) ||
    norm(positionFixedM) <= radiusM || Math.abs(norm(up) - 1) > 1e-12) {
    throw new RangeError('Expected an exterior spacecraft and a unit site normal on a positive-radius sphere.')
  }
  const fromSite = sub(positionFixedM, scale(up, radiusM))
  const rangeM = norm(fromSite)
  const elevationRad = Math.asin(clamp(dot(fromSite, up) / rangeM, -1, 1))
  const offNadirRad = Math.atan2(norm(cross(positionFixedM, fromSite)), dot(positionFixedM, fromSite))
  return { rangeM, elevationRad, offNadirRad }
}

export interface Optics {
  readonly pixelIfovRad: number
  readonly widthPixels: number
  readonly heightPixels: number
}

export function fieldOfViewRad(optics: Optics) {
  if (!Number.isFinite(optics.pixelIfovRad) || !(optics.pixelIfovRad > 0 && optics.pixelIfovRad < .01) ||
    ![optics.widthPixels, optics.heightPixels].every(n => Number.isSafeInteger(n) && n > 0 && n <= 16384)) {
    throw new RangeError('Unsupported imager optics.')
  }
  return 2 * Math.atan(Math.min(optics.widthPixels, optics.heightPixels) / 2 * Math.tan(optics.pixelIfovRad))
}

export function sceneVolumeBits(width: number, height: number, bitsPerPixel: number, bands: number) {
  const inputs = [width, height, bitsPerPixel, bands]
  const total = inputs.reduce((product, input) => product * input, 1)
  if (!inputs.every(input => Number.isSafeInteger(input) && input > 0) || !Number.isSafeInteger(total)) throw new RangeError('Invalid scene encoding.')
  return total
}

export function missingSpectralBands<T extends { readonly rangeM: readonly [number, number] }>(
  required: readonly T[], response: readonly (readonly [number, number])[] = [],
) {
  return required.filter(({ rangeM: [minimum, maximum] }) =>
    !response.some(([lower, upper]) => lower <= minimum && upper >= maximum))
}

export function observationGeometry(view: ReturnType<typeof siteView>, fullFovRad: number, pixelIfovRad: number, nadirLimbRad: number) {
  const halfFovRad = fullFovRad / 2
  if (view.elevationRad <= 0 || view.offNadirRad + halfFovRad >= nadirLimbRad) return null
  const acrossM = 2 * view.rangeM * Math.tan(halfFovRad)
  const incidenceFactor = Math.sin(view.elevationRad)
  return {
    gsdM: view.rangeM * Math.tan(pixelIfovRad) / incidenceFactor,
    acrossM,
    alongM: acrossM / incidenceFactor,
  }
}

export function solarElevationRad(up: Vector, sunDirection: Vector) {
  return Math.asin(clamp(dot(up, sunDirection), -1, 1))
}

export function inEclipse(positionM: Vector, unitSun: Vector, radiusM: number) {
  if (![...positionM, ...unitSun, radiusM].every(Number.isFinite) || !(radiusM > 0) ||
    norm(positionM) <= radiusM || Math.abs(norm(unitSun) - 1) > 1e-12) throw new RangeError('Invalid cylindrical eclipse geometry.')
  return dot(positionM, unitSun) < 0 && norm(cross(positionM, unitSun)) < radiusM
}

export function freeSpaceLossDb(rangeM: number, frequencyHz: number) {
  if (![rangeM, frequencyHz].every(value => Number.isFinite(value) && value > 0)) throw new RangeError('RF range and frequency must be positive.')
  return 20 * (Math.log10(4 * Math.PI / 299_792_458) + Math.log10(rangeM) + Math.log10(frequencyHz))
}

export function advanceBattery(chargeJ: number, capacityJ: number, generationW: number, loadW: number, stepS: number,
  chargeEfficiency = 1, dischargeEfficiency = 1) {
  if (![chargeJ, capacityJ, generationW, loadW, stepS, chargeEfficiency, dischargeEfficiency].every(Number.isFinite) ||
    chargeJ < 0 || chargeJ > capacityJ || generationW < 0 || loadW < 0 || stepS <= 0 ||
    chargeEfficiency <= 0 || chargeEfficiency > 1 || dischargeEfficiency <= 0 || dischargeEfficiency > 1) {
    throw new RangeError('Invalid battery or electrical step inputs.')
  }
  const netJ = (generationW - loadW) * stepS
  const availableJ = chargeJ * dischargeEfficiency
  const endJ = netJ >= 0 ? Math.min(capacityJ, chargeJ + netJ * chargeEfficiency) : Math.max(0, chargeJ + netJ / dischargeEfficiency)
  return {
    endJ,
    unservedJ: Math.max(0, -netJ - availableJ),
    curtailedJ: netJ > 0 ? Math.max(0, netJ - (capacityJ - chargeJ) / chargeEfficiency) : 0,
  }
}
