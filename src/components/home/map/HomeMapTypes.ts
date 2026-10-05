import type { NearbySummary } from '../../../lib/nearbyFacilities'
import type { PickedPlace } from '../../../lib/mapPlace'

export type HomeMapMode = 'street' | 'satellite'

export interface MapPoint {
  lat: number
  lng: number
}

/** 선택 공고 주변 생활시설 상태. 데이터는 지도 provider가 실제 로드한 POI만 쓴다. */
export type NearbyState =
  | { status: 'idle' }
  | { status: 'loading'; jobId: string }
  | { status: 'ready'; jobId: string; summary: NearbySummary; partialRadiusM: number | null }
  | { status: 'unavailable'; jobId: string | null }

export interface HomeMapMarker extends MapPoint {
  id: string
  label: string
}

export interface HomeMapViewport {
  center: MapPoint
  zoom: number
}

export type HomeMapFailureReason =
  | 'loader-error'
  | 'initialization-error'
  | 'auth-failure'
  | 'timeout'
  | 'render-error'

export interface HomeMapProviderProps {
  origin: MapPoint
  originIsUser: boolean
  radiusKm: number
  recenterRequest: number
  markers: HomeMapMarker[]
  selectedId: string | null
  initialViewport?: HomeMapViewport
  onSelect: (id: string) => void
  onViewportChange: (viewport: HomeMapViewport) => void
  onReady: () => void
  onFailure: (reason: HomeMapFailureReason) => void
  /** 주변 생활시설 요약을 지원하는 provider(VietMap)만 호출한다. */
  onNearbyChange?: (state: NearbyState) => void
  /** Bản đồ / Vệ tinh. 지정하지 않으면 provider 내부 상태를 쓴다. */
  mapMode?: HomeMapMode
  onMapModeChange?: (mode: HomeMapMode) => void
  /** 지도에서 클릭해 고른 건물/시설(강조 표시용). */
  pickedPlace?: PickedPlace | null
  /** 건물/시설 클릭(빈 곳 클릭 시 null). 건물 클릭을 지원하는 provider(VietMap)만 호출. */
  onPlacePick?: (place: PickedPlace | null) => void
  /** 값이 바뀌면 선택한 건물/시설로 z16 이동(사용자 요청 시에만). */
  placeZoomRequest?: number
}

export interface MapViewportSize {
  width: number
  height: number
}

export interface RadiusPolygonFeature {
  type: 'Feature'
  geometry: {
    type: 'Polygon'
    coordinates: [Array<[number, number]>]
  }
  properties: Record<string, never>
}
