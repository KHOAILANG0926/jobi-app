import { useMemo } from 'react'
import type { HomeMapMarker, HomeMapViewport, MapPoint } from '../../components/home/map/HomeMapTypes'
import { calcDistanceKm } from '../../lib/jobCoords'
import { DEFAULT_VIEWPORT, mapSearch, validPoint, type MapBounds } from '../../lib/mapR1'
import type { Job } from '../../types/job'
import { applyAppFilters, toMapFilters, type AppFilterState, type AppJobAreas } from '../filters/applyFilters'

/** 지도 핀·목록 데이터 — 웹 지도(HomeMapExplorer)가 쓰는 lib/mapR1.mapSearch를 그대로 쓴다. 핀은 확정 좌표(근무지 원본)만, 위치를 모르는 공고는 핀을 만들지 않는다. */
export interface MapData { markers: HomeMapMarker[]; entries: ReturnType<typeof mapSearch>['entries']; visibleEntries: ReturnType<typeof mapSearch>['visibleEntries']; visibleCount: number; unresolvedCount: number }

export function useMapData(jobs: Job[], areas: AppJobAreas, filters: AppFilterState, origin: MapPoint | null, radiusActive: boolean, bounds: MapBounds | null): MapData {
  return useMemo(() => {
    const scoped = applyAppFilters(jobs, filters, areas)
    const r = mapSearch(scoped, toMapFilters(filters), origin, radiusActive ? filters.radiusKm : null, bounds, {})
    return { markers: r.markers as HomeMapMarker[], entries: r.entries, visibleEntries: r.visibleEntries, visibleCount: r.visibleCount, unresolvedCount: r.unresolvedCount }
  }, [jobs, areas, filters, origin, radiusActive, bounds])
}

/** 핀이 가장 많이 모인 곳이 보이도록 카메라를 맞춘다. 전국에 흩어진 공고 핀 전체를 한 화면에 맞추면(웹 HomeMapExplorer 방식) 평균 위치가
 *  빈 땅 한가운데로 떨어지고 확대가 너무 낮아 핀이 하나도 안 보인다 — 운영 화면에서 확인한 문제(2026-11-25, 핀이 라오스 쪽 중앙에 놓임).
 *  그래서 1° 격자 칸 중 핀이 가장 많은 칸을 찾아 그 칸과 이웃 칸의 핀에만 맞춘다. 카메라일 뿐 공고 위치가 아니며, 핀이 없으면 하노이 기본 화면. */
export function fitViewport(markers: readonly MapPoint[]): HomeMapViewport {
  const pts = markers.filter(validPoint)
  if (pts.length === 0) return DEFAULT_VIEWPORT
  const cell = (m: MapPoint) => `${Math.round(m.lat)}|${Math.round(m.lng)}`
  const counts = new Map<string, number>()
  for (const m of pts) counts.set(cell(m), (counts.get(cell(m)) ?? 0) + 1)
  const [bestKey] = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]
  const [bLat, bLng] = bestKey.split('|').map(Number)
  const near = pts.filter((m) => Math.abs(m.lat - bLat) <= 1.5 && Math.abs(m.lng - bLng) <= 1.5)
  const lats = near.map((m) => m.lat), lngs = near.map((m) => m.lng)
  const span = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs), 0.01)
  const zoom = Math.max(7, Math.min(13, Math.floor(Math.log2(360 / span)) - 2))
  return { center: { lat: (Math.max(...lats) + Math.min(...lats)) / 2, lng: (Math.max(...lngs) + Math.min(...lngs)) / 2 }, zoom }
}

export { calcDistanceKm }
