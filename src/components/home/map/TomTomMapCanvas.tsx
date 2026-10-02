// TomTom Orbis basic_street-light를 렌더링하는 MapLibre provider.
import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, Map as MapLibreMap, Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { useEffect, useRef } from 'react'
import type { HomeMapProviderProps, MapViewportSize } from './HomeMapTypes'
import { calculateInitialZoom, createRadiusPolygon } from './homeMapGeometry'
import { createTomTomOrbisStyleUrl } from './tomTomMapStyle'

const CIRCLE_SOURCE = 'home-search-radius'
maplibregl.setWorkerUrl(mapWorkerUrl)

function canvasSize(element: HTMLElement): MapViewportSize {
  const bounds = element.getBoundingClientRect()
  return { width: bounds.width, height: bounds.height }
}

export default function TomTomMapCanvas(props: HomeMapProviderProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const readyRef = useRef(false)
  const failedRef = useRef(false)
  const originMarkerRef = useRef<Marker | null>(null)
  const jobMarkersRef = useRef<Marker[]>([])
  const propsRef = useRef(props)
  const lastViewportRef = useRef({ origin: props.origin, recenterRequest: props.recenterRequest })
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
    const apiKey = (import.meta.env.VITE_TOMTOM_API_KEY as string | undefined)?.trim() ?? ''
    let map: MapLibreMap
    try {
      map = new maplibregl.Map({
        container: box,
        style: createTomTomOrbisStyleUrl(apiKey),
        center: initial.initialViewport
          ? [initial.initialViewport.center.lng, initial.initialViewport.center.lat]
          : [initial.origin.lng, initial.origin.lat],
        zoom: initial.initialViewport?.zoom ?? calculateInitialZoom(initial.origin.lat, initial.radiusKm, canvasSize(box)),
        attributionControl: false,
      })
    } catch {
      initial.onFailure('initialization-error')
      return
    }
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left')
    map.addControl(new maplibregl.AttributionControl({ compact: true }))
    mapRef.current = map

    const reportViewport = () => {
      const center = map.getCenter()
      const zoom = map.getZoom()
      box.dataset.mapCenterLat = String(center.lat)
      box.dataset.mapCenterLng = String(center.lng)
      box.dataset.mapZoom = String(zoom)
      propsRef.current.onViewportChange({ center: { lat: center.lat, lng: center.lng }, zoom })
    }
    const reportFailure = () => {
      if (failedRef.current) return
      failedRef.current = true
      propsRef.current.onFailure('render-error')
    }
    map.on('moveend', reportViewport)
    map.on('error', reportFailure)
    map.on('load', () => {
      readyRef.current = true
      const current = propsRef.current
      const firstSymbol = map.getStyle().layers.find((layer) => layer.type === 'symbol')?.id
      map.addSource(CIRCLE_SOURCE, { type: 'geojson', data: createRadiusPolygon(current.origin, current.radiusKm) })
      map.addLayer({ id: 'home-radius-fill', type: 'fill', source: CIRCLE_SOURCE, paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.08 } }, firstSymbol)
      map.addLayer({ id: 'home-radius-line', type: 'line', source: CIRCLE_SOURCE, paint: { 'line-color': '#2563eb', 'line-width': 1.5, 'line-opacity': 0.75 } }, firstSymbol)
      const dot = document.createElement('div')
      dot.className = 'hme-map__origin'
      dot.style.backgroundColor = current.originIsUser ? '#2563eb' : '#64748b'
      originMarkerRef.current = new maplibregl.Marker({ element: dot, anchor: 'center' })
        .setLngLat([current.origin.lng, current.origin.lat]).addTo(map)
      updateMarkers()
      reportViewport()
      current.onReady()
    })

    const resizeObserver = new ResizeObserver(() => map.resize())
    resizeObserver.observe(box)
    return () => {
      resizeObserver.disconnect()
      map.off('moveend', reportViewport)
      map.off('error', reportFailure)
      jobMarkersRef.current.forEach((marker) => marker.remove())
      jobMarkersRef.current = []
      originMarkerRef.current?.remove()
      originMarkerRef.current = null
      map.remove()
      mapRef.current = null
      readyRef.current = false
      failedRef.current = false
    }
    // MapLibre owns its instance for the provider lifetime; prop changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const box = boxRef.current
    if (!map || !box) return
    const { origin, originIsUser, radiusKm, recenterRequest } = props
    const source = map.getSource(CIRCLE_SOURCE) as GeoJSONSource | undefined
    source?.setData(createRadiusPolygon(origin, radiusKm))
    originMarkerRef.current?.setLngLat([origin.lng, origin.lat])
    if (originMarkerRef.current) originMarkerRef.current.getElement().style.backgroundColor = originIsUser ? '#2563eb' : '#64748b'
    const previous = lastViewportRef.current
    const recenter = previous.origin.lat !== origin.lat || previous.origin.lng !== origin.lng || previous.recenterRequest !== recenterRequest
    lastViewportRef.current = { origin, recenterRequest }
    if (recenter) {
      map.jumpTo({ center: [origin.lng, origin.lat], zoom: calculateInitialZoom(origin.lat, radiusKm, canvasSize(box)) })
    }
  }, [props.origin, props.originIsUser, props.radiusKm, props.recenterRequest])

  useEffect(() => { updateMarkers() }, [props.markers, props.selectedId])

  return <div className="hme-map" data-map-provider="tomtom"><div ref={boxRef} className="hme-map__canvas" /></div>
}
