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

/** 핀 전체가 보이도록 카메라를 맞춘다(웹 HomeMapExplorer와 같은 계산). 핀이 없으면 하노이 기본 화면(카메라일 뿐 공고 위치가 아님). */
export function fitViewport(markers: readonly MapPoint[]): HomeMapViewport {
  const pts = markers.filter(validPoint)
  if (pts.length === 0) return DEFAULT_VIEWPORT
  const lats = pts.map((m) => m.lat), lngs = pts.map((m) => m.lng)
  const span = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs), 0.01)
  const zoom = Math.max(7, Math.min(13, Math.floor(Math.log2(360 / span)) - 2))
  return { center: { lat: (Math.max(...lats) + Math.min(...lats)) / 2, lng: (Math.max(...lngs) + Math.min(...lngs)) / 2 }, zoom }
}

export { calcDistanceKm }
