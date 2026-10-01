// 메인 지도만 Geoapify 벡터 스타일로 렌더링한다. 상위 컴포넌트가 lazy import하여 SSR에서 실행되지 않는다.
import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, Map as MapLibreMap, Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { useEffect, useRef, useState } from 'react'

export interface HomeMapMarker {
  id: string
  lat: number
  lng: number
  label: string
}

interface Props {
  origin: { lat: number; lng: number }
  originIsUser: boolean
  radiusKm: number
  recenterRequest: number
  markers: HomeMapMarker[]
  selectedId: string | null
  onSelect: (id: string) => void
}

const CIRCLE_SOURCE = 'home-search-radius'
maplibregl.setWorkerUrl(mapWorkerUrl)

function zoomForRadius(km: number): number {
  if (km <= 2) return 14
  if (km <= 4) return 13
  if (km <= 9) return 12
  if (km <= 16) return 11
  return 10
}

function radiusGeoJSON(origin: Props['origin'], radiusKm: number) {
  const lat = origin.lat * Math.PI / 180
  const lng = origin.lng * Math.PI / 180
  const angular = radiusKm / 6371.0088
  const coordinates: [number, number][] = []
  for (let i = 0; i <= 96; i++) {
    const bearing = i * Math.PI * 2 / 96
    const pointLat = Math.asin(Math.sin(lat) * Math.cos(angular) + Math.cos(lat) * Math.sin(angular) * Math.cos(bearing))
    const pointLng = lng + Math.atan2(Math.sin(bearing) * Math.sin(angular) * Math.cos(lat), Math.cos(angular) - Math.sin(lat) * Math.sin(pointLat))
    coordinates.push([pointLng * 180 / Math.PI, pointLat * 180 / Math.PI])
  }
  return { type: 'Feature' as const, geometry: { type: 'Polygon' as const, coordinates: [coordinates] }, properties: {} }
}

function tuneStyle(map: MapLibreMap) {
  const paint = (id: string, property: Parameters<MapLibreMap['setPaintProperty']>[1], value: string | number) => {
    if (map.getLayer(id)) map.setPaintProperty(id, property, value)
  }
  const hide = (id: string) => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none') }
  paint('landuse-industrial', 'fill-color', '#e5e9ed')
  paint('landuse-industrial', 'fill-opacity', 0.75)
  paint('water', 'fill-color', '#cfe8f7')
  paint('park', 'fill-color', '#e4f2df')
  paint('building', 'fill-color', '#e9ecef')
  paint('building-top', 'fill-color', '#e9ecef')
  paint('highway-primary', 'line-color', '#fff0bd')
  paint('highway-trunk', 'line-color', '#ffe5a6')
  paint('highway-motorway', 'line-color', '#ffdda0')
  paint('highway-secondary-tertiary', 'line-color', '#ffffff')
  paint('highway-minor', 'line-color', '#ffffff')
  paint('boundary-land-level-4', 'line-opacity', 0.25)
  paint('boundary-land-level-2', 'line-opacity', 0.35)
  for (const id of ['place-village', 'place-town', 'place-city', 'place-city-capital']) {
    paint(id, 'text-color', '#334155')
    paint(id, 'text-halo-color', '#ffffff')
    paint(id, 'text-halo-width', 1.5)
  }
  paint('highway-name-major', 'text-color', '#475569')
  paint('highway-name-minor', 'text-color', '#7c8998')
  hide('poi-level-2')
  hide('poi-level-3')
}

export default function HomeMapCanvas(props: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const readyRef = useRef(false)
  const originMarkerRef = useRef<Marker | null>(null)
  const jobMarkersRef = useRef<Marker[]>([])
  const propsRef = useRef(props)
  const userInteractedRef = useRef(false)
  const lastViewportRef = useRef({ origin: props.origin, recenterRequest: props.recenterRequest })
  const [tileError, setTileError] = useState(false)
  propsRef.current = props

  const updateMarkers = () => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    jobMarkersRef.current.forEach((marker) => marker.remove())
    jobMarkersRef.current = propsRef.current.markers.map((job) => {
      const selected = job.id === propsRef.current.selectedId
      const element = document.createElement('div')
      element.className = 'hme-map__job-marker'
      element.style.width = selected ? '30px' : '24px'
      element.style.height = selected ? '30px' : '24px'
      element.style.zIndex = selected ? '2' : '1'
      element.title = job.label
      element.setAttribute('role', 'button')
      element.setAttribute('aria-label', job.label)
      element.tabIndex = 0
      const pin = document.createElement('span')
      pin.className = `hme-pin${selected ? ' is-selected' : ''}`
      element.appendChild(pin)
      element.addEventListener('click', () => propsRef.current.onSelect(job.id))
      element.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          propsRef.current.onSelect(job.id)
        }
      })
      return new maplibregl.Marker({ element, anchor: 'bottom' }).setLngLat([job.lng, job.lat]).addTo(map)
    })
  }

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const initial = propsRef.current
    const key = import.meta.env.VITE_GEOAPIFY_API_KEY as string | undefined
    const map = new maplibregl.Map({
      container: box,
      style: `https://maps.geoapify.com/v1/styles/osm-bright/style.json?apiKey=${encodeURIComponent(key ?? '')}`,
      center: [initial.origin.lng, initial.origin.lat],
      zoom: zoomForRadius(initial.radiusKm),
      attributionControl: false,
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left')
    map.addControl(new maplibregl.AttributionControl({ compact: true }))
    mapRef.current = map
    const markUserInteraction = () => { userInteractedRef.current = true }
    const markZoomControlClick = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest('.maplibregl-ctrl-zoom-in, .maplibregl-ctrl-zoom-out')) markUserInteraction()
    }
    box.addEventListener('wheel', markUserInteraction, { passive: true })
    box.addEventListener('click', markZoomControlClick)
    map.on('dragstart', markUserInteraction)
    map.on('error', () => setTileError(true))
    map.on('load', () => {
      readyRef.current = true
      tuneStyle(map)
      const current = propsRef.current
      const firstSymbol = map.getStyle().layers.find((layer) => layer.type === 'symbol')?.id
      map.addSource(CIRCLE_SOURCE, { type: 'geojson', data: radiusGeoJSON(current.origin, current.radiusKm) })
      map.addLayer({ id: 'home-radius-fill', type: 'fill', source: CIRCLE_SOURCE, paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.08 } }, firstSymbol)
      map.addLayer({ id: 'home-radius-line', type: 'line', source: CIRCLE_SOURCE, paint: { 'line-color': '#2563eb', 'line-width': 1.5, 'line-opacity': 0.75 } }, firstSymbol)
      const dot = document.createElement('div')
      dot.className = 'hme-map__origin'
      dot.style.backgroundColor = current.originIsUser ? '#2563eb' : '#64748b'
      originMarkerRef.current = new maplibregl.Marker({ element: dot, anchor: 'center' })
        .setLngLat([current.origin.lng, current.origin.lat]).addTo(map)
      updateMarkers()
    })
    const ro = new ResizeObserver(() => map.resize())
    ro.observe(box)
    return () => {
      ro.disconnect()
      box.removeEventListener('wheel', markUserInteraction)
      box.removeEventListener('click', markZoomControlClick)
      map.off('dragstart', markUserInteraction)
      jobMarkersRef.current.forEach((marker) => marker.remove())
      jobMarkersRef.current = []
      originMarkerRef.current?.remove()
      originMarkerRef.current = null
      map.remove()
      mapRef.current = null
      readyRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const { origin, originIsUser, radiusKm, recenterRequest } = props
    const source = map.getSource(CIRCLE_SOURCE) as GeoJSONSource | undefined
    source?.setData(radiusGeoJSON(origin, radiusKm))
    originMarkerRef.current?.setLngLat([origin.lng, origin.lat])
    if (originMarkerRef.current) originMarkerRef.current.getElement().style.backgroundColor = originIsUser ? '#2563eb' : '#64748b'
    const previous = lastViewportRef.current
    const moved = previous.origin.lat !== origin.lat || previous.origin.lng !== origin.lng || previous.recenterRequest !== recenterRequest
    lastViewportRef.current = { origin, recenterRequest }
    if (moved) {
      userInteractedRef.current = false
      map.jumpTo({ center: [origin.lng, origin.lat], zoom: zoomForRadius(radiusKm) })
    }
  }, [props.origin, props.originIsUser, props.radiusKm, props.recenterRequest])

  useEffect(() => { updateMarkers() }, [props.markers, props.selectedId])

  return (
    <div className="hme-map">
      <div ref={boxRef} className="hme-map__canvas" />
      {tileError && <div className="hme-map__notice">Không tải được bản đồ nền. Vui lòng thử lại sau.</div>}
    </div>
  )
}
