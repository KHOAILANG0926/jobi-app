// Lee 2026-10-30: 공고 등록 화면 지도도 상세·관리자와 같은 VietMap으로(이전 Leaflet+Geoapify 대체).
// 지도를 누르면 그 자리에 핀(빨간 물방울)을 둔다. 주소 검색·Google 링크는 2단계(서버 한도 보호 후).
import { lazy, Suspense, useMemo } from 'react'
import type { PinPoint } from './LocationPinPicker'

const AdminVietMap = lazy(() => import('../admin/AdminVietMap'))

export default function VietMapPinPicker({ value, center, onChange }: { value: PinPoint | null; center: PinPoint; onChange: (p: PinPoint) => void }) {
  const markers = useMemo(() => value ? [{ id: 'pin', lat: value.lat, lng: value.lng, label: 'Vị trí làm việc', status: 'picked' as const }] : [], [value])
  return (
    <Suspense fallback={<div className="jcf-map jcf-map--loading">Đang tải bản đồ…</div>}>
      <AdminVietMap center={value ?? center} zoom={value ? 16 : 13} markers={markers}
        onPick={(p) => onChange({ lat: p.lat, lng: p.lng })} height={280} markerClassName="hme-pin is-selected" />
    </Suspense>
  )
}
