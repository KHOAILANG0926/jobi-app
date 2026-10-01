// 공고 등록/관리 화면의 근무지 핀 선택 지도(2026-10-01). 지도를 누르거나 핀을 끌어 실제 근무 위치를 정한다.
// leaflet은 window를 참조하므로 이 파일은 lazy import로만 불러온다.
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'

export interface PinPoint { lat: number; lng: number }

interface Props {
  value: PinPoint | null
  center: PinPoint
  onChange: (p: PinPoint) => void
}

const pinIcon = () => L.divIcon({ className: '', html: '<span class="hme-pin is-selected"></span>', iconSize: [30, 30], iconAnchor: [15, 30] })

export default function LocationPinPicker({ value, center, onChange }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!boxRef.current) return
    const start = value ?? center
    const map = L.map(boxRef.current, { scrollWheelZoom: false }).setView([start.lat, start.lng], value ? 16 : 13)
    const key = import.meta.env.VITE_GEOAPIFY_API_KEY as string | undefined
    L.tileLayer(`https://maps.geoapify.com/v1/tile/osm-carto/{z}/{x}/{y}.png?apiKey=${key ?? ''}`, {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | © <a href="https://www.geoapify.com/">Geoapify</a>',
    }).addTo(map)
    map.on('click', (e: L.LeafletMouseEvent) => onChangeRef.current({ lat: e.latlng.lat, lng: e.latlng.lng }))
    mapRef.current = map
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(boxRef.current)
    return () => { ro.disconnect(); map.remove(); mapRef.current = null; markerRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 선택값 → 핀 표시/이동/제거
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!value) { markerRef.current?.remove(); markerRef.current = null; return }
    if (!markerRef.current) {
      markerRef.current = L.marker([value.lat, value.lng], { icon: pinIcon(), draggable: true, keyboard: true, title: 'Vị trí làm việc' })
        .on('dragend', (e) => { const ll = (e.target as L.Marker).getLatLng(); onChangeRef.current({ lat: ll.lat, lng: ll.lng }) })
        .addTo(map)
    } else {
      markerRef.current.setLatLng([value.lat, value.lng])
    }
    if (!map.getBounds().contains([value.lat, value.lng])) map.panTo([value.lat, value.lng])
  }, [value])

  // 핀이 없을 때 주소가 바뀌어 중심 힌트가 바뀌면 그쪽으로 이동
  useEffect(() => {
    const map = mapRef.current
    if (map && !value) map.setView([center.lat, center.lng], 13)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng])

  return <div ref={boxRef} className="jcf-map" />
}
