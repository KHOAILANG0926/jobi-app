import { calcDistanceKm, findRegionCenter } from '../../../lib/jobCoords.ts'
import {
  HOME_MAP_TARGET_DIAMETER_RATIO,
  calculateInitialZoom,
  createRadiusPolygon,
  radiusKmToMeters,
} from './homeMapGeometry.ts'

function assert(condition: boolean, label: string): void {
  if (!condition) throw new Error(label)
}

function assertClose(actual: number, expected: number, tolerance: number, label: string): void {
  assert(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, received ${actual}`)
}

const origin = { lat: 21.1861, lng: 106.0763 }
const radiusCases: ReadonlyArray<readonly [number, number]> = [
  [0.1, 100],
  [0.3, 300],
  [0.5, 500],
  [1, 1000],
  [3, 3000],
  [5, 5000],
  [10, 10000],
]

for (const [km, meters] of radiusCases) {
  assert(radiusKmToMeters(km) === meters, `${km}km converts exactly to meters`)
  const polygon = createRadiusPolygon(origin, km, 4)
  const cardinalPoints = polygon.geometry.coordinates[0].slice(0, 4)
  assert(cardinalPoints.length === 4, `${km}km polygon exposes four cardinal points`)
  for (const [lng, lat] of cardinalPoints) {
    const distanceMeters = calcDistanceKm(origin.lat, origin.lng, lat, lng) * 1000
    assertClose(distanceMeters, meters, 0.05, `${km}km cardinal point keeps its geographic radius`)
  }
}

assert(
  JSON.stringify(findRegionCenter('Bắc Ninh')) === JSON.stringify(origin),
  'Bắc Ninh resolves to the expected search origin',
)
assert(HOME_MAP_TARGET_DIAMETER_RATIO === 0.65, 'initial viewport target is 65% of the smaller map dimension')

const viewportCases = [
  { size: { width: 693, height: 423 }, zoom: 12.7075 },
  { size: { width: 718, height: 438 }, zoom: 12.7578 },
  { size: { width: 718, height: 483 }, zoom: 12.8989 },
] as const

for (const { size, zoom: expectedZoom } of viewportCases) {
  const zoom = calculateInitialZoom(origin.lat, 3, size)
  assertClose(zoom, expectedZoom, 0.02, `${size.width}x${size.height} initial zoom`)
  const metersPerPixel = 156543.03392804097 * Math.cos(origin.lat * Math.PI / 180) / (2 ** zoom)
  const projectedDiameterRatio = (radiusKmToMeters(3) * 2 / metersPerPixel) / Math.min(size.width, size.height)
  assert(projectedDiameterRatio >= 0.64 && projectedDiameterRatio <= 0.66, `${size.width}x${size.height} circle uses about 65%`)
}

for (const [label, radiusKm, size] of [
  ['zero size', 3, { width: 0, height: 0 }],
  ['negative radius', -1, { width: 718, height: 440 }],
  ['NaN radius', Number.NaN, { width: 718, height: 440 }],
] as const) {
  const zoom = calculateInitialZoom(origin.lat, radiusKm, size)
  assert(Number.isFinite(zoom) && zoom >= 3 && zoom <= 18, `${label} returns a finite clamped zoom`)
}

console.log('homeMapGeometry.test.ts: radius and viewport assertions passed')
