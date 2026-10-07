// 공고 상세 근무지역 지도 — 홈 생활지도와 같은 VietMap provider·스타일(applyLifeMapStyle), Bản đồ/Vệ tinh 전환 (2026-10-07).
// Geoapify/Leaflet은 쓰지 않는다. 핀은 "확인된 근무지(markers)"에만 찍고, 공단(KCN) 일대 표시(pinless)는 핀 없이 지도만 보여준다.
// 브라우저 전용 — JobDetail이 마운트 뒤 동적 import 한다(SSR 안전).
import * as vietmapgl from '@vietmap/vietmap-gl-js/dist/vietmap-gl.js'
import type { Map as VietMap, Marker, StyleSpecification } from '@vietmap/vietmap-gl-js/dist/vietmap-gl.js'
import '@vietmap/vietmap-gl-js/dist/vietmap-gl.css'
import { useEffect, useRef, useState } from 'react'
import { applyLifeMapStyle, type StyleLike } from './home/map/lifeMapStyle'
import { createVietMapStyleUrl, fetchVietMapStyle, type VietMapStyleKind } from './home/map/vietMapStyle'

export interface JobVietMapMarker { lat: number; lng: number; label?: string }

export interface JobVietMapProps {
  lat: number
  lng: number
  title: string
  zoom?: number
  /** 확인된 근무지 핀. pinless면 무시 */
  markers?: JobVietMapMarker[]
  /** true면 핀·원을 그리지 않고 그 일대 지도만 보여준다 */
  pinless?: boolean
  height?: number
}

const TILEMAP_KEY = (import.meta.env.VITE_VIETMAP_TILEMAP_KEY as string | undefined)?.trim() ?? ''

export default function JobVietMap({ lat, lng, title, zoom = 15, markers, pinless = false, height = 280 }: JobVietMapProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<VietMap | null>(null)
  const markerRefs = useRef<Marker[]>([])
  const [mode, setMode] = useState<VietMapStyleKind>('street')
  const shownMode = useRef<VietMapStyleKind>('street')
  const [failed, setFailed] = useState(false)
  // markers 배열은 렌더마다 새로 만들어지므로 내용 키로 비교(지도를 보던 중 중심이 되돌아가지 않게)
  const markersKey = JSON.stringify(markers ?? null)

  // 지도는 한 번만 만든다(공식 style을 받아 생활지도 변환 후 생성). 이동·핀은 아래 effect가 처리.
  useEffect(() => {
    const box = boxRef.current
    if (!box || !TILEMAP_KEY) return
    const controller = new AbortController()
    let map: VietMap | null = null
    // 터치 기기에서는 지도가 한 손가락 스크롤을 가로채 페이지가 안 내려가는 문제가 있어 드래그·핀치를 끄고 +/- 버튼만 쓴다.
    const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
    fetchVietMapStyle<StyleSpecification>(createVietMapStyleUrl(TILEMAP_KEY, 'street'), { signal: controller.signal })
      .then((official) => {
        if (controller.signal.aborted) return
        map = new vietmapgl.Map({
          container: box,
          style: applyLifeMapStyle(official as unknown as StyleLike, 'street') as unknown as StyleSpecification,
          center: [lng, lat],
          zoom,
          attributionControl: false,
          scrollZoom: false,
          dragPan: !coarse,
          touchZoomRotate: false,
          dragRotate: false,
        })
        map.addControl(new vietmapgl.NavigationControl({ showCompass: false }), 'top-left')
        map.addControl(new vietmapgl.AttributionControl({ compact: true }))
        mapRef.current = map
        syncMarkers()
      })
      .catch(() => { if (!controller.signal.aborted) setFailed(true) })
    return () => {
      controller.abort()
      markerRefs.current.forEach((m) => m.remove())
      markerRefs.current = []
      map?.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const syncMarkers = () => {
    const map = mapRef.current
    if (!map) return
    markerRefs.current.forEach((m) => m.remove())
    markerRefs.current = []
    if (pinless) return
    const list = markers && markers.length > 0 ? markers : [{ lat, lng }]
    markerRefs.current = list.map((m) =>
      new vietmapgl.Marker({ color: '#e53935' }).setLngLat([m.lng, m.lat]).setPopup(new vietmapgl.Popup({ offset: 24 }).setText(m.label || title)).addTo(map))
    if (list.length > 1) {
      const b = new vietmapgl.LngLatBounds()
      list.forEach((m) => b.extend([m.lng, m.lat]))
      map.fitBounds(b, { padding: 40, maxZoom: 16 })
    }
  }

  useEffect(() => {
    mapRef.current?.jumpTo({ center: [lng, lat], zoom })
    syncMarkers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, zoom, pinless, markersKey])

  useEffect(() => {
    const map = mapRef.current
    if (!map || shownMode.current === mode) return
    shownMode.current = mode
    // diff:false — 일반↔위성은 source 구성이 달라 전체 교체가 안전하다(홈 지도와 같은 방식).
    map.setStyle(createVietMapStyleUrl(TILEMAP_KEY, mode), {
      diff: false,
      transformStyle: (previous, next) => applyLifeMapStyle(next as unknown as StyleLike, mode, previous as unknown as StyleLike) as unknown as StyleSpecification,
    })
  }, [mode])

  if (!TILEMAP_KEY || failed) {
    return <p className="job-location-map__error">Không thể tải bản đồ.</p>
  }
  return (
    <div className="jd2-vmap" style={{ height }}>
      <div ref={boxRef} className="jd2-vmap__canvas" />
      <div className="jd2-vmap__modes" role="group" aria-label="Kiểu bản đồ">
        {(['street', 'satellite'] as const).map((k) => (
          <button key={k} type="button" aria-pressed={mode === k} onClick={() => setMode(k)}>
            {k === 'street' ? 'Bản đồ' : 'Vệ tinh'}
          </button>
        ))}
      </div>
    </div>
  )
}
