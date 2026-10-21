// 내 위치를 켰을 때 지도가 내 위치만 크게 보여 주변 공고 핀이 화면 밖으로 사라지던 문제(2026-10-21 Lee "메인 화면에 핀이 없어").
// 내 위치 + 가까운 공고 핀(최대 5곳)이 함께 보이도록 지도 가운데·확대를 정한다. 핀이 없으면 내 위치만.
import { calcDistanceKm } from './jobCoords'

export interface LatLng { lat: number; lng: number }

export function fitWithNearest(origin: LatLng, pins: LatLng[], nearest = 5): { center: LatLng; zoom: number } {
  const near = [...pins].sort((a, b) => calcDistanceKm(origin.lat, origin.lng, a.lat, a.lng) - calcDistanceKm(origin.lat, origin.lng, b.lat, b.lng)).slice(0, nearest)
  const all = [origin, ...near]
  const lats = all.map((p) => p.lat), lngs = all.map((p) => p.lng)
  const span = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs))
  if (span < 0.005) return { center: origin, zoom: 13 }
  const zoom = Math.max(7, Math.min(13, Math.floor(Math.log2(360 / span)) - 2))
  return { center: { lat: (Math.max(...lats) + Math.min(...lats)) / 2, lng: (Math.max(...lngs) + Math.min(...lngs)) / 2 }, zoom }
}
