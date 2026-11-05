// WebGL 없이 동작하는 최종 대체 지도. 좌표·필터·선택은 기존 메인 지도 props를 그대로 사용한다.
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef, useState } from 'react'
import type { HomeMapProviderProps } from './HomeMapTypes'
import { groupHomeMapMarkers } from './groupHomeMapMarkers'
import { calculateInitialZoom } from './homeMapGeometry'

export default function RasterMapCanvas(props: HomeMapProviderProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const jobsRef = useRef<L.LayerGroup | null>(null)
  const circleRef = useRef<L.Circle | null>(null)
  const originRef = useRef<L.CircleMarker | null>(null)
  const propsRef = useRef(props)
  const previousRef = useRef({ origin: props.origin, request: props.recenterRequest })
  const [tileError, setTileError] = useState(false)
  propsRef.current = props

  const syncMarkers = () => {
    const map = mapRef.current, layer = jobsRef.current
    if (!map || !layer) return
    layer.clearLayers()
    map.closePopup()
    for (const group of groupHomeMapMarkers(propsRef.current.markers)) {
      const job = group[0]
      const selected = group.some(m => m.id === propsRef.current.selectedId)
      const size = selected ? 30 : 24
      const content = document.createElement('div')
      const pin = document.createElement('span')
      pin.className = `hme-pin${selected ? ' is-selected' : ''}${group.some(m => m.kind && m.kind !== 'exact') ? ' hme-pin--representative' : ''}`
      content.appendChild(pin)
      if (group.length > 1) {
        const count = document.createElement('span')
        count.className = 'hme-map__job-count'
        count.textContent = String(group.length)
        content.appendChild(count)
      }
      const marker = L.marker([job.lat, job.lng], {
        icon: L.divIcon({ className: 'hme-map__job-marker', html: content, iconSize: [size, size], iconAnchor: [size / 2, size] }),
        title: job.label, keyboard: true, zIndexOffset: selected ? 100 : 0,
      }).addTo(layer)
      const choose = () => {
        if (group.length === 1) { propsRef.current.onSelect(job.id, job); return }
        const list = document.createElement('div')
        list.className = 'hme-map__job-picker'
        for (const item of group) {
          const button = document.createElement('button')
          button.type = 'button'
          button.textContent = item.label
          button.addEventListener('click', () => { propsRef.current.onSelect(item.id, item); map.closePopup() })
          list.appendChild(button)
        }
        L.popup().setLatLng([job.lat, job.lng]).setContent(list).openOn(map)
      }
      marker.on('click', choose)
      const element = marker.getElement()
      if (element) {
        element.dataset.locationPoints = JSON.stringify(group.map(m => ({ ...m, jobId: m.id })))
        element.dataset.locationKind = job.kind ?? 'exact'
        element.setAttribute('aria-label', job.label)
        element.addEventListener('keydown', event => { if (event.key === ' ') { event.preventDefault(); choose() } })
      }
    }
  }

  const syncOrigin = () => {
    const map = mapRef.current
    if (!map) return
    const current = propsRef.current
    const at: L.LatLngExpression = [current.origin.lat, current.origin.lng]
    circleRef.current?.remove()
    originRef.current?.remove()
    if (current.radiusActive === false) return
    circleRef.current = L.circle(at, { radius: current.radiusKm * 1000, color: '#2563eb', weight: 1.5, fillColor: '#3b82f6', fillOpacity: 0.08 }).addTo(map)
    const color = current.originIsUser ? '#2563eb' : '#64748b'
    originRef.current = L.circleMarker(at, { radius: 5, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 }).addTo(map)
  }

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const current = propsRef.current
    const initial = current.initialViewport
    const map = L.map(box, { scrollWheelZoom: true, zoomControl: true }).setView(
      [initial?.center.lat ?? current.origin.lat, initial?.center.lng ?? current.origin.lng],
      initial?.zoom ?? calculateInitialZoom(current.origin.lat, current.radiusKm, box.getBoundingClientRect()),
    )
    mapRef.current = map
    jobsRef.current = L.layerGroup().addTo(map)
    const key = import.meta.env.VITE_GEOAPIFY_API_KEY as string | undefined
    const tiles = L.tileLayer(`https://maps.geoapify.com/v1/tile/osm-carto/{z}/{x}/{y}.png?apiKey=${encodeURIComponent(key ?? '')}`, {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · <a href="https://www.geoapify.com/">Geoapify</a>',
    }).addTo(map)
    let loaded = 0
    tiles.on('tileload', () => { loaded++; setTileError(false) })
    tiles.on('load', () => { if (loaded === 0) setTileError(true) })
    const report = () => {
      const center = map.getCenter(), bounds = map.getBounds(), zoom = map.getZoom()
      box.dataset.mapCenterLat = String(center.lat)
      box.dataset.mapCenterLng = String(center.lng)
      box.dataset.mapZoom = String(zoom)
      propsRef.current.onViewportChange({ center: { lat: center.lat, lng: center.lng }, zoom, bounds: { west: bounds.getWest(), east: bounds.getEast(), south: bounds.getSouth(), north: bounds.getNorth() } })
    }
    map.on('moveend', report)
    map.on('click', (event: L.LeafletMouseEvent) => {
      if (propsRef.current.pickingOrigin) propsRef.current.onOriginPick?.({ lat: event.latlng.lat, lng: event.latlng.lng })
    })
    syncOrigin()
    syncMarkers()
    const resize = new ResizeObserver(() => { map.invalidateSize(); report() })
    resize.observe(box)
    report()
    propsRef.current.onReady()
    return () => {
      resize.disconnect()
      map.remove()
      mapRef.current = null
      jobsRef.current = null
      circleRef.current = null
      originRef.current = null
    }
    // The map instance stays mounted while React updates its markers and viewport.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { syncMarkers() }, [props.markers, props.selectedId])
  useEffect(() => {
    syncOrigin()
    const map = mapRef.current, previous = previousRef.current
    if (map && (previous.origin.lat !== props.origin.lat || previous.origin.lng !== props.origin.lng || previous.request !== props.recenterRequest)) {
      const box = boxRef.current!
      map.setView([props.origin.lat, props.origin.lng], calculateInitialZoom(props.origin.lat, props.radiusKm, box.getBoundingClientRect()), { animate: false })
    }
    previousRef.current = { origin: props.origin, request: props.recenterRequest }
  }, [props.origin, props.originIsUser, props.radiusKm, props.radiusActive, props.recenterRequest])
  useEffect(() => {
    if (props.cameraRequest) mapRef.current?.setView([props.cameraRequest.center.lat, props.cameraRequest.center.lng], props.cameraRequest.zoom, { animate: false })
  }, [props.cameraRequest])

  return <div className="hme-map" data-map-provider="raster">
    <div ref={boxRef} className="hme-map__canvas" />
    {tileError && <div className="hme-map__notice">Không tải được bản đồ nền. Vui lòng thử lại sau.</div>}
  </div>
}
