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

function tileXY(lat: number, lng: number, z: number): { x: number; y: number } {
  const n = 2 ** z
  const rad = Math.max(-85, Math.min(85, lat)) * Math.PI / 180
  return {
    x: Math.floor((lng + 180) / 360 * n),
    y: Math.floor((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * n),
  }
}

export interface GeoBounds { north: number; south: number; east: number; west: number }

/**
 * 지도는 화면과 겹치는 타일을 통째로 불러온다. 반경 원을 덮는 타일이 모두 화면 타일
 * 범위 안에 있으면 그 반경의 POI는 전부 로드된 것이다(화면 경계보다 정확한 판정).
 */
export function radiusWithinLoadedTiles(center: MapPoint, meters: number, view: GeoBounds, tileZoom: number): boolean {
  const z = Math.floor(tileZoom)
  const dLat = meters / 111_320
  const dLng = meters / (111_320 * Math.cos(center.lat * Math.PI / 180))
  const need = [tileXY(center.lat + dLat, center.lng - dLng, z), tileXY(center.lat - dLat, center.lng + dLng, z)]
  const have = [tileXY(view.north, view.west, z), tileXY(view.south, view.east, z)]
  return need[0].x >= have[0].x && need[0].y >= have[0].y && need[1].x <= have[1].x && need[1].y <= have[1].y
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
