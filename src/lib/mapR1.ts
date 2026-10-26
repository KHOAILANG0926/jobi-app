import type { Job } from '../types/job'
import { matchesFilters, type HomeMapFilterState, type MapJobPoint } from './homeMapFilters'
import { calcDistanceKm, resolveMapLocations } from './jobCoords'
import type { HomeMapViewport } from '../components/home/map/HomeMapTypes'

export const VIEWPORT_KEY = 'vgb:map-r1:viewport'
// Camera only: Hanoi city centre, never a workplace or a distance origin.
export const DEFAULT_VIEWPORT: HomeMapViewport = { center: { lat: 21.0285, lng: 105.8542 }, zoom: 8 }
export type LocationKind = 'exact' | 'gate' | 'area'
export interface LocatedPoint extends MapJobPoint { jobId?: string; workLocationId?: number; precision?: string; revision?: number; kind: LocationKind; source?: string; checkedAt?: string }
export type RepresentativePoints = Record<string, LocatedPoint>
export interface MapBounds { west: number; east: number; south: number; north: number }
export const LOCATION_LABELS: Record<LocationKind, string> = {
  exact: 'Vị trí làm việc đã xác minh', gate: 'Vị trí đại diện (cổng KCN)', area: 'Vị trí đại diện (khu vực)',
}
export function validPoint(p: MapJobPoint): boolean {
  return Number.isFinite(p?.lat) && Number.isFinite(p?.lng) && p.lat >= 8 && p.lat <= 24 && p.lng >= 102 && p.lng <= 110
}
export function readViewport(raw: string | null): HomeMapViewport | null {
  try {
    const v = JSON.parse(raw ?? 'null')
    return v && validPoint(v.center) && typeof v.zoom === 'number' && Number.isFinite(v.zoom) && v.zoom >= 3 && v.zoom <= 18
      ? { center: { lat: v.center.lat, lng: v.center.lng }, zoom: v.zoom } : null
  } catch { return null }
}
export function locationPoints(job: Job, _representatives: RepresentativePoints = {}): LocatedPoint[] {
  return resolveMapLocations(job).points.map(p => ({ ...p, jobId: job.id,
    kind: p.kind === 'exact' && !p.precise ? 'area' : p.kind ?? 'area', source: p.source, checkedAt: p.checkedAt }))
}
/** Describe mixed source sets without applying one workplace's accuracy to another. */
export function mapPointAccuracyNote(points: { lat: number; lng: number; kind?: LocationKind; precise: boolean }[]): string {
  const valid = points.filter(validPoint)
  const verified = valid.filter(p => p.kind === 'exact' && p.precise).length
  const reference = valid.length - verified
  if (verified && reference) return `Bản đồ có ${verified} địa điểm làm việc đã xác minh và ${reference} vị trí tham khảo — chưa xác minh địa điểm làm việc chính xác tại các điểm tham khảo.`
  if (verified > 1) return `Công việc này có ${verified} địa điểm làm việc đã xác minh.`
  if (verified === 1) return 'Vị trí nơi làm việc đã được xác minh trên bản đồ.'
  return 'Vị trí tham khảo — chưa xác minh địa điểm làm việc chính xác.'
}
export function withinBounds(p: MapJobPoint, b: MapBounds): boolean {
  return p.lat >= b.south && p.lat <= b.north && (b.west <= b.east ? p.lng >= b.west && p.lng <= b.east : p.lng >= b.west || p.lng <= b.east)
}
export interface MapEntry { job: Job; point: LocatedPoint | null; distanceKm: number | null; points: LocatedPoint[] }
export function mapSearch(jobs: Job[], filters: HomeMapFilterState, origin: MapJobPoint | null, radiusKm: number | null, bounds: MapBounds | null, representatives: RepresentativePoints) {
  const entries: MapEntry[] = []
  for (const job of new Map(jobs.map(j => [j.id, j])).values()) {
    if (!matchesFilters(job, filters)) continue
    const points = locationPoints(job, representatives)
    const ordered = origin ? [...points].sort((a, b) => calcDistanceKm(origin.lat, origin.lng, a.lat, a.lng) - calcDistanceKm(origin.lat, origin.lng, b.lat, b.lng)) : points
    const point = ordered[0] ?? null
    entries.push({ job, points, point, distanceKm: origin && point ? calcDistanceKm(origin.lat, origin.lng, point.lat, point.lng) : null })
  }
  // Representative coordinates narrow the nearby search too; their precision label stays unchanged.
  const inRadius = (p: LocatedPoint) => !origin || radiusKm === null || calcDistanceKm(origin.lat, origin.lng, p.lat, p.lng) <= radiusKm
  const radiusJobs = origin && radiusKm !== null ? entries.filter(e => e.points.some(inRadius)) : []
  // 대략 위치 핀(공단·동 중심)은 반경 밖이어도 지도에서 지우지 않는다(Lee 10-13 '메인 지도에 핀은 무조건', 2026-10-21 #190 후 핀 사라짐 재발 방지).
  // 반경은 목록·건수만 좁힌다. 정확한 근무지 핀만 반경 밖이면 숨긴다(기존 규칙).
  const markers = entries.flatMap(e => e.points.filter(p => p.kind !== 'exact' || inRadius(p)).map(p => ({ ...p, id: e.job.id, label: `${e.job.title} · ${e.job.company} · ${LOCATION_LABELS[p.kind]}` })))
  // 목록·건수는 지도 화면 안 + (반경을 쓰면) 반경 안 핀만. 지도에는 대략 위치 핀이 남아 있어도 목록은 반경을 따른다.
  const visibleIds = new Set(markers.filter(p => bounds && withinBounds(p, bounds) && inRadius(p)).map(p => p.id))
  const visibleEntries = entries.filter(e => visibleIds.has(e.job.id))
  return { entries, radiusJobs, markers, visibleEntries, visibleIds, visibleCount: visibleIds.size, unresolvedCount: entries.filter(e => !e.point).length }
}

/** Keep the clicked workplace; list selections default to nearest workplace. */
export function selectedMapEntry(entry: MapEntry | null, clicked: MapJobPoint | null, origin: MapJobPoint | null): MapEntry | null {
  if (!entry || !clicked) return entry
  const point = entry.points.find(p => p.lat === clicked.lat && p.lng === clicked.lng)
  return point ? {...entry, point, distanceKm: origin ? calcDistanceKm(origin.lat, origin.lng, point.lat, point.lng) : null} : entry
}

/** Summary shares the map's viewport/radius result, counting each posting once. */
export function summarizeMapEntries(entries: MapEntry[]) {
  const jobs = [...new Map(entries.map(e => [e.job.id, e.job])).values()]
  const counts = new Map<Job['category'], number>()
  for (const job of jobs) counts.set(job.category, (counts.get(job.category) ?? 0) + 1)
  return {
    total: jobs.length,
    urgent: jobs.filter(job => job.urgent === true).length,
    categories: [...counts].map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category)),
  }
}
