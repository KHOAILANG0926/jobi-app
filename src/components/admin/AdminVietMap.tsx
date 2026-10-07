// 관리자 근무지 좌표 검토용 VietMap 지도 (2026-10-06).
// 후보 위치를 VietMap 일반지도·위성(Hybrid)에서 확인하고, 필요하면 지도·위성을 클릭해 위치를 직접 찍는다.
// 클릭 지점에 VietMap 상가·회사(POI)가 있으면 그 이름을 함께 넘긴다(근거 기록용).
import * as vietmapgl from '@vietmap/vietmap-gl-js/dist/vietmap-gl.js'
import type { Map as VietMap, Marker, StyleSpecification } from '@vietmap/vietmap-gl-js/dist/vietmap-gl.js'
import '@vietmap/vietmap-gl-js/dist/vietmap-gl.css'
import { useEffect, useRef, useState } from 'react'
import { applyLifeMapStyle, type StyleLike } from '../home/map/lifeMapStyle'
import { createVietMapStyleUrl, fetchVietMapStyle, type VietMapStyleKind } from '../home/map/vietMapStyle'

export interface AdminMapMarker {
  id: string
  lat: number
  lng: number
  label: string
  status: 'pending' | 'approved' | 'rejected' | 'revoked' | 'picked'
}

export interface AdminMapPick { lat: number; lng: number; poiName: string | null }

interface Props {
  center: { lat: number; lng: number }
  zoom?: number
  markers: AdminMapMarker[]
  onPick?: (pick: AdminMapPick) => void
  height?: number
}

const MARKER_COLOR: Record<AdminMapMarker['status'], string> = {
  pending: '#f59e0b', approved: '#16a34a', rejected: '#94a3b8', revoked: '#94a3b8', picked: '#2563eb',
}

const TILEMAP_KEY = (import.meta.env.VITE_VIETMAP_TILEMAP_KEY as string | undefined)?.trim() ?? ''

export default function AdminVietMap({ center, zoom = 17, markers, onPick, height = 260 }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<VietMap | null>(null)
  const markerRefs = useRef<Marker[]>([])
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick
  const [mode, setMode] = useState<VietMapStyleKind>('street')
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  // ?mapDebug=1일 때만 지도 아래에 표시: 클릭 수신 횟수·조회 오류(실제 PC 클릭 문제 추적용)
  const debug = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mapDebug') === '1'
  const [diag, setDiag] = useState<{ clicks: number; lastError: string }>({ clicks: 0, lastError: '' })

  useEffect(() => {
    const box = boxRef.current
    if (!box || !TILEMAP_KEY) return
    const controller = new AbortController()
    let map: VietMap | null = null
    // 공식 style을 받아 홈·상세와 같은 생활지도 변환(applyLifeMapStyle)을 적용해 만든다(2026-10-07).
    // 공식 style 그대로는 회사·ATM·상점 POI가 z18부터, 글씨도 옅어서 검토 지도 기본 배율(z17)에서 길 이름·POI 이름이 거의 안 보였다.
    fetchVietMapStyle<StyleSpecification>(createVietMapStyleUrl(TILEMAP_KEY, 'street'), { signal: controller.signal })
      .then((official) => {
        if (controller.signal.aborted) return
        map = new vietmapgl.Map({
          container: box,
          style: applyLifeMapStyle(official as unknown as StyleLike, 'street') as unknown as StyleSpecification,
          center: [center.lng, center.lat],
          zoom,
          attributionControl: false,
        })
        map.addControl(new vietmapgl.NavigationControl({ showCompass: false }), 'top-left')
        map.addControl(new vietmapgl.AttributionControl({ compact: true }))
        map.touchZoomRotate.disableRotation()
        map.on('click', (e) => {
          setDiag((d) => ({ ...d, clicks: d.clicks + 1 }))
          if (!onPickRef.current) return
          // 상가·회사(POI) 이름 조회는 보조 정보다. 스타일을 다시 불러오는 중이거나 조회가 실패해도
          // 클릭한 좌표는 항상 넘긴다(예전에는 여기서 예외가 나면 핀·좌표·버튼이 전부 사라졌다).
          let name = ''
          try {
            const layers = map?.getStyle()?.layers ?? []
            const poiLayers = layers
              .filter((l) => l.type === 'symbol' && (l as { 'source-layer'?: string })['source-layer'] === 'poi')
              .map((l) => l.id)
            const poi = poiLayers.length ? map?.queryRenderedFeatures([e.point.x, e.point.y], { layers: poiLayers })[0] : undefined
            name = String(poi?.properties?.name ?? '').trim()
          } catch (error) {
            setDiag((d) => ({ ...d, lastError: error instanceof Error ? error.message : String(error) }))
          }
          onPickRef.current({ lat: e.lngLat.lat, lng: e.lngLat.lng, poiName: name || null })
        })
        mapRef.current = map
        setReady(true)
      })
      .catch((error) => { if (!controller.signal.aborted) { setFailed(true); setDiag((d) => ({ ...d, lastError: error instanceof Error ? error.message : String(error) })) } })
    return () => {
      controller.abort()
      markerRefs.current.forEach((m) => m.remove()); markerRefs.current = []
      map?.remove(); mapRef.current = null; setReady(false)
    }
    // 지도는 한 번만 만든다. 중심 이동은 아래 effect가 처리.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { mapRef.current?.jumpTo({ center: [center.lng, center.lat] }) }, [center.lat, center.lng])

  const shownMode = useRef<VietMapStyleKind>('street')
  useEffect(() => {
    if (!mapRef.current || !TILEMAP_KEY || shownMode.current === mode) return
    shownMode.current = mode
    // diff:false — 일반↔위성은 source 구성이 달라 전체 교체가 안전하다(홈·상세 지도와 같은 방식).
    mapRef.current.setStyle(createVietMapStyleUrl(TILEMAP_KEY, mode), {
      diff: false,
      transformStyle: (previous, next) => applyLifeMapStyle(next as unknown as StyleLike, mode, previous as unknown as StyleLike) as unknown as StyleSpecification,
    })
  }, [mode, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    markerRefs.current.forEach((m) => m.remove())
    markerRefs.current = markers.map((m) => {
      const el = document.createElement('div')
      el.title = m.label
      el.style.cssText = `width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45);background:${MARKER_COLOR[m.status]}`
      return new vietmapgl.Marker({ element: el }).setLngLat([m.lng, m.lat]).addTo(map)
    })
  }, [markers, ready])

  if (!TILEMAP_KEY) {
    return <p style={{ padding: 12, background: '#fff7ed', borderRadius: 8 }}>Thiếu khóa bản đồ VietMap (VITE_VIETMAP_TILEMAP_KEY) — không hiển thị được bản đồ.</p>
  }
  if (failed) {
    return <p style={{ padding: 12, background: '#fff7ed', borderRadius: 8 }}>Bản đồ tạm thời không tải được.</p>
  }
  return (
    <div style={{ position: 'relative', height, borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
      <div ref={boxRef} style={{ position: 'absolute', inset: 0, cursor: onPick ? 'crosshair' : undefined }} />
      <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 2, display: 'flex', background: '#fff', borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
        {(['street', 'satellite'] as const).map((k) => (
          <button key={k} type="button" aria-pressed={mode === k} onClick={() => setMode(k)}
            style={{ border: 0, padding: '6px 10px', fontSize: 12, fontWeight: 600, background: mode === k ? '#0f172a' : '#fff', color: mode === k ? '#fff' : '#0f172a' }}>
            {k === 'street' ? 'Bản đồ' : 'Vệ tinh'}
          </button>
        ))}
      </div>
      {debug && (
        <pre style={{ position: 'absolute', left: 6, right: 6, bottom: 6, zIndex: 2, margin: 0, padding: '4px 6px', background: 'rgba(15,23,42,.82)', color: '#a7f3d0', font: '11px/1.35 monospace', borderRadius: 6, pointerEvents: 'none', whiteSpace: 'pre-wrap' }}>
          {`map clicks=${diag.clicks} · pick handler=${onPick ? 'on' : 'off'} · style=${mode}${diag.lastError ? `
last error: ${diag.lastError}` : ''}`}
        </pre>
      )}
    </div>
  )
}
