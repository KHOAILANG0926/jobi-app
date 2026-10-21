import type { Job } from '../types/job'
import { matchesFilters, verifiedJobPoints, type HomeMapFilterState, type MapJobPoint } from './homeMapFilters'
import { calcDistanceKm } from './jobCoords'
import { findIndustrialPark } from './industrialPark'
import type { HomeMapViewport } from '../components/home/map/HomeMapTypes'

export const VIEWPORT_KEY = 'vgb:map-r1:viewport'
// Camera only: Hanoi city centre, never a workplace or a distance origin.
export const DEFAULT_VIEWPORT: HomeMapViewport = { center: { lat: 21.0285, lng: 105.8542 }, zoom: 8 }
export type LocationKind = 'exact' | 'gate' | 'area'
export interface LocatedPoint extends MapJobPoint { kind: LocationKind; source?: string; checkedAt?: string }
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
export function locationPoints(job: Job, representatives: RepresentativePoints): LocatedPoint[] {
  const exact = verifiedJobPoints(job).filter(validPoint)
  if (exact.length) return exact.map(p => ({ ...p, kind: 'exact' }))
  const addresses = (job.workLocations ?? []).map(l => l.rawAddress)
  const park = findIndustrialPark(...addresses, job.location)
  const gate = park?.destination
  if (gate?.kind === 'gate' && gate.source.ref && gate.satelliteChecked && validPoint(gate)) {
    return [{ lat: gate.lat, lng: gate.lng, kind: 'gate', source: `${gate.source.provider} ${gate.source.ref}`, checkedAt: gate.satelliteChecked }]
  }
  const r = representatives[job.id]
  return r && ['gate', 'area'].includes(r.kind) && r.source && r.checkedAt && validPoint(r) ? [r] : []
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
  const markers = entries.flatMap(e => e.points.filter(inRadius).map(p => ({ ...p, id: e.job.id, label: `${e.job.title} · ${e.job.company} · ${LOCATION_LABELS[p.kind]}` })))
  const visibleIds = new Set(markers.filter(p => bounds && withinBounds(p, bounds)).map(p => p.id))
  const visibleEntries = entries.filter(e => visibleIds.has(e.job.id))
  return { entries, radiusJobs, markers, visibleEntries, visibleIds, visibleCount: visibleIds.size, unresolvedCount: entries.filter(e => !e.point).length }
}

/** Keep the clicked workplace; list selections default to nearest workplace. */
export function selectedMapEntry(entry: MapEntry | null, clicked: MapJobPoint | null, origin: MapJobPoint | null): MapEntry | null {
  if (!entry || !clicked) return entry
  const point = entry.points.find(p => p.lat === clicked.lat && p.lng === clicked.lng)
  return point ? {...entry, point, distanceKm: origin ? calcDistanceKm(origin.lat, origin.lng, point.lat, point.lng) : null} : entry
}
