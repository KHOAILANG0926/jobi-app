import type { MapPoint } from './HomeMapTypes'

type GoogleMapOptionConstants = Pick<
  google.maps.MapsLibrary,
  'MapTypeControlStyle' | 'MapTypeId' | 'RenderingType'
>

export function createGoogleMapOptions(
  maps: GoogleMapOptionConstants,
  center: MapPoint,
  zoom: number,
): google.maps.MapOptions {
  return {
    center,
    zoom,
    renderingType: maps.RenderingType.VECTOR,
    mapTypeId: maps.MapTypeId.ROADMAP,
    isFractionalZoomEnabled: true,
    zoomControl: true,
    streetViewControl: false,
    fullscreenControl: false,
    mapTypeControl: true,
    mapTypeControlOptions: {
      style: maps.MapTypeControlStyle.HORIZONTAL_BAR,
      mapTypeIds: [maps.MapTypeId.ROADMAP, maps.MapTypeId.HYBRID],
    },
  }
}
