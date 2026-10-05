// 공고 핀 화면 표시 계획 (2026-10-05). 공고가 수천 건이 되어도 DOM 마커 수를 화면 안
// 소수로 제한한다: ① 같은 좌표 공고는 하나의 공동 핀(groupHomeMapMarkers), ② 화면 밖
// 핀은 그리지 않음(viewport filtering), ③ 낮은 zoom에서는 화면 격자 단위로 묶음(cluster).
// 선택된 공고는 항상 단독 핀으로 남겨 상세 패널과 지도가 어긋나지 않게 한다.
import type { HomeMapMarker } from './HomeMapTypes'
import { groupHomeMapMarkers } from './groupHomeMapMarkers'

export interface ScreenPoint { x: number; y: number }

export type MarkerPlanItem =
  | { kind: 'group'; key: string; markers: HomeMapMarker[] }
  | { kind: 'cluster'; key: string; count: number; lat: number; lng: number; markers: HomeMapMarker[] }

export interface MarkerPlanOptions {
  project: (lat: number, lng: number) => ScreenPoint
  viewport: { width: number; height: number }
  zoom: number
  selectedId: string | null
  /** 이 zoom 이상이면 묶지 않는다(근무지 단위로 판단해야 하는 거리). */
  clusterMaxZoom?: number
  cellPx?: number
  /** 화면 밖 여유(px). 이동 중 핀이 늦게 나타나는 것을 줄인다. */
  paddingPx?: number
}

export function groupKey(group: HomeMapMarker[]): string {
  return `g:${group[0].lat},${group[0].lng}`
}

export function planHomeMapMarkers(markers: HomeMapMarker[], options: MarkerPlanOptions): MarkerPlanItem[] {
  const { project, viewport, zoom, selectedId, clusterMaxZoom = 14, cellPx = 56, paddingPx = 80 } = options
  const groups = groupHomeMapMarkers(markers)
  const out: MarkerPlanItem[] = []
  const cells = new Map<string, { markers: HomeMapMarker[]; groups: HomeMapMarker[][] }>()
  for (const group of groups) {
    const p = project(group[0].lat, group[0].lng)
    const inView = p.x >= -paddingPx && p.y >= -paddingPx && p.x <= viewport.width + paddingPx && p.y <= viewport.height + paddingPx
    const hasSelected = selectedId !== null && group.some((m) => m.id === selectedId)
    if (!inView && !hasSelected) continue
    if (hasSelected || zoom >= clusterMaxZoom) { out.push({ kind: 'group', key: groupKey(group), markers: group }); continue }
    const cellKey = `${Math.floor(p.x / cellPx)}:${Math.floor(p.y / cellPx)}`
    const cell = cells.get(cellKey) ?? { markers: [], groups: [] }
    cell.markers.push(...group)
    cell.groups.push(group)
    cells.set(cellKey, cell)
  }
  for (const cell of cells.values()) {
    if (cell.groups.length === 1) { out.push({ kind: 'group', key: groupKey(cell.groups[0]), markers: cell.groups[0] }); continue }
    const lat = cell.markers.reduce((s, m) => s + m.lat, 0) / cell.markers.length
    const lng = cell.markers.reduce((s, m) => s + m.lng, 0) / cell.markers.length
    const ids = cell.markers.map((m) => m.id).sort()
    out.push({ kind: 'cluster', key: `c:${ids[0]}:${ids.length}`, count: cell.markers.length, lat, lng, markers: cell.markers })
  }
  return out
}
