import type { MapPoint } from './HomeMapTypes'

export interface TomTomPlace {
  id: string
  name: string
  position: MapPoint
  category?: string
}

export interface TomTomPlacesSearchRequest {
  center: MapPoint
  radiusMeters: number
  query?: string
}

/** Boundary for a later Places integration. This phase intentionally provides no network implementation. */
export interface TomTomPlacesClient {
  searchNearby: (request: TomTomPlacesSearchRequest) => Promise<TomTomPlace[]>
}
