import type { Site, Vector } from '../planning/geometry.ts'

export const mapWidth = 360
export const mapHeight = 216
export const blueMarbleSource = 'https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/'

export const regionalBasemaps = {
  west: { file: 'blue-marble-west-us.jpg', west: -140, east: -100, north: 52, south: 28 },
  gulf: { file: 'blue-marble-gulf.jpg', west: -110, east: -70, north: 41, south: 17 },
} as const

interface MapBounds {
  readonly west: number; readonly east: number; readonly north: number; readonly south: number
}

const degrees = 180 / Math.PI
export function fixedCoordinates([x, y, z]: Vector): Site {
  return { longitudeDeg: Math.atan2(y, x) * degrees, latitudeDeg: Math.atan2(z, Math.hypot(x, y)) * degrees }
}

export function chartPoint({ longitudeDeg, latitudeDeg }: Site, bounds: MapBounds) {
  return [
    (longitudeDeg - bounds.west) * mapWidth / (bounds.east - bounds.west),
    (bounds.north - latitudeDeg) * mapHeight / (bounds.north - bounds.south),
  ] as const
}

// The built-in sphere UV seam is at scene -X. A north-up raster starts
// there at 180° W and runs eastward. The fixed +Z pole is scene +Y.
export function fixedToScene([x, y, z]: Vector): [number, number, number] {
  return [x, z, -y]
}
