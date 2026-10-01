// 메인 지도 탐색용 Leaflet 캔버스. 지도는 한 번만 만들고, 기준 위치·반경 원·공고 핀만 갱신한다
// (반경 슬라이더를 움직일 때마다 지도를 다시 만들지 않기 위해 JobLocationMap과 별도).
// leaflet은 window를 참조하므로 이 파일은 반드시 lazy import로만 불러온다(SSR 번들 보호).
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef, useState } from 'react'

export interface HomeMapMarker {
  id: string
  lat: number
  lng: number
  label: string
}

interface Props {
  origin: { lat: number; lng: number }
  /** true = 실제 현재 위치, false = 사용자가 고른 지역 중심 */
  originIsUser: boolean
  radiusKm: number
  recenterRequest: number
  markers: HomeMapMarker[]
  selectedId: string | null
  onSelect: (id: string) => void
}

function jobIcon(selected: boolean): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<span class="hme-pin${selected ? ' is-selected' : ''}"></span>`,
    iconSize: selected ? [30, 30] : [24, 24],
    iconAnchor: selected ? [15, 30] : [12, 24],
  })
}

function zoomForRadius(km: number): number {
  if (km <= 2) return 14
  if (km <= 4) return 13
  if (km <= 9) return 12
  if (km <= 16) return 11
  return 10
}

export default function HomeMapCanvas({ origin, originIsUser, radiusKm, recenterRequest, markers, selectedId, onSelect }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const circleRef = useRef<L.Circle | null>(null)
  const originRef = useRef<L.CircleMarker | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const onSelectRef = useRef(onSelect)
  const userInteractedRef = useRef(false)
  const [tileError, setTileError] = useState(false)
  onSelectRef.current = onSelect

  useEffect(() => {
    if (!boxRef.current) return
    const map = L.map(boxRef.current, { scrollWheelZoom: true, zoomControl: true }).setView([origin.lat, origin.lng], zoomForRadius(radiusKm))
    const key = import.meta.env.VITE_GEOAPIFY_API_KEY as string | undefined
    const tiles = L.tileLayer(`https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${key ?? ''}`, {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | © <a href="https://openmaptiles.org/">OpenMapTiles</a> | © <a href="https://www.geoapify.com/">Geoapify</a>',
    }).addTo(map)
    let loaded = 0
    tiles.on('tileload', () => { loaded += 1 })
    tiles.on('load', () => { if (loaded === 0) setTileError(true) })
    circleRef.current = L.circle([origin.lat, origin.lng], {
      radius: radiusKm * 1000, color: '#2563eb', weight: 1.5, fillColor: '#3b82f6', fillOpacity: 0.08, interactive: false,
    }).addTo(map)
    originRef.current = L.circleMarker([origin.lat, origin.lng], {
      radius: 8, color: '#ffffff', weight: 3, fillColor: '#2563eb', fillOpacity: 1, interactive: false,
    }).addTo(map)
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    // 지연 로딩·그리드 배치 직후엔 컨테이너 크기가 0/변동일 수 있어, 크기가 바뀔 때마다 다시 잰다.
    const markUserInteraction = () => { userInteractedRef.current = true }
    const markZoomControlClick = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest('.leaflet-control-zoom a')) markUserInteraction()
    }
    boxRef.current.addEventListener('wheel', markUserInteraction, { passive: true })
    boxRef.current.addEventListener('click', markZoomControlClick)
    map.on('dragstart', markUserInteraction)
    const ro = new ResizeObserver(() => map.invalidateSize({ pan: !userInteractedRef.current }))
    ro.observe(boxRef.current)
    const box = boxRef.current
    return () => {
      ro.disconnect()
      box.removeEventListener('wheel', markUserInteraction)
      box.removeEventListener('click', markZoomControlClick)
      map.off('dragstart', markUserInteraction)
      map.remove()
      mapRef.current = null
    }
    // 지도는 최초 1회만 만든다 — 이후 변경은 아래 effect들이 반영.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 반경은 원만 바꾼다. 명시적인 지역·현재 위치 선택에서만 시점을 다시 맞춘다.
  const lastViewport = useRef({ origin, recenterRequest })
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    circleRef.current?.setLatLng([origin.lat, origin.lng]).setRadius(radiusKm * 1000)
    originRef.current?.setLatLng([origin.lat, origin.lng])
    originRef.current?.setStyle({ fillColor: originIsUser ? '#2563eb' : '#64748b' })
    const moved = lastViewport.current.origin.lat !== origin.lat || lastViewport.current.origin.lng !== origin.lng
      || lastViewport.current.recenterRequest !== recenterRequest
    lastViewport.current = { origin, recenterRequest }
    if (moved) {
      userInteractedRef.current = false
      map.setView([origin.lat, origin.lng], zoomForRadius(radiusKm))
    }
  }, [origin, originIsUser, radiusKm, recenterRequest])

  useEffect(() => {
    const layer = layerRef.current
    if (!layer) return
    layer.clearLayers()
    for (const m of markers) {
      const selected = m.id === selectedId
      L.marker([m.lat, m.lng], { icon: jobIcon(selected), title: m.label, zIndexOffset: selected ? 1000 : 0, keyboard: true })
        .on('click', () => onSelectRef.current(m.id))
        .addTo(layer)
    }
  }, [markers, selectedId])

  return (
    <div className="hme-map">
      <div ref={boxRef} className="hme-map__canvas" />
      {tileError && <div className="hme-map__notice">Không tải được bản đồ nền. Vui lòng thử lại sau.</div>}
    </div>
  )
}
