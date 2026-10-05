// VIETMAP 공식 Vector Street / Hybrid style을 렌더링하는 메인 지도 provider.
// 2026-10-05 생활지도: 건물·근무지·생활시설 우선 스타일(lifeMapStyle), Bản đồ/Vệ tinh 전환,
// 화면 단위 핀 계획(공동 핀·viewport filtering·cluster), 선택 공고 주변 생활시설 요약.
import * as vietmapgl from '@vietmap/vietmap-gl-js/dist/vietmap-gl.js'
import type { GeoJSONSource, Map as VietMap, Marker, Popup, StyleSpecification } from '@vietmap/vietmap-gl-js/dist/vietmap-gl.js'
import '@vietmap/vietmap-gl-js/dist/vietmap-gl.css'
import { useEffect, useRef, useState } from 'react'
import type { HomeMapMarker, HomeMapProviderProps, MapViewportSize } from './HomeMapTypes'
import { calculateInitialZoom, createRadiusPolygon, radiusWithinLoadedTiles } from './homeMapGeometry'
import { sanitizeVietMapError } from './vietMapError'
import { createVietMapStyleUrl, type VietMapStyleKind } from './vietMapStyle'
import { BUILDING_CLICK_LAYERS, applyLifeMapStyle, type StyleLike } from './lifeMapStyle'
import { pointInPolygon, poisInsideBuilding, polygonCenter, type LngLat, type PickedPlace, type PolygonRings } from '../../../lib/mapPlace'
import { planHomeMapMarkers, type MarkerPlanItem } from './homeMapClusters'
import { SHARED_JOB_POPUP_OPTIONS } from './sharedJobPopupOptions'
import { NEARBY_RADII_M, summarizeNearby, type MapPoi } from '../../../lib/nearbyFacilities'

const CIRCLE_SOURCE = 'home-search-radius'
const NEARBY_SOURCE = 'home-nearby-points'
const RING_SOURCE = 'home-nearby-rings'
const PICKED_SOURCE = 'home-picked-place'
/** 주변시설 조회 zoom. VietMap 생활시설 POI는 z16 타일에만 온전히 들어 있다(2026-10-05 실측:
 *  같은 300 m 안 z15 7개 → z16 89개 = z17 89개). 그래서 선택 시 z16으로 맞춘다. */
const NEARBY_QUERY_ZOOM = 16
const EMPTY_FC = { type: 'FeatureCollection' as const, features: [] }

const KIND_COLOR: Record<string, string> = {
  workplace: '#334155', restaurant: '#f97316', convenience: '#a855f7', cafe: '#b45309', pharmacy: '#0ea5e9',
  clinic: '#ef4444', bus: '#1d4ed8', lodging: '#7c3aed', market: '#c026d3', bank: '#0f766e',
}

function canvasSize(element: HTMLElement): MapViewportSize {
  const bounds = element.getBoundingClientRect()
  return { width: bounds.width, height: bounds.height }
}

function pickedFeatures(place: PickedPlace | null) {
  if (!place) return EMPTY_FC
  const geometry = place.polygon
    ? { type: 'Polygon' as const, coordinates: place.polygon }
    : { type: 'Point' as const, coordinates: [place.lng, place.lat] }
  return { type: 'FeatureCollection' as const, features: [{ type: 'Feature' as const, geometry, properties: {} }] }
}

function ringFeatures(center: { lat: number; lng: number } | null) {
  if (!center) return EMPTY_FC
  return {
    type: 'FeatureCollection' as const,
    features: NEARBY_RADII_M.map((m) => ({ ...createRadiusPolygon(center, m / 1000), properties: { radius: m } })),
  }
}

export default function VietMapMapCanvas(props: HomeMapProviderProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<VietMap | null>(null)
  const readyRef = useRef(false)
  const failedRef = useRef(false)
  const originMarkerRef = useRef<Marker | null>(null)
  const markerElementsRef = useRef(new Map<string, { marker: Marker; signature: string }>())
  const jobPickerRef = useRef<Popup | null>(null)
  const propsRef = useRef(props)
  const lastViewportRef = useRef({ origin: props.origin, recenterRequest: props.recenterRequest })
  const [mode, setMode] = useState<VietMapStyleKind>('street')
  const modeRef = useRef(mode)
  const nearbyRequestRef = useRef(0)
  /** 최신 선택 장소(렌더 전에도 즉시 반영 — 닫은 직후 이동 이벤트가 다시 여는 것을 막는다). */
  const pickedRef = useRef<PickedPlace | null>(props.pickedPlace ?? null)
  const nearbyDataRef = useRef<{ points: unknown; center: { lat: number; lng: number } | null }>({ points: EMPTY_FC, center: null })
  propsRef.current = props
  modeRef.current = mode

  const apiKey = (import.meta.env.VITE_VIETMAP_TILEMAP_KEY as string | undefined)?.trim() ?? ''

  const markerElement = (item: MarkerPlanItem): HTMLElement => {
    const map = mapRef.current!
    const element = document.createElement('div')
    if (item.kind === 'cluster') {
      element.className = 'hme-map__cluster'
      element.textContent = String(item.count)
      element.title = `${item.count} việc làm trong khu vực này — nhấn để phóng to`
      element.setAttribute('role', 'button')
      element.setAttribute('aria-label', element.title)
      element.tabIndex = 0
      const zoomIn = () => map.easeTo({ center: [item.lng, item.lat], zoom: Math.min(map.getZoom() + 2, 15) })
      element.addEventListener('click', zoomIn)
      element.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); zoomIn() } })
      return element
    }
    const group = item.markers
    const job = group[0]
    const selected = group.some((m) => m.id === propsRef.current.selectedId)
    element.className = 'hme-map__job-marker'
    element.dataset.jobCount = String(group.length)
    element.style.width = selected ? '30px' : '24px'
    element.style.height = selected ? '30px' : '24px'
    element.style.zIndex = selected ? '2' : '1'
    element.title = group.length === 1 ? job.label : `${group.length} việc làm cùng địa điểm`
    element.setAttribute('role', 'button')
    element.setAttribute('aria-label', element.title)
    element.tabIndex = 0
    const pin = document.createElement('span')
    pin.className = `hme-pin${selected ? ' is-selected' : ''}`
    element.appendChild(pin)
    if (group.length > 1) {
      const count = document.createElement('span')
      count.className = 'hme-map__job-count'
      count.textContent = String(group.length)
      element.appendChild(count)
    }
    const choose = () => {
      if (group.length === 1) { propsRef.current.onSelect(job.id); return }
      jobPickerRef.current?.remove()
      const list = document.createElement('div')
      list.className = 'hme-map__job-picker'
      const heading = document.createElement('strong')
      heading.textContent = `${group.length} việc làm tại địa điểm này`
      list.appendChild(heading)
      for (const m of group) {
        const button = document.createElement('button')
        button.type = 'button'
        button.textContent = m.label
        button.dataset.jobId = m.id
        button.addEventListener('click', () => propsRef.current.onSelect(m.id))
        list.appendChild(button)
      }
      jobPickerRef.current = new vietmapgl.Popup(SHARED_JOB_POPUP_OPTIONS).setLngLat([job.lng, job.lat]).setDOMContent(list).addTo(map)
    }
    element.addEventListener('click', choose)
    element.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose() } })
    return element
  }

  /** 화면에 필요한 핀만 유지한다. 바뀌지 않은 핀은 DOM을 다시 만들지 않는다. */
  const renderMarkers = () => {
    const map = mapRef.current
    const box = boxRef.current
    if (!map || !box || !readyRef.current) return
    const { markers, selectedId } = propsRef.current
    const plan = planHomeMapMarkers(markers, {
      project: (lat, lng) => map.project([lng, lat]),
      viewport: canvasSize(box),
      zoom: map.getZoom(),
      selectedId,
    })
    const next = new Map<string, { marker: Marker; signature: string }>()
    for (const item of plan) {
      const ids = item.markers.map((m) => m.id).join(',')
      const selected = item.kind === 'group' && item.markers.some((m) => m.id === selectedId)
      const signature = `${item.kind}|${ids}|${selected ? 1 : 0}|${item.markers.map((m) => m.label).join('\u0001')}`
      const existing = markerElementsRef.current.get(item.key)
      if (existing && existing.signature === signature) { next.set(item.key, existing); continue }
      existing?.marker.remove()
      const lngLat: [number, number] = item.kind === 'cluster' ? [item.lng, item.lat] : [item.markers[0].lng, item.markers[0].lat]
      const marker = new vietmapgl.Marker({ element: markerElement(item), anchor: item.kind === 'cluster' ? 'center' : 'bottom' }).setLngLat(lngLat).addTo(map)
      next.set(item.key, { marker, signature })
    }
    for (const [key, entry] of markerElementsRef.current) if (!next.has(key)) entry.marker.remove()
    markerElementsRef.current = next
    box.dataset.renderedMarkers = String(next.size)
  }

  /** 앱 source/layer를 현재 style에 보장한다(스타일 교체 뒤에도 호출). */
  const ensureAppLayers = () => {
    const map = mapRef.current
    if (!map) return
    const current = propsRef.current
    const firstSymbol = map.getStyle().layers.find((layer) => layer.type === 'symbol')?.id
    if (!map.getSource(CIRCLE_SOURCE)) map.addSource(CIRCLE_SOURCE, { type: 'geojson', data: createRadiusPolygon(current.origin, current.radiusKm) })
    if (!map.getLayer('home-radius-fill')) map.addLayer({ id: 'home-radius-fill', type: 'fill', source: CIRCLE_SOURCE, paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.08 } }, firstSymbol)
    if (!map.getLayer('home-radius-line')) map.addLayer({ id: 'home-radius-line', type: 'line', source: CIRCLE_SOURCE, paint: { 'line-color': '#2563eb', 'line-width': 1.5, 'line-opacity': 0.75 } }, firstSymbol)
    if (!map.getSource(RING_SOURCE)) map.addSource(RING_SOURCE, { type: 'geojson', data: ringFeatures(nearbyDataRef.current.center) })
    if (!map.getLayer('home-nearby-ring')) {
      map.addLayer({
        id: 'home-nearby-ring', type: 'line', source: RING_SOURCE,
        paint: { 'line-color': '#e11d48', 'line-width': 2, 'line-opacity': 0.85, 'line-dasharray': [2, 1.5] },
      }, firstSymbol)
    }
    if (!map.getSource(NEARBY_SOURCE)) map.addSource(NEARBY_SOURCE, { type: 'geojson', data: nearbyDataRef.current.points as GeoJSON.FeatureCollection })
    if (!map.getLayer('home-nearby-dot')) {
      map.addLayer({
        id: 'home-nearby-dot', type: 'circle', source: NEARBY_SOURCE,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 3, 17, 6],
          'circle-color': ['match', ['get', 'kind'], ...Object.entries(KIND_COLOR).flat(), '#64748b'] as unknown as string,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.5,
        },
      }, firstSymbol) // 공식 아이콘 아래 — 라벨이 충돌로 숨겨진 시설만 점으로 드러난다
    }
    if (!map.getSource(PICKED_SOURCE)) map.addSource(PICKED_SOURCE, { type: 'geojson', data: pickedFeatures(propsRef.current.pickedPlace ?? null) })
    if (!map.getLayer('home-picked-fill')) {
      map.addLayer({ id: 'home-picked-fill', type: 'fill', source: PICKED_SOURCE, filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': '#2563eb', 'fill-opacity': 0.28 } }, firstSymbol)
    }
    if (!map.getLayer('home-picked-line')) {
      map.addLayer({ id: 'home-picked-line', type: 'line', source: PICKED_SOURCE, filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'line-color': '#1d4ed8', 'line-width': 2.5 } }, firstSymbol)
    }
    if (!map.getLayer('home-picked-point')) {
      map.addLayer({
        id: 'home-picked-point', type: 'circle', source: PICKED_SOURCE, filter: ['==', ['geometry-type'], 'Point'],
        paint: { 'circle-radius': 13, 'circle-color': '#2563eb', 'circle-opacity': 0.22, 'circle-stroke-color': '#1d4ed8', 'circle-stroke-width': 2.5 },
      }, firstSymbol)
    }
  }

  /** 지도에 로드된 POI(벡터 타일) — 화면 타일 범위만. */
  const loadedPois = (): MapPoi[] => {
    const map = mapRef.current
    if (!map) return []
    const pois: MapPoi[] = []
    for (const f of map.querySourceFeatures('openmaptiles', { sourceLayer: 'poi' })) {
      if (f.geometry.type !== 'Point') continue
      const [lng, lat] = f.geometry.coordinates as [number, number]
      pois.push({ name: String(f.properties?.name ?? ''), cls: String(f.properties?.class ?? ''), lat, lng })
    }
    return pois
  }

  /** 클릭한 장소의 주변 생활시설을 현재 로드된 데이터로 계산(화면은 움직이지 않음). */
  const withNearby = (base: Omit<PickedPlace, 'nearby' | 'nearbyComplete' | 'insidePois'> & { insidePois?: PickedPlace['insidePois'] }, pois: MapPoi[]): PickedPlace => {
    const map = mapRef.current!
    const b = map.getBounds()
    const view = { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() }
    const zoom = map.getZoom()
    const center = { lat: base.lat, lng: base.lng }
    const insidePois = base.insidePois ?? (base.polygon ? poisInsideBuilding(base.polygon, pois) : [])
    return {
      ...base,
      insidePois,
      nearby: summarizeNearby(center, pois),
      nearbyComplete: Math.floor(zoom) >= NEARBY_QUERY_ZOOM && NEARBY_RADII_M.every((m) => radiusWithinLoadedTiles(center, m, view, zoom)),
    }
  }

  /** 클릭 지점의 POI → 건물 순으로 판정. React DOM 이벤트 없이 렌더링된 layer만 조회한다. */
  const pickAt = (point: { x: number; y: number }, lngLat: { lng: number; lat: number }): PickedPlace | null => {
    const map = mapRef.current
    if (!map) return null
    const layers = map.getStyle().layers
    const poiLayers = layers.filter((l) => l.type === 'symbol' && (l as { 'source-layer'?: string })['source-layer'] === 'poi').map((l) => l.id)
    if (map.getLayer('home-nearby-dot')) poiLayers.push('home-nearby-dot')
    const pad = 8
    const hits = map.queryRenderedFeatures([[point.x - pad, point.y - pad], [point.x + pad, point.y + pad]], { layers: poiLayers })
      .filter((f) => f.geometry.type === 'Point' && String(f.properties?.name ?? '').trim())
    if (hits.length) {
      const nearest = hits
        .map((f) => ({ f, c: f.geometry.type === 'Point' ? (f.geometry.coordinates as [number, number]) : [0, 0] }))
        .sort((a, b) => {
          const pa = map.project(a.c as [number, number]); const pb = map.project(b.c as [number, number])
          return Math.hypot(pa.x - point.x, pa.y - point.y) - Math.hypot(pb.x - point.x, pb.y - point.y)
        })[0]
      const [lng, lat] = nearest.c
      const name = String(nearest.f.properties?.name)
      const cls = nearest.f.properties?.class !== undefined ? String(nearest.f.properties.class) : String(nearest.f.properties?.cls ?? '')
      return withNearby({ key: `poi:${name}:${lat.toFixed(5)}:${lng.toFixed(5)}`, kind: 'poi', name, cls, lat, lng, polygon: null }, loadedPois())
    }
    const buildingLayers = BUILDING_CLICK_LAYERS.filter((id) => map.getLayer(id))
    if (!buildingLayers.length) return null
    const building = map.queryRenderedFeatures([point.x, point.y], { layers: [...buildingLayers] })[0]
    if (!building) return null
    const g = building.geometry
    const click: LngLat = [lngLat.lng, lngLat.lat]
    let rings: PolygonRings | null = null
    if (g.type === 'Polygon') rings = g.coordinates as PolygonRings
    else if (g.type === 'MultiPolygon') rings = (g.coordinates as PolygonRings[]).find((poly) => pointInPolygon(click, poly)) ?? (g.coordinates as PolygonRings[])[0]
    if (!rings) return null
    const center = polygonCenter(rings)
    return withNearby({
      key: `building:${center.lat.toFixed(6)}:${center.lng.toFixed(6)}`, kind: 'building', name: null, cls: null, lat: center.lat, lng: center.lng, polygon: rings,
    }, loadedPois())
  }

  const setNearbyLayers = (center: { lat: number; lng: number } | null, points: unknown) => {
    nearbyDataRef.current = { center, points }
    const map = mapRef.current
    if (!map) return
    ;(map.getSource(RING_SOURCE) as GeoJSONSource | undefined)?.setData(ringFeatures(center))
    ;(map.getSource(NEARBY_SOURCE) as GeoJSONSource | undefined)?.setData(points as GeoJSON.FeatureCollection)
  }

  const loadStyle = (kind: VietMapStyleKind) => {
    const map = mapRef.current
    if (!map) return
    // diff:false — 일반↔위성은 source 구성이 달라 전체 교체가 안전하고 style.load가 확실히 발생한다.
    map.setStyle(createVietMapStyleUrl(apiKey, kind), {
      diff: false,
      transformStyle: (previous, next) => applyLifeMapStyle(next as unknown as StyleLike, kind, previous as unknown as StyleLike) as unknown as StyleSpecification,
    })
  }

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    let map: VietMap | null = null
    let teardown: (() => void) | null = null
    const controller = new AbortController()
    let styleUrl: string
    try {
      styleUrl = createVietMapStyleUrl(apiKey, 'street')
    } catch {
      propsRef.current.onFailure('initialization-error')
      return
    }

    // 공식 style JSON을 먼저 받아 생활지도 변환 후 지도를 만든다(빈 style → 교체 과정 없음).
    fetch(styleUrl, { signal: controller.signal })
      .then((res) => { if (!res.ok) throw new Error(`style ${res.status}`); return res.json() as Promise<StyleSpecification> })
      .then((official) => {
        if (controller.signal.aborted) return
        const initial = propsRef.current
        try {
          map = new vietmapgl.Map({
            container: box,
            style: applyLifeMapStyle(official as unknown as StyleLike, 'street') as unknown as StyleSpecification,
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
        teardown = setup(map, box)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        failedRef.current = true
        console.warn(`[home-map] VIETMAP style load error: ${sanitizeVietMapError(error instanceof Error ? error.message : 'unknown')}`)
        propsRef.current.onFailure('loader-error')
      })

    return () => {
      controller.abort()
      teardown?.()
      map = null
    }
    // The map instance lives for the provider lifetime; prop changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setup = (map: VietMap, box: HTMLDivElement) => {
    map.addControl(new vietmapgl.NavigationControl({ showCompass: false }), 'top-left')
    map.addControl(new vietmapgl.AttributionControl({ compact: true }))
    mapRef.current = map
    if (import.meta.env.DEV) (window as unknown as { __homeMap?: VietMap }).__homeMap = map

    const reportViewport = () => {
      const center = map.getCenter()
      const zoom = map.getZoom()
      box.dataset.mapCenterLat = String(center.lat)
      box.dataset.mapCenterLng = String(center.lng)
      box.dataset.mapZoom = String(zoom)
      propsRef.current.onViewportChange({ center: { lat: center.lat, lng: center.lng }, zoom })
    }
    const reportFailure = (event: { error?: { message?: string }; tile?: unknown; sourceId?: string }) => {
      if (failedRef.current) return
      if (readyRef.current && (event.tile || event.sourceId)) {
        // 준비된 지도에서 개별 타일 오류(예: 위성 타일 일부 누락)는 지도 전체 실패로 보지 않는다.
        console.warn(`[home-map] VIETMAP tile error: ${sanitizeVietMapError(event.error?.message ?? 'unknown')}`)
        return
      }
      if (readyRef.current && modeRef.current === 'satellite') {
        // 위성 style 로드 실패 → 일반지도로 되돌린다(Geoapify로 내려가지 않음).
        console.warn(`[home-map] VIETMAP satellite style error: ${sanitizeVietMapError(event.error?.message ?? 'unknown')}`)
        setMode('street')
        propsRef.current.onMapModeChange?.('street')
        return
      }
      failedRef.current = true
      console.warn(`[home-map] VIETMAP render error: ${sanitizeVietMapError(event.error?.message ?? 'unknown')}`)
      propsRef.current.onFailure('render-error')
    }
    const onStyleLoad = () => {
      ensureAppLayers()
      box.dataset.mapStyle = modeRef.current
      if (readyRef.current) return
      readyRef.current = true
      const current = propsRef.current
      const dot = document.createElement('div')
      dot.className = 'hme-map__origin'
      dot.style.backgroundColor = current.originIsUser ? '#2563eb' : '#64748b'
      originMarkerRef.current = new vietmapgl.Marker({ element: dot, anchor: 'center' }).setLngLat([current.origin.lng, current.origin.lat]).addTo(map)
      renderMarkers()
      reportViewport()
      current.onReady()
    }
    // 이동·확대 후 선택한 장소의 주변시설을 새로 로드된 데이터로 다시 센다(화면은 사용자 조작 그대로).
    const refreshPicked = () => {
      const picked = pickedRef.current
      if (!picked) return
      const next = withNearby({ ...picked }, loadedPois())
      // 장소가 화면 타일 밖으로 나간 경우 등 덜 완전한 데이터로 덮어쓰지 않는다.
      if (!next.nearbyComplete) return
      const sig = (p: PickedPlace) => JSON.stringify([p.nearbyComplete, p.nearby?.counts, p.nearby?.workplaces.length, p.insidePois.length])
      if (sig(next) !== sig(picked)) { pickedRef.current = next; propsRef.current.onPlacePick?.(next) }
    }
    const onMoveEnd = () => { reportViewport(); renderMarkers(); refreshPicked() }
    const onClick = (e: { point: { x: number; y: number }; lngLat: { lng: number; lat: number }; originalEvent: MouseEvent }) => {
      const target = e.originalEvent?.target as HTMLElement | null
      if (target?.closest?.('.vietmapgl-marker, .vietmapgl-popup, .hme-map__modes')) return
      const place = pickAt(e.point, e.lngLat)
      pickedRef.current = place
      propsRef.current.onPlacePick?.(place)
    }
    let hoverFrame = 0
    const onHover = (e: { point: { x: number; y: number } }) => {
      if (hoverFrame) return
      hoverFrame = requestAnimationFrame(() => {
        hoverFrame = 0
        const layers = [...BUILDING_CLICK_LAYERS, 'home-nearby-dot'].filter((id) => map.getLayer(id))
        const poiLayers = map.getStyle().layers.filter((l) => l.type === 'symbol' && (l as { 'source-layer'?: string })['source-layer'] === 'poi').map((l) => l.id)
        const hit = map.queryRenderedFeatures([e.point.x, e.point.y], { layers: [...layers, ...poiLayers] }).length > 0
        map.getCanvas().style.cursor = hit ? 'pointer' : ''
      })
    }
    map.on('click', onClick)
    map.on('mousemove', onHover)
    map.on('moveend', onMoveEnd)
    map.on('error', reportFailure)
    map.on('style.load', onStyleLoad)

    const resizeObserver = new ResizeObserver(() => map.resize())
    resizeObserver.observe(box)
    return () => {
      resizeObserver.disconnect()
      map.off('moveend', onMoveEnd)
      map.off('error', reportFailure)
      map.off('style.load', onStyleLoad)
      map.off('click', onClick)
      map.off('mousemove', onHover)
      cancelAnimationFrame(hoverFrame)
      jobPickerRef.current?.remove()
      jobPickerRef.current = null
      for (const entry of markerElementsRef.current.values()) entry.marker.remove()
      markerElementsRef.current = new Map()
      originMarkerRef.current?.remove()
      originMarkerRef.current = null
      map.remove()
      mapRef.current = null
      readyRef.current = false
      failedRef.current = false
    }
  }

  // Bản đồ ↔ Vệ tinh: 같은 지도 인스턴스에서 style만 교체 → viewport·DOM 핀·현재 위치 유지.
  const firstModeRef = useRef(true)
  useEffect(() => {
    if (firstModeRef.current) { firstModeRef.current = false; return }
    if (readyRef.current) loadStyle(mode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  useEffect(() => {
    const map = mapRef.current
    const box = boxRef.current
    if (!map || !box) return
    const { origin, originIsUser, radiusKm, recenterRequest } = props
    ;(map.getSource(CIRCLE_SOURCE) as GeoJSONSource | undefined)?.setData(createRadiusPolygon(origin, radiusKm))
    originMarkerRef.current?.setLngLat([origin.lng, origin.lat])
    if (originMarkerRef.current) originMarkerRef.current.getElement().style.backgroundColor = originIsUser ? '#2563eb' : '#64748b'
    const previous = lastViewportRef.current
    const recenter = previous.origin.lat !== origin.lat || previous.origin.lng !== origin.lng || previous.recenterRequest !== recenterRequest
    lastViewportRef.current = { origin, recenterRequest }
    if (recenter) map.jumpTo({ center: [origin.lng, origin.lat], zoom: calculateInitialZoom(origin.lat, radiusKm, canvasSize(box)) })
  }, [props.origin, props.originIsUser, props.radiusKm, props.recenterRequest])

  useEffect(() => { renderMarkers() }, [props.markers, props.selectedId])

  // 선택한 건물/시설 강조(지도 viewport는 건드리지 않는다).
  useEffect(() => {
    pickedRef.current = props.pickedPlace ?? null
    const map = mapRef.current
    ;(map?.getSource(PICKED_SOURCE) as GeoJSONSource | undefined)?.setData(pickedFeatures(props.pickedPlace ?? null))
    if (boxRef.current) boxRef.current.dataset.pickedPlace = props.pickedPlace?.key ?? ''
  }, [props.pickedPlace])

  // 사용자가 패널에서 '확대해서 정확히 세기'를 누른 경우에만 이동.
  const firstZoomRequestRef = useRef(props.placeZoomRequest)
  useEffect(() => {
    if (props.placeZoomRequest === firstZoomRequestRef.current) return
    const map = mapRef.current
    const place = propsRef.current.pickedPlace
    if (map && place) map.easeTo({ center: [place.lng, place.lat], zoom: Math.max(map.getZoom(), NEARBY_QUERY_ZOOM), duration: 500 })
  }, [props.placeZoomRequest])

  // 외부(패널)에서 지정한 Bản đồ / Vệ tinh 반영.
  useEffect(() => { if (props.mapMode && props.mapMode !== modeRef.current) setMode(props.mapMode) }, [props.mapMode])
  const chooseMode = (next: VietMapStyleKind) => { setMode(next); propsRef.current.onMapModeChange?.(next) }

  // 선택 공고 주변 생활시설: 근무지로 이동(z16) → 타일 로드 완료 후 실제 POI만 집계.
  const selectedMarker: HomeMapMarker | null = props.selectedId ? props.markers.find((m) => m.id === props.selectedId) ?? null : null
  const selLat = selectedMarker?.lat
  const selLng = selectedMarker?.lng
  useEffect(() => {
    const map = mapRef.current
    const request = ++nearbyRequestRef.current
    const report = propsRef.current.onNearbyChange
    if (!map || !props.selectedId || selLat === undefined || selLng === undefined) {
      setNearbyLayers(null, EMPTY_FC)
      report?.({ status: 'idle' })
      return
    }
    const jobId = props.selectedId
    const center = { lat: selLat, lng: selLng }
    report?.({ status: 'loading', jobId })
    let fallback = 0
    const compute = () => {
      if (request !== nearbyRequestRef.current || !mapRef.current) return
      window.clearTimeout(fallback)
      const pois: MapPoi[] = []
      for (const f of map.querySourceFeatures('openmaptiles', { sourceLayer: 'poi' })) {
        if (f.geometry.type !== 'Point') continue
        const [lng, lat] = f.geometry.coordinates as [number, number]
        pois.push({ name: String(f.properties?.name ?? ''), cls: String(f.properties?.class ?? ''), lat, lng })
      }
      const summary = summarizeNearby(center, pois)
      setNearbyLayers(center, {
        type: 'FeatureCollection',
        features: summary.items.map((i) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [i.lng, i.lat] }, properties: { kind: i.kind, name: i.name, cls: i.cls } })),
      })
      const b = map.getBounds()
      const view = { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() }
      const partial = NEARBY_RADII_M.find((m) => !radiusWithinLoadedTiles(center, m, view, map.getZoom())) ?? null
      boxRef.current?.setAttribute('data-nearby-count', String(summary.items.length))
      propsRef.current.onNearbyChange?.({ status: 'ready', jobId, summary, partialRadiusM: partial })
    }
    const run = () => {
      if (!readyRef.current) { map.once('style.load', run); return }
      setNearbyLayers(center, EMPTY_FC)
      map.easeTo({ center: [center.lng, center.lat], zoom: NEARBY_QUERY_ZOOM, duration: 500 })
      map.once('idle', compute)
      map.triggerRepaint()
      fallback = window.setTimeout(compute, 6000)
    }
    run()
    return () => { window.clearTimeout(fallback); map.off('idle', compute); map.off('style.load', run) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.selectedId, selLat, selLng])

  return (
    <div className="hme-map" data-map-provider="vietmap" data-map-mode={mode}>
      <div ref={boxRef} className="hme-map__canvas" />
      <div className="hme-map__modes" role="group" aria-label="Kiểu bản đồ">
        <button type="button" aria-pressed={mode === 'street'} className={mode === 'street' ? 'is-active' : ''} onClick={() => chooseMode('street')}>Bản đồ</button>
        <button type="button" aria-pressed={mode === 'satellite'} className={mode === 'satellite' ? 'is-active' : ''} onClick={() => chooseMode('satellite')}>Vệ tinh</button>
      </div>
    </div>
  )
}
