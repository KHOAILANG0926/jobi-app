// 공고 상세 근무지역 지도 — 홈 생활지도와 같은 VietMap provider·스타일(applyLifeMapStyle), Bản đồ/Vệ tinh 전환 (2026-10-07).
// Geoapify/Leaflet은 쓰지 않는다. 핀은 "확인된 근무지(markers)"에만 찍고, 공단(KCN) 일대 표시(pinless)는 핀 없이 지도만 보여준다.
// "Phóng to" 버튼으로 공고 화면 안에서 전체화면 지도(모달)를 열어 주변 상가·건물(POI)을 본다. 닫으면 공고로 복귀.
// 브라우저 전용 — JobDetail이 마운트 뒤 동적 import 한다(SSR 안전).
import * as vietmapgl from '@vietmap/vietmap-gl-js/dist/vietmap-gl.js'
import type { Map as VietMap, Marker, StyleSpecification } from '@vietmap/vietmap-gl-js/dist/vietmap-gl.js'
import '@vietmap/vietmap-gl-js/dist/vietmap-gl.css'
import { useEffect, useRef, useState } from 'react'
import { applyLifeMapStyle, type StyleLike } from './home/map/lifeMapStyle'
import { createVietMapStyleUrl, fetchVietMapStyle, type VietMapStyleKind } from './home/map/vietMapStyle'
import { INDUSTRIAL_PARK_OUTLINES } from '../data/industrialParkOutlines'

export interface JobVietMapMarker { lat: number; lng: number; label?: string }
/** 길찾기 링크 — 승인된 근무지 좌표 또는 공단 중심 좌표(좌표로만, 이름 검색 금지). note는 버튼 아래 한 줄 안내 */
export interface JobVietMapDirection { label: string; href: string; note?: string }

export interface JobVietMapProps {
  lat: number
  lng: number
  title: string
  zoom?: number
  /** 확인된 근무지 핀. pinless면 무시 */
  markers?: JobVietMapMarker[]
  /** true면 핀·원을 그리지 않고 그 일대 지도만 보여준다 */
  pinless?: boolean
  /** 공단 영역 표시 — industrialParks.ts의 source.ref(way id). 있으면 그 윤곽(점선 테두리)·이름표를 그리고 윤곽 전체가 보이게 맞춘다 */
  parkRef?: string
  parkName?: string
  /** 전체화면(Phóng to)에서 보이는 길찾기 링크 */
  directions?: JobVietMapDirection[]
  height?: number
}

const TILEMAP_KEY = (import.meta.env.VITE_VIETMAP_TILEMAP_KEY as string | undefined)?.trim() ?? ''

/** 전체화면은 주변 상가·건물(POI)이 보이도록 더 가깝게 연다(생활지도 POI는 z15~16부터 표시). */
const FULLSCREEN_MIN_ZOOM = 16

interface CanvasProps extends Omit<JobVietMapProps, 'directions' | 'height'> {
  /** 전체화면: 휠 줌·드래그를 항상 켠다. 작은 지도는 페이지 스크롤을 막지 않게 휠 줌을 끈다. */
  interactive: boolean
}

function MapCanvas({ lat, lng, title, zoom = 15, markers, pinless = false, parkRef, parkName, interactive }: CanvasProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<VietMap | null>(null)
  const markerRefs = useRef<Marker[]>([])
  const [mode, setMode] = useState<VietMapStyleKind>('street')
  const shownMode = useRef<VietMapStyleKind>('street')
  const [failed, setFailed] = useState(false)
  // markers 배열은 렌더마다 새로 만들어지므로 내용 키로 비교(지도를 보던 중 중심이 되돌아가지 않게)
  const markersKey = JSON.stringify(markers ?? null)
  const outline = parkRef ? INDUSTRIAL_PARK_OUTLINES[parkRef] : undefined
  const outlineRef = useRef(outline)
  outlineRef.current = outline
  const nameRef = useRef(parkName ?? title)
  nameRef.current = parkName ?? title

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
      map.fitBounds(b, { padding: 40, maxZoom: 17 })
    }
  }

  // 공단 영역: 점선 테두리 + 옅은 면 + 이름표. 'home-' 접두 id라 Bản đồ↔Vệ tinh 전환 때 applyLifeMapStyle이 그대로 옮긴다.
  const addAreaLayers = (map: VietMap) => {
    const o = outlineRef.current
    if (!o || map.getSource('home-kcn-area')) return
    const font = (map.getStyle()?.layers ?? []).map((l) => (l.layout as Record<string, unknown> | undefined)?.['text-font']).find((f) => Array.isArray(f)) as string[] | undefined
    map.addSource('home-kcn-area', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [o.ring] } } })
    map.addSource('home-kcn-area-label', { type: 'geojson', data: { type: 'Feature', properties: { name: nameRef.current }, geometry: { type: 'Point', coordinates: [lng, lat] } } })
    map.addLayer({ id: 'home-kcn-area-fill', type: 'fill', source: 'home-kcn-area', paint: { 'fill-color': '#e53935', 'fill-opacity': 0.07 } })
    map.addLayer({ id: 'home-kcn-area-line', type: 'line', source: 'home-kcn-area', layout: { 'line-join': 'round' }, paint: { 'line-color': '#e53935', 'line-width': 2.5, 'line-dasharray': [3, 2] } })
    map.addLayer({
      id: 'home-kcn-area-label', type: 'symbol', source: 'home-kcn-area-label',
      layout: { 'text-field': ['get', 'name'], 'text-font': font ?? ['Noto Sans Regular'], 'text-size': 14, 'text-allow-overlap': true, 'text-anchor': 'center' },
      paint: { 'text-color': '#b71c1c', 'text-halo-color': '#ffffff', 'text-halo-width': 2 },
    })
  }

  const fitOutline = (map: VietMap) => {
    const o = outlineRef.current
    if (o) map.fitBounds([[o.bounds[0], o.bounds[1]], [o.bounds[2], o.bounds[3]]], { padding: 28, maxZoom: 16, duration: 0 })
  }

  // 지도는 한 번만 만든다(공식 style을 받아 생활지도 변환 후 생성). 이동·핀은 아래 effect가 처리.
  useEffect(() => {
    const box = boxRef.current
    if (!box || !TILEMAP_KEY) return
    const controller = new AbortController()
    let map: VietMap | null = null
    let resizeObserver: ResizeObserver | null = null
    // 터치 기기의 작은 지도는 한 손가락 스크롤을 가로채 페이지가 안 내려가므로 드래그·핀치를 끄고 +/- 버튼만 쓴다(전체화면은 항상 켬).
    const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
    const dragPan = interactive || !coarse
    fetchVietMapStyle<StyleSpecification>(createVietMapStyleUrl(TILEMAP_KEY, 'street'), { signal: controller.signal })
      .then((official) => {
        if (controller.signal.aborted) return
        map = new vietmapgl.Map({
          container: box,
          style: applyLifeMapStyle(official as unknown as StyleLike, 'street') as unknown as StyleSpecification,
          // 공단 영역이 있으면 윤곽 전체가 보이게(축소 배율), 없으면 지정한 중심·배율
          ...(outlineRef.current
            ? { bounds: outlineRef.current.bounds, fitBoundsOptions: { padding: 28, maxZoom: 16 } }
            : { center: [lng, lat] as [number, number], zoom }),
          attributionControl: false,
          scrollZoom: interactive,
          dragPan,
          touchZoomRotate: interactive,
          dragRotate: false,
        })
        map.addControl(new vietmapgl.NavigationControl({ showCompass: false }), 'top-left')
        map.addControl(new vietmapgl.AttributionControl({ compact: true }))
        if (interactive) map.touchZoomRotate.disableRotation()
        mapRef.current = map
        const created = map
        created.on('style.load', () => addAreaLayers(created))
        // 컨테이너 크기가 나중에 바뀌어도(레이아웃 확정·모달 열림) 캔버스를 다시 맞춘다 — 홈 지도와 같은 방식.
        resizeObserver = new ResizeObserver(() => map?.resize())
        resizeObserver.observe(box)
        map.resize()
        syncMarkers()
      })
      .catch(() => { if (!controller.signal.aborted) setFailed(true) })
    return () => {
      controller.abort()
      resizeObserver?.disconnect()
      markerRefs.current.forEach((m) => m.remove())
      markerRefs.current = []
      map?.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (map) { if (outlineRef.current) fitOutline(map); else map.jumpTo({ center: [lng, lat], zoom }) }
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
    <>
      {/* 벤더 CSS(.maplibregl-map 등)가 늦게 로드돼 position/size를 덮어쓰지 않도록 인라인으로 고정한다(관리자 지도와 같은 방식). */}
      <div ref={boxRef} className="jd2-vmap__canvas" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' }} />
      <div className="jd2-vmap__modes" role="group" aria-label="Kiểu bản đồ">
        {(['street', 'satellite'] as const).map((k) => (
          <button key={k} type="button" aria-pressed={mode === k} onClick={() => setMode(k)}>
            {k === 'street' ? 'Bản đồ' : 'Vệ tinh'}
          </button>
        ))}
      </div>
    </>
  )
}

export default function JobVietMap({ lat, lng, title, zoom = 15, markers, pinless = false, parkRef, parkName, directions, height = 280 }: JobVietMapProps) {
  const [open, setOpen] = useState(false)

  // 전체화면: Esc로 닫기, 배경 페이지 스크롤 잠금. 닫으면 공고 화면(스크롤 위치 포함)으로 그대로 복귀.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open])

  return (
    <>
      <div className="jd2-vmap" style={{ height }}>
        <MapCanvas lat={lat} lng={lng} title={title} zoom={zoom} markers={markers} pinless={pinless} parkRef={parkRef} parkName={parkName} interactive={false} />
        <button type="button" className="jd2-vmap__zoom" onClick={() => setOpen(true)}>Phóng to</button>
      </div>
      {open && (
        <div className="jd2-vmap-modal" role="dialog" aria-modal="true" aria-label={`Bản đồ — ${title}`}>
          <div className="jd2-vmap-modal__bar">
            <strong className="jd2-vmap-modal__title">{title}</strong>
            {directions?.map((d) => (
              <a key={d.href} className="jd2-vmap-modal__dir" href={d.href} target="_blank" rel="noopener noreferrer">{d.label}</a>
            ))}
            <button type="button" className="jd2-vmap-modal__close" onClick={() => setOpen(false)} autoFocus>Đóng</button>
          </div>
          <div className="jd2-vmap-modal__map">
            <MapCanvas lat={lat} lng={lng} title={title} zoom={parkRef || pinless ? zoom : Math.max(zoom, FULLSCREEN_MIN_ZOOM)} markers={markers} pinless={pinless} parkRef={parkRef} parkName={parkName} interactive />
          </div>
          <p className="jd2-vmap-modal__hint">
            {pinless ? 'Vị trí chính xác chưa xác minh — bản đồ chỉ cho biết khu vực lân cận. ' : ''}
            {directions?.map((d) => d.note).filter(Boolean).join(' ')}{directions?.some((d) => d.note) ? ' ' : ''}Phóng to để xem cửa hàng, tòa nhà xung quanh.
          </p>
        </div>
      )}
    </>
  )
}
