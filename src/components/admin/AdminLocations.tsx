import { lazy, Suspense, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

// 근무지 좌표 후보 검토·승인(2026-09-29). 승인된 위치만 사이트의 지도 핀·길찾기·내 주변 거리에
// 쓰인다. 공단·지역 중심(place_precision='area')은 DB에서 승인 자체가 막힌다.
const JobLocationMap = lazy(() => import('../JobLocationMap'))

export interface LocationCandidate {
  id: number
  job_id: number
  job_title: string
  job_active: boolean
  current_company: string
  current_location: string
  company_snapshot: string
  address_snapshot: string
  lat: number
  lng: number
  place_precision: 'entrance' | 'building' | 'site' | 'area'
  source: string
  evidence: string
  evidence_urls: string[]
  status: 'pending' | 'approved' | 'rejected' | 'revoked'
  review_note: string | null
  reviewed_at: string | null
  created_at: string
  address_still_present: boolean
}

const PRECISION_LABEL: Record<LocationCandidate['place_precision'], string> = {
  entrance: 'Cổng/lối vào',
  building: 'Tòa nhà/xưởng',
  site: 'Khu đất của công ty',
  area: 'Khu công nghiệp/khu vực — không thể duyệt',
}

export function AdminLocations() {
  const [items, setItems] = useState<LocationCandidate[]>([])
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const [error, setError] = useState('')
  const reload = async () => {
    const { data, error: e } = await supabase.rpc('admin_list_location_candidates')
    if (e) setError(e.message)
    else setItems((data ?? []) as LocationCandidate[])
  }
  useEffect(() => { void reload() }, [])

  async function review(c: LocationCandidate, action: 'approve' | 'reject' | 'revoke') {
    const note = window.prompt(
      action === 'approve' ? 'Ghi chú duyệt (bằng chứng đã kiểm tra):' : action === 'reject' ? 'Lý do từ chối:' : 'Lý do thu hồi:',
      '',
    )
    if (note === null) return
    const { error: e } = await supabase.rpc('admin_review_location_candidate', { p_candidate_id: c.id, p_action: action, p_note: note })
    if (e) setError(e.message)
    else { setError(''); await reload() }
  }

  const shown = items.filter((c) => filter === 'all' || c.status === 'pending')
  return <section className="admin-panel">
    <div className="admin-toolbar">
      <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
        <option value="pending">Chờ duyệt</option>
        <option value="all">Tất cả</option>
      </select>
      <small>Chỉ vị trí đã duyệt mới được dùng cho ghim bản đồ, chỉ đường và tìm việc gần tôi.</small>
    </div>
    {error && <p className="admin-error">{error}</p>}
    {shown.length === 0 && <p>Không có ứng viên vị trí.</p>}
    {shown.map((c) => {
      const companyChanged = c.company_snapshot.trim().toLowerCase() !== (c.current_company ?? '').trim().toLowerCase()
      const needsReview = companyChanged || !c.address_still_present
      const canApprove = (c.status === 'pending' || c.status === 'revoked') && c.place_precision !== 'area' && !needsReview
      return <article key={c.id} className="admin-location-card" style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <strong>#{c.job_id} · <a href={`/viec-lam/sb-${c.job_id}`} target="_blank" rel="noopener noreferrer">{c.job_title}</a></strong>
            <div><small>Công ty hiện tại: {c.current_company}{companyChanged && <b style={{ color: '#dc2626' }}> — khác lúc đề xuất ({c.company_snapshot}), cần xem lại</b>}</small></div>
          </div>
          <span className={`admin-badge admin-badge--${c.status}`}>{c.status}</span>
        </header>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16, marginTop: 12 }}>
          <div>
            <p><b>Địa chỉ trong tin:</b> {c.address_snapshot}
              {!c.address_still_present && <b style={{ color: '#dc2626' }}> — không còn trong tin hiện tại, cần xem lại</b>}</p>
            <p><b>Mức vị trí:</b> {PRECISION_LABEL[c.place_precision]} · <b>Nguồn tọa độ:</b> {c.source}</p>
            <p><b>Tọa độ:</b> {c.lat}, {c.lng} · <a href={`https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`} target="_blank" rel="noopener noreferrer">Google Maps ↗</a> · <a href={`https://www.openstreetmap.org/?mlat=${c.lat}&mlon=${c.lng}#map=18/${c.lat}/${c.lng}`} target="_blank" rel="noopener noreferrer">OSM ↗</a></p>
            <p style={{ whiteSpace: 'pre-wrap' }}><b>Bằng chứng:</b> {c.evidence}</p>
            {c.evidence_urls.length > 0 && <ul>{c.evidence_urls.map((u) => <li key={u}><a href={u} target="_blank" rel="noopener noreferrer">{u}</a></li>)}</ul>}
            {c.review_note && <p><b>Ghi chú duyệt:</b> {c.review_note}</p>}
            <div className="admin-actions">
              {canApprove && <button onClick={() => review(c, 'approve')}>Duyệt vị trí</button>}
              {c.status === 'pending' && <button onClick={() => review(c, 'reject')}>Từ chối</button>}
              {c.status === 'approved' && <button onClick={() => review(c, 'revoke')}>Thu hồi</button>}
            </div>
          </div>
          <div style={{ minHeight: 220 }}>
            <Suspense fallback={<p>Đang tải bản đồ…</p>}>
              <JobLocationMap lat={c.lat} lng={c.lng} title={c.job_title} zoom={17} />
            </Suspense>
          </div>
        </div>
      </article>
    })}
  </section>
}
