export interface MapPoint {
  lat: number
  lng: number
}

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
