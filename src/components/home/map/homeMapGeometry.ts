import type { MapPoint, MapViewportSize, RadiusPolygonFeature } from './HomeMapTypes'

const EARTH_RADIUS_KM = 6371.0088
const WEB_MERCATOR_BASE_RESOLUTION = 156543.03392804097
const MIN_ZOOM = 3
const MAX_ZOOM = 18
const SAFE_VIEWPORT: MapViewportSize = { width: 718, height: 440 }

export const HOME_MAP_TARGET_DIAMETER_RATIO = 0.65

export function radiusKmToMeters(radiusKm: number): number {
  return radiusKm * 1000
}

export function createRadiusPolygon(origin: MapPoint, radiusKm: number, segments = 96): RadiusPolygonFeature {
  const safeSegments = Math.max(4, Math.floor(segments))
  const originLat = origin.lat * Math.PI / 180
  const originLng = origin.lng * Math.PI / 180
  const angularDistance = radiusKm / EARTH_RADIUS_KM
  const coordinates: Array<[number, number]> = []

  for (let index = 0; index <= safeSegments; index += 1) {
    const bearing = index * Math.PI * 2 / safeSegments
    const pointLat = Math.asin(
      Math.sin(originLat) * Math.cos(angularDistance)
      + Math.cos(originLat) * Math.sin(angularDistance) * Math.cos(bearing),
    )
    const pointLng = originLng + Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(originLat),
      Math.cos(angularDistance) - Math.sin(originLat) * Math.sin(pointLat),
    )
    coordinates.push([pointLng * 180 / Math.PI, pointLat * 180 / Math.PI])
  }

  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [coordinates] },
    properties: {},
  }
}

export function calculateInitialZoom(
  originLat: number,
  radiusKm: number,
  viewport: MapViewportSize,
  targetDiameterRatio = HOME_MAP_TARGET_DIAMETER_RATIO,
): number {
  const width = Number.isFinite(viewport.width) && viewport.width > 0 ? viewport.width : SAFE_VIEWPORT.width
  const height = Number.isFinite(viewport.height) && viewport.height > 0 ? viewport.height : SAFE_VIEWPORT.height
  const safeRadiusKm = Number.isFinite(radiusKm) && radiusKm > 0 ? radiusKm : 1
  const safeRatio = Number.isFinite(targetDiameterRatio) && targetDiameterRatio > 0
    ? targetDiameterRatio
    : HOME_MAP_TARGET_DIAMETER_RATIO
  const latitude = Number.isFinite(originLat) ? Math.max(-85, Math.min(85, originLat)) : 0
  const targetDiameterPx = Math.min(width, height) * safeRatio
  const metersPerPixel = radiusKmToMeters(safeRadiusKm) * 2 / targetDiameterPx
  const zoom = Math.log2(
    WEB_MERCATOR_BASE_RESOLUTION * Math.cos(latitude * Math.PI / 180) / metersPerPixel,
  )
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))
}
