import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { callAdminVietmap } from '../../lib/adminVietmapClient'
import { findIndustrialPark } from '../../lib/industrialPark'
import {
  CHOTOT_ID_MAX, CHOTOT_ID_MIN, NO_PIN_LABEL, runAutoLocate,
  type AutoLocateDeps, type AutoLocateJob, type AutoLocateSummary, type ExistingCandidate, type SearchCache,
} from '../../lib/chototAutoLocate'

// Vị trí 탭 "Tìm vị trí tự động (chotot)" (2026-10-08).
// 관리자가 누르면 chotot 공고(ID 4685~4784)의 근무 회사를 서버 API(/api/admin-vietmap)로 VietMap Search/Place 검색하고,
// 자동 승인 기준(회사명 정확 일치 + 주소의 구·KCN 안, 법인 등록 주소형 POI 제외)에 맞는 것만 승인 좌표로 반영한다. 나머지는 핀 없음.
// 하루 250회는 서버가 센다. 한도에 닿으면 멈추고, 다음 날 같은 버튼으로 이어서 실행한다(응답 캐시는 비공개 저장소).

const CACHE_KIND = 'autolocate'
const CACHE_NAME = 'chotot_search_cache'
const DEFAULT_APPROVE_NOTE = 'Tự động duyệt (chotot)'

const STOP_TEXT: Record<AutoLocateSummary['stopped'], string> = {
  done: 'Đã xử lý xong tất cả tin.',
  daily_limit: 'Đã chạm giới hạn 250 lượt/ngày — dừng lại. Ngày mai bấm lại nút này để chạy tiếp (các kết quả đã tra được lưu lại).',
  user: 'Đã dừng theo yêu cầu. Bấm lại để chạy tiếp.',
  error: 'Dừng do lỗi.',
}

interface WorkLocationRow { id: number; job_id: number; raw_address: string | null; lat: number | null; lng: number | null }
interface CandidateRow { id: number; job_id: number; address_snapshot: string; lat: number; lng: number; status: string }

async function loadJobs(): Promise<AutoLocateJob[]> {
  const { data: jobRows, error: jobError } = await supabase
    .from('local_jobs').select('id,company,location').gte('id', CHOTOT_ID_MIN).lte('id', CHOTOT_ID_MAX).order('id')
  if (jobError) throw new Error(jobError.message)
  const jobs = (jobRows ?? []) as Array<{ id: number; company: string | null; location: string | null }>
  if (jobs.length === 0) return []
  const ids = jobs.map((j) => j.id)
  const [{ data: locRows, error: locError }, { data: candRows, error: candError }] = await Promise.all([
    supabase.from('job_work_locations').select('id,job_id,raw_address,lat,lng,sort_order').in('job_id', ids).order('sort_order'),
    supabase.rpc('admin_list_location_candidates'),
  ])
  if (locError) throw new Error(locError.message)
  if (candError) throw new Error(candError.message)
  const locs = (locRows ?? []) as WorkLocationRow[]
  const candidates = ((candRows ?? []) as CandidateRow[]).filter((c) => c.job_id >= CHOTOT_ID_MIN && c.job_id <= CHOTOT_ID_MAX)
  return jobs.map((j) => {
    const location = String(j.location ?? '')
    const mine = locs.filter((l) => l.job_id === j.id)
    const rows = mine.length > 0 ? mine : [{ id: null as number | null, raw_address: location, lat: null, lng: null }]
    const targets = rows.map((l) => {
      const address = String(l.raw_address ?? '')
      const hasPoint = typeof l.lat === 'number' && typeof l.lng === 'number'
      const park = hasPoint ? undefined : findIndustrialPark(address, location)
      return {
        workLocationId: l.id,
        address,
        focus: hasPoint ? { lat: l.lat as number, lng: l.lng as number } : park ? { lat: park.lat, lng: park.lng } : null,
      }
    })
    const existing: ExistingCandidate[] = candidates.filter((c) => c.job_id === j.id)
      .map((c) => ({ id: c.id, address_snapshot: c.address_snapshot, lat: c.lat, lng: c.lng, status: c.status }))
    return { id: j.id, company: String(j.company ?? ''), location, targets, existing }
  })
}

export function AdminAutoLocate({ onChanged }: { onChanged: () => Promise<void> }) {
  const [running, setRunning] = useState(false)
  const [summary, setSummary] = useState<AutoLocateSummary | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [limit, setLimit] = useState(250)
  const [error, setError] = useState('')
  const [cacheWarning, setCacheWarning] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const stopRef = useRef(false)

  useEffect(() => {
    let active = true
    callAdminVietmap({ action: 'usage' })
      .then((r) => { if (active) { setRemaining(Math.max(0, r.limit - r.used)); setLimit(r.limit) } })
      .catch((e: Error) => { if (active) setError(e.message) })
    return () => { active = false }
  }, [])

  async function start() {
    setError(''); setCacheWarning(''); setSummary(null); setShowDetails(false)
    stopRef.current = false
    setRunning(true)
    try {
      const jobs = await loadJobs()
      if (jobs.length === 0) { setError(`Không tìm thấy tin chotot (ID ${CHOTOT_ID_MIN}–${CHOTOT_ID_MAX}).`); return }
      const deps: AutoLocateDeps = {
        search: (body) => callAdminVietmap(body),
        place: (body) => callAdminVietmap(body),
        async addCandidate(input) {
          const { data, error: e } = await supabase.rpc('admin_add_location_candidate', {
            p_job_id: input.jobId, p_address: input.address, p_lat: input.lat, p_lng: input.lng, p_precision: 'building',
            p_source: 'map_listing', p_evidence: input.evidence, p_evidence_urls: [], p_work_location_id: input.workLocationId,
          })
          if (e || !data) throw new Error(e?.message ?? 'no candidate')
          return { id: (data as { id: number }).id }
        },
        async approve(candidateId, note) {
          const { error: e } = await supabase.rpc('admin_review_location_candidate', { p_candidate_id: candidateId, p_action: 'approve', p_note: note || DEFAULT_APPROVE_NOTE })
          if (e) throw new Error(e.message)
        },
        async loadCache() {
          const { data, error: e } = await supabase.rpc('admin_get_research_artifact', { p_kind: CACHE_KIND, p_name: CACHE_NAME })
          if (e) { setCacheWarning('Chưa đọc được bộ nhớ đệm tìm kiếm (cần áp dụng DDL research_store) — lần sau có thể phải tra lại.'); return null }
          return ((data as { payload?: SearchCache } | null)?.payload ?? null)
        },
        async saveCache(cache) {
          const { error: e } = await supabase.rpc('admin_save_research_artifact', {
            p_kind: CACHE_KIND, p_name: CACHE_NAME, p_payload: cache, p_meta: { entries: Object.keys(cache).length },
          })
          if (e) { setCacheWarning('Không lưu được bộ nhớ đệm tìm kiếm (cần áp dụng DDL research_store) — lần sau có thể phải tra lại.'); throw new Error(e.message) }
        },
        pause: () => new Promise((resolve) => setTimeout(resolve, 300)),
      }
      const result = await runAutoLocate(jobs, deps, {
        shouldStop: () => stopRef.current,
        onProgress: (s) => { setSummary(s); if (s.remainingToday !== null) setRemaining(s.remainingToday) },
      })
      setSummary(result)
      if (result.remainingToday !== null) setRemaining(result.remainingToday)
      if (result.stopped === 'error' && result.errorMessage) setError(result.errorMessage)
      await onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi không xác định.')
    } finally {
      setRunning(false)
    }
  }

  const noPinOutcomes = summary?.outcomes.filter((o) => o.status === 'no_pin') ?? []
  return <div style={{ border: '1px solid #bfdbfe', background: '#f8fbff', borderRadius: 12, padding: 16, marginBottom: 16 }}>
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <button type="button" disabled={running} onClick={() => void start()}>Tìm vị trí tự động (chotot)</button>
      {running && <button type="button" onClick={() => { stopRef.current = true }}>Dừng</button>}
      <small>Hôm nay còn {remaining === null ? '—' : remaining}/{limit} lượt gọi VietMap.</small>
    </div>
    <p style={{ margin: '8px 0 0' }}><small>
      Tìm công ty làm việc của tin chotot (ID {CHOTOT_ID_MIN}–{CHOTOT_ID_MAX}) trên VietMap. Chỉ tên công ty khớp chính xác và nằm trong quận/huyện hoặc khu công nghiệp ghi trong địa chỉ mới được duyệt thành ghim; điểm giống địa chỉ đăng ký pháp nhân bị loại. Còn lại: không có ghim.
    </small></p>
    {error && <p className="admin-error">{error}</p>}
    {cacheWarning && <p><small>{cacheWarning}</small></p>}
    {summary && <div style={{ marginTop: 12 }}>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        <li>Đã tìm: <b>{summary.searched}</b> / {summary.jobsTotal} tin (gọi VietMap lần này: {summary.callsThisRun})</li>
        <li>Tự động duyệt (có ghim): <b>{summary.autoApproved}</b>{summary.alreadyApproved > 0 && ` · đã có vị trí duyệt trước đó: ${summary.alreadyApproved}`}</li>
        <li>Không có ghim: <b>{summary.noPin}</b></li>
        <li>Chưa xử lý: <b>{summary.notProcessed}</b></li>
        <li>Hôm nay còn: <b>{summary.remainingToday === null ? (remaining ?? '—') : summary.remainingToday}</b> lượt</li>
      </ul>
      <p style={{ margin: '8px 0' }}><small>{STOP_TEXT[summary.stopped]}</small></p>
      {noPinOutcomes.length > 0 && <>
        <button type="button" onClick={() => setShowDetails((v) => !v)}>{showDetails ? 'Ẩn chi tiết' : `Xem chi tiết ${noPinOutcomes.length} tin không có ghim`}</button>
        {showDetails && <ul style={{ margin: '8px 0 0', paddingLeft: 18, maxHeight: 280, overflow: 'auto' }}>
          {noPinOutcomes.map((o, i) => <li key={`${o.jobId}-${i}`}><small>#{o.jobId} · {o.company || '—'} — {o.reason ? NO_PIN_LABEL[o.reason] : ''}{o.poiName ? ` (${o.poiName})` : ''}</small></li>)}
        </ul>}
      </>}
    </div>}
  </div>
}
