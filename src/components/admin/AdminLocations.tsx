import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { listAdminJobs, type AdminJob } from '../../lib/adminOperations'
import type { AdminMapMarker, AdminMapPick } from './AdminVietMap'
import { AdminAutoLocate } from './AdminAutoLocate'
import { AdminWardLocate } from './AdminWardLocate'

// 근무지 좌표 후보 검토·승인(2026-09-29). 승인된 위치만 사이트의 지도 핀·길찾기·내 주변 거리에
// 쓰인다. 공단·지역 중심(place_precision='area')은 DB에서 승인 자체가 막힌다.
// 2026-10-06: 후보를 VietMap 일반지도·위성에서 보고 승인·거절 1클릭(메모는 선택). 지도에 후보가 없으면
// 관리자가 지도·위성을 직접 찍어 후보를 추가(+바로 승인)한다 — 기존 RPC(admin_add/admin_review)만 사용.
// 자동 후보(scripts/generate-location-candidates.ts, source=map_listing)는 근거에 VietMap POI·주소 일치 여부가 적힌다.
const AdminVietMap = lazy(() => import('./AdminVietMap'))

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

const SOURCE_LABEL: Record<string, string> = {
  map_listing: 'Bản đồ VietMap (cửa hàng/công ty)',
  company_official: 'Thông tin chính thức của công ty',
  original_post: 'Tin tuyển dụng gốc',
  site_visit: 'Khảo sát thực tế',
  other: 'Khác (chọn trên ảnh vệ tinh…)',
}

const DEFAULT_APPROVE_NOTE = 'Đã đối chiếu trên bản đồ VietMap/vệ tinh'
const DEFAULT_CENTER = { lat: 21.1861, lng: 106.0763 } // Bắc Ninh

const mapFallback = <p>Đang tải bản đồ…</p>

/**
 * 화면에 보이는 카드에서만 지도를 만든다(2026-10-07). 후보가 33건이 되자 카드마다 WebGL 지도를 동시에 만들어
 * 브라우저의 WebGL 컨텍스트 한도(Chrome 약 16개)를 넘었고, 오래된 지도부터 캔버스가 사라져 핀(점)만 남았다.
 * 화면 밖으로 나가면 지도를 해제해 동시에 열려 있는 지도 수를 몇 개로 묶는다.
 */
function VisibleOnly({ children, height = 260 }: { children: React.ReactNode; height?: number }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = boxRef.current
    if (!el || typeof IntersectionObserver === 'undefined') { setVisible(true); return }
    const io = new IntersectionObserver((entries) => setVisible(entries.some((e) => e.isIntersecting)), { rootMargin: '150px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return <div ref={boxRef} style={{ minHeight: height }}>{visible ? children : null}</div>
}

export function AdminLocations() {
  const [items, setItems] = useState<LocationCandidate[]>([])
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const [error, setError] = useState('')
  const [notes, setNotes] = useState<Record<number, string>>({})
  const [busyId, setBusyId] = useState<number | null>(null)
  const [manualOpen, setManualOpen] = useState(false)
  const reload = async () => {
    const { data, error: e } = await supabase.rpc('admin_list_location_candidates')
    if (e) setError(e.message)
    else setItems((data ?? []) as LocationCandidate[])
  }
  useEffect(() => { void reload() }, [])

  // 1클릭: 메모 칸은 선택(비우면 승인은 기본 문구, 거절·철회는 빈 메모).
  async function review(c: LocationCandidate, action: 'approve' | 'reject' | 'revoke') {
    const typed = (notes[c.id] ?? '').trim()
    const note = typed || (action === 'approve' ? DEFAULT_APPROVE_NOTE : '')
    setBusyId(c.id)
    const { error: e } = await supabase.rpc('admin_review_location_candidate', { p_candidate_id: c.id, p_action: action, p_note: note })
    setBusyId(null)
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
      <button type="button" onClick={() => setManualOpen((v) => !v)}>{manualOpen ? 'Đóng' : '＋ Tự chọn vị trí trên bản đồ'}</button>
      <small>Chỉ vị trí đã duyệt mới được dùng cho ghim bản đồ, chỉ đường và tìm việc gần tôi.</small>
    </div>
    <AdminAutoLocate onChanged={reload} />
    <AdminWardLocate />
    {error && <p className="admin-error">{error}</p>}
    {manualOpen && <ManualLocationPanel candidates={items} onDone={async () => { setError(''); await reload() }} onError={setError} />}
    {shown.length === 0 && <p>Không có ứng viên vị trí.</p>}
    {shown.map((c) => {
      const companyChanged = c.company_snapshot.trim().toLowerCase() !== (c.current_company ?? '').trim().toLowerCase()
      const needsReview = companyChanged || !c.address_still_present
      const canApprove = (c.status === 'pending' || c.status === 'revoked') && c.place_precision !== 'area' && !needsReview
      const busy = busyId === c.id
      return <article key={c.id} className="admin-location-card" style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <strong>#{c.job_id} · <a href={`/viec-lam/sb-${c.job_id}`} target="_blank" rel="noopener noreferrer">{c.job_title}</a></strong>
            <div><small>Công ty hiện tại: {c.current_company}{companyChanged && <b style={{ color: '#dc2626' }}> — khác lúc đề xuất ({c.company_snapshot}), cần xem lại</b>}</small></div>
          </div>
          <span className={`admin-badge admin-badge--${c.status}`}>{c.status}</span>
        </header>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 12 }}>
          <div>
            <p><b>Địa chỉ trong tin:</b> {c.address_snapshot}
              {!c.address_still_present && <b style={{ color: '#dc2626' }}> — không còn trong tin hiện tại, cần xem lại</b>}</p>
            <p><b>Mức vị trí:</b> {PRECISION_LABEL[c.place_precision]} · <b>Nguồn tọa độ:</b> {SOURCE_LABEL[c.source] ?? c.source}</p>
            <p><b>Tọa độ:</b> {c.lat.toFixed(6)}, {c.lng.toFixed(6)}</p>
            <p style={{ whiteSpace: 'pre-wrap' }}><b>Bằng chứng:</b> {c.evidence}</p>
            {c.evidence_urls.length > 0 && <ul>{c.evidence_urls.map((u) => <li key={u}><a href={u} target="_blank" rel="noopener noreferrer">{u}</a></li>)}</ul>}
            {c.review_note && <p><b>Ghi chú duyệt:</b> {c.review_note}</p>}
            {(canApprove || c.status === 'pending' || c.status === 'approved') && (
              <input type="text" placeholder="Ghi chú (không bắt buộc)" value={notes[c.id] ?? ''} disabled={busy}
                onChange={(e) => setNotes((n) => ({ ...n, [c.id]: e.target.value }))} style={{ width: '100%', marginBottom: 8 }} />
            )}
            <div className="admin-actions">
              {canApprove && <button disabled={busy} onClick={() => review(c, 'approve')}>Duyệt vị trí</button>}
              {c.status === 'pending' && <button disabled={busy} onClick={() => review(c, 'reject')}>Từ chối</button>}
              {c.status === 'approved' && <button disabled={busy} onClick={() => review(c, 'revoke')}>Thu hồi</button>}
            </div>
          </div>
          <VisibleOnly>
            <Suspense fallback={mapFallback}>
              <AdminVietMap center={{ lat: c.lat, lng: c.lng }} markers={[{ id: String(c.id), lat: c.lat, lng: c.lng, label: c.job_title, status: c.status }]} />
            </Suspense>
          </VisibleOnly>
        </div>
      </article>
    })}
  </section>
}

interface WorkLocationRow { id: number; raw_address: string | null; lat: number | null; lng: number | null }

/** 지도에 후보가 없을 때: 공고·주소를 고르고 VietMap 지도·위성을 찍어 후보 추가(+바로 승인). */
function ManualLocationPanel({ candidates, onDone, onError }: { candidates: LocationCandidate[]; onDone: () => Promise<void>; onError: (m: string) => void }) {
  const [jobs, setJobs] = useState<AdminJob[]>([])
  const [query, setQuery] = useState('')
  const [jobId, setJobId] = useState<number | null>(null)
  const [jobLocation, setJobLocation] = useState('')
  const [locations, setLocations] = useState<WorkLocationRow[]>([])
  const [address, setAddress] = useState('')
  const [pick, setPick] = useState<AdminMapPick | null>(null)
  const [precision, setPrecision] = useState<'building' | 'site' | 'entrance'>('building')
  const [source, setSource] = useState('map_listing')
  const [evidence, setEvidence] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { listAdminJobs().then(setJobs).catch((e: Error) => onError(e.message)) }, [onError])

  useEffect(() => {
    setLocations([]); setAddress(''); setPick(null); setJobLocation('')
    if (jobId === null) return
    void Promise.all([
      supabase.from('job_work_locations').select('id,raw_address,lat,lng').eq('job_id', jobId).order('sort_order'),
      supabase.from('local_jobs').select('location').eq('id', jobId).single(),
    ]).then(([locs, job]) => {
      const rows = (locs.data ?? []) as WorkLocationRow[]
      setLocations(rows)
      setJobLocation(String(job.data?.location ?? ''))
      setAddress(rows.find((r) => r.raw_address)?.raw_address ?? String(job.data?.location ?? ''))
    })
  }, [jobId])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return jobs.slice(0, 20)
    return jobs.filter((j) => String(j.id) === q || j.title.toLowerCase().includes(q) || j.company.toLowerCase().includes(q)).slice(0, 20)
  }, [jobs, query])
  const job = jobs.find((j) => j.id === jobId) ?? null
  const addressOptions = [...new Set([...locations.map((l) => l.raw_address ?? '').filter(Boolean), jobLocation].filter(Boolean))]
  const focus = locations.find((l) => l.raw_address === address && l.lat !== null && l.lng !== null)
  const center = pick ?? (focus ? { lat: focus.lat as number, lng: focus.lng as number } : DEFAULT_CENTER)
  const jobCandidates = candidates.filter((c) => c.job_id === jobId)
  const markers: AdminMapMarker[] = [
    ...jobCandidates.map((c) => ({ id: String(c.id), lat: c.lat, lng: c.lng, label: `#${c.id} ${c.status}`, status: c.status })),
    ...(pick ? [{ id: 'picked', lat: pick.lat, lng: pick.lng, label: pick.poiName ?? 'Vị trí đã chọn', status: 'picked' as const }] : []),
  ]

  const onPick = (p: AdminMapPick) => {
    setPick(p)
    setSource(p.poiName ? 'map_listing' : 'other')
    setEvidence(p.poiName ? `Chọn trên bản đồ VietMap: ${p.poiName}` : 'Chọn thủ công trên bản đồ/ảnh vệ tinh VietMap')
  }

  async function save(approve: boolean) {
    if (!job || !pick || !address.trim() || !evidence.trim()) { onError('Chọn tin, địa chỉ, vị trí trên bản đồ và nhập bằng chứng.'); return }
    setSaving(true)
    const workLocationId = locations.find((l) => l.raw_address === address)?.id ?? null
    const { data, error } = await supabase.rpc('admin_add_location_candidate', {
      p_job_id: job.id, p_address: address, p_lat: pick.lat, p_lng: pick.lng, p_precision: precision,
      p_source: source, p_evidence: evidence, p_evidence_urls: [], p_work_location_id: workLocationId,
    })
    let failure = error?.message ?? ''
    if (!failure && approve) {
      const added = data as { id: number } | null
      const r = added ? await supabase.rpc('admin_review_location_candidate', { p_candidate_id: added.id, p_action: 'approve', p_note: DEFAULT_APPROVE_NOTE }) : null
      failure = r?.error?.message ?? (added ? '' : 'Không nhận được ứng viên vừa thêm.')
    }
    setSaving(false)
    if (failure) { onError(failure); return }
    setPick(null)
    await onDone()
  }

  return <div style={{ border: '1px dashed #94a3b8', borderRadius: 12, padding: 16, marginBottom: 16 }}>
    <h3 style={{ marginTop: 0 }}>Tự chọn vị trí trên bản đồ</h3>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input type="search" placeholder="Tìm tin: mã, tiêu đề hoặc công ty" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={jobId ?? ''} onChange={(e) => setJobId(e.target.value ? Number(e.target.value) : null)}>
          <option value="">— Chọn tin —</option>
          {matches.map((j) => <option key={j.id} value={j.id}>#{j.id} · {j.company} · {j.title}</option>)}
        </select>
        {job && <>
          <label>Địa chỉ trong tin
            <select value={address} onChange={(e) => setAddress(e.target.value)} style={{ width: '100%' }}>
              {addressOptions.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label>Mức vị trí
            <select value={precision} onChange={(e) => setPrecision(e.target.value as typeof precision)} style={{ width: '100%' }}>
              <option value="building">{PRECISION_LABEL.building}</option>
              <option value="site">{PRECISION_LABEL.site}</option>
              <option value="entrance">{PRECISION_LABEL.entrance}</option>
            </select>
          </label>
          <label>Nguồn tọa độ
            <select value={source} onChange={(e) => setSource(e.target.value)} style={{ width: '100%' }}>
              {Object.entries(SOURCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label>Bằng chứng
            <textarea rows={3} value={evidence} onChange={(e) => setEvidence(e.target.value)} style={{ width: '100%' }} />
          </label>
          <p style={{ margin: 0 }}><small>{pick ? `Đã chọn: ${pick.lat.toFixed(6)}, ${pick.lng.toFixed(6)}${pick.poiName ? ` · ${pick.poiName}` : ''}` : 'Bấm lên bản đồ hoặc ảnh vệ tinh để chọn vị trí.'}</small></p>
          <div className="admin-actions">
            <button type="button" disabled={saving || !pick} onClick={() => save(false)}>Thêm ứng viên</button>
            <button type="button" disabled={saving || !pick} onClick={() => save(true)}>Thêm và duyệt</button>
          </div>
        </>}
      </div>
      {job && (
        <Suspense fallback={mapFallback}>
          <AdminVietMap center={center} zoom={focus || pick ? 17 : 12} markers={markers} onPick={onPick} height={360} />
        </Suspense>
      )}
    </div>
  </div>
}
