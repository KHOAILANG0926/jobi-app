import { useEffect, useSyncExternalStore } from 'react'
import { supabase } from '../../lib/supabase'
import { callAdminVietmap } from '../../lib/adminVietmapClient'
import { findIndustrialPark } from '../../lib/industrialPark'
import {
  CHOTOT_EXPECTED_TOTAL, CHOTOT_ID_MAX, CHOTOT_ID_MIN, MAX_CALLS_PER_TARGET, NO_PIN_LABEL, reportJobLoad, runAutoLocate,
  type AutoLocateDeps, type AutoLocateJob, type AutoLocateSummary, type ExistingCandidate, type JobLoadReport, type SearchCache,
} from '../../lib/chototAutoLocate'
import { ADDRESS_STRATEGY, isDetailedAddress } from '../../lib/addressLocate'

// Vị trí 탭 "Tìm vị trí tự động (chotot)" (2026-10-08).
// 관리자가 누르면 chotot 공고(ID 4685~4784)의 근무 회사를 서버 API(/api/admin-vietmap)로 VietMap 검색하고,
// 자동 승인 기준(회사명 정확 일치 + 주소의 구·KCN 안, 법인 등록 주소형 POI 제외)에 맞는 것만 승인 좌표로 반영한다. 나머지는 핀 없음.
// 공고 1곳당 호출은 Search 1회 + (이름이 정확히 같은 후보가 정해졌을 때만) Place 1회. 하루 250회는 서버가 센다.
// 한도에 닿으면 멈추고, 다음 날 같은 버튼으로 이어서 실행한다(응답 캐시는 비공개 저장소).
// 실행 상태는 모듈 전역 저장소에 둔다 — 다른 탭으로 갔다 와도(컴포넌트가 다시 만들어져도) 진행 화면이 사라지지 않는다.
// 마지막 실행 결과는 비공개 저장소(research_artifacts)에도 남겨 새로고침 뒤에도 보인다.

const CACHE_KIND = 'autolocate'
type Mode = 'company' | 'address'
// 상세주소 검색(2026-10-08): 번지·도로가 있는 근무지를 주소로 검색. 같은 서버 API·하루 250회·같은 비공개 저장소를 쓰되 캐시·결과 이름만 따로 둔다.
const NAMES: Record<Mode, { cache: string; lastRun: string }> = {
  company: { cache: 'chotot_search_cache', lastRun: 'chotot_last_run' },
  address: { cache: 'chotot_address_cache', lastRun: 'chotot_address_last_run' },
}
const DEFAULT_APPROVE_NOTE = 'Tự động duyệt (chotot)'
const PERSIST_EVERY_JOBS = 5

const STOP_TEXT: Record<AutoLocateSummary['stopped'], string> = {
  running: 'Đang chạy…',
  done: 'Đã xử lý xong tất cả tin.',
  incomplete: 'CHƯA xong: còn tin chưa được tìm/đánh giá (chưa đọc được hoặc tra cứu lỗi). Bấm lại để chạy tiếp.',
  daily_limit: 'Đã chạm giới hạn 250 lượt/ngày — dừng lại. Ngày mai bấm lại nút này để chạy tiếp (các kết quả đã tra được lưu lại).',
  user: 'Đã dừng theo yêu cầu. Bấm lại để chạy tiếp.',
  error: 'Dừng do lỗi.',
}

interface WorkLocationRow { id: number; job_id: number; raw_address: string | null; lat: number | null; lng: number | null }
interface CandidateRow { id: number; job_id: number; address_snapshot: string; lat: number; lng: number; status: string }
interface JobRow { id: number; company: string | null; location: string | null; admin_hidden: boolean | null }

const PAGE = 1000
const ID_CHUNK = 50

// chotot 공고는 ID 범위(4685~4784)와 출처(source = 'chotot:…') 두 경로로 모두 읽어 합친다 — 한쪽 기준이 어긋나도 빠지지 않게.
// PostgREST의 한 번 응답 상한을 넘지 않도록 페이지로 나눠 읽고, 근무지·후보 조회는 ID를 나눠서 한다.
async function fetchJobRows(build: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<JobRow[]> {
  const rows: JobRow[] = []
  for (let page = 0; page < 20; page++) {
    const { data, error } = await build(page * PAGE, page * PAGE + PAGE - 1)
    if (error) throw new Error(error.message)
    const part = (data ?? []) as JobRow[]
    rows.push(...part)
    if (part.length < PAGE) break
  }
  return rows
}

export async function loadJobs(): Promise<{ jobs: AutoLocateJob[]; report: JobLoadReport }> {
  const columns = 'id,company,location,admin_hidden'
  const [byId, bySource] = await Promise.all([
    fetchJobRows((from, to) => supabase.from('local_jobs').select(columns).gte('id', CHOTOT_ID_MIN).lte('id', CHOTOT_ID_MAX).order('id').range(from, to)),
    fetchJobRows((from, to) => supabase.from('local_jobs').select(columns).like('source', 'chotot:%').order('id').range(from, to)),
  ])
  const merged = new Map<number, JobRow>()
  for (const r of [...byId, ...bySource]) merged.set(r.id, r)
  const jobs = [...merged.values()].sort((a, b) => a.id - b.id)
  const report = reportJobLoad(jobs)
  if (jobs.length === 0) return { jobs: [], report }

  const ids = jobs.map((j) => j.id)
  const locs: WorkLocationRow[] = []
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const { data, error } = await supabase.from('job_work_locations').select('id,job_id,raw_address,lat,lng,sort_order')
      .in('job_id', ids.slice(i, i + ID_CHUNK)).order('sort_order')
    if (error) throw new Error(error.message)
    locs.push(...((data ?? []) as WorkLocationRow[]))
  }
  const { data: candRows, error: candError } = await supabase.rpc('admin_list_location_candidates')
  if (candError) throw new Error(candError.message)
  const idSet = new Set(ids)
  const candidates = ((candRows ?? []) as CandidateRow[]).filter((c) => idSet.has(c.job_id))
  return {
    report,
    jobs: jobs.map((j) => {
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
    }),
  }
}

type Phase = 'idle' | 'loading' | 'running' | 'finished'
interface RunState {
  phase: Phase
  summary: AutoLocateSummary | null
  report: JobLoadReport | null
  error: string
  cacheWarning: string
  remaining: number | null
  limit: number
  usedAtStart: number | null
  stop: boolean
  restored: boolean
  restoreTried: boolean
  showDetails: boolean
  mode: Mode
}

let state: RunState = {
  phase: 'idle', summary: null, report: null, error: '', cacheWarning: '', remaining: null, limit: 250, usedAtStart: null,
  stop: false, restored: false, restoreTried: false, showDetails: false, mode: 'company',
}
const listeners = new Set<() => void>()
const getState = () => state
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
function setState(patch: Partial<RunState>) { state = { ...state, ...patch }; listeners.forEach((fn) => fn()) }

async function persistRun(summary: AutoLocateSummary, usedAtStart: number | null, mode: Mode) {
  const { error } = await supabase.rpc('admin_save_research_artifact', {
    p_kind: CACHE_KIND, p_name: NAMES[mode].lastRun,
    p_payload: { savedAt: new Date().toISOString(), usedAtStart, summary },
    p_meta: { stopped: summary.stopped, searched: summary.searched, jobsTotal: summary.jobsTotal },
  })
  if (error) setState({ cacheWarning: 'Không lưu được kết quả lần chạy (cần áp dụng DDL research_store) — tải lại trang sẽ mất kết quả hiển thị.' })
}

async function restoreLastRun() {
  if (state.restoreTried) return
  setState({ restoreTried: true })
  const [company, address] = await Promise.all((['company', 'address'] as Mode[]).map((m) => supabase.rpc('admin_get_research_artifact', { p_kind: CACHE_KIND, p_name: NAMES[m].lastRun })))
  if (state.phase !== 'idle') return
  type Saved = { payload?: { savedAt?: string; summary?: AutoLocateSummary } } | null
  const picks = ([['company', company], ['address', address]] as const)
    .filter(([, r]) => !r.error && (r.data as Saved)?.payload?.summary)
    .map(([m, r]) => ({ mode: m as Mode, at: (r.data as Saved)?.payload?.savedAt ?? '', summary: (r.data as Saved)!.payload!.summary! }))
    .sort((a, b) => b.at.localeCompare(a.at))
  if (picks.length === 0) return
  const { mode, summary: saved } = picks[0]
  const interrupted = saved.stopped === 'running'
  setState({
    phase: 'finished', restored: true, mode,
    summary: interrupted ? { ...saved, stopped: 'error', errorMessage: 'Lần chạy trước bị gián đoạn (đóng/tải lại trang). Các tin chưa xử lý sẽ được chạy tiếp khi bấm lại.' } : saved,
  })
}

async function refreshUsage() {
  try {
    const r = await callAdminVietmap({ action: 'usage' })
    setState({ remaining: Math.max(0, r.limit - r.used), limit: r.limit })
    return r
  } catch (e) {
    setState({ error: e instanceof Error ? e.message : 'Lỗi không xác định.' })
    return null
  }
}

let activeRun = false

async function startRun(onChanged: () => Promise<void>, mode: Mode = 'company') {
  if (activeRun) return
  activeRun = true
  setState({ phase: 'loading', error: '', cacheWarning: '', summary: null, report: null, restored: false, stop: false, showDetails: false, mode })
  try {
    const usage = await callAdminVietmap({ action: 'usage' })
    const usedAtStart = usage.used
    setState({ remaining: Math.max(0, usage.limit - usage.used), limit: usage.limit, usedAtStart })
    const loaded = await loadJobs()
    const { report } = loaded
    setState({ report })
    if (loaded.jobs.length === 0) { setState({ phase: 'idle', error: `Không đọc được tin chotot nào (ID ${CHOTOT_ID_MIN}–${CHOTOT_ID_MAX}).` }); return }
    const jobs = mode === 'address'
      ? loaded.jobs.map((j) => ({ ...j, targets: j.targets.filter((t) => isDetailedAddress(t.address)) })).filter((j) => j.targets.length > 0)
      : loaded.jobs
    if (jobs.length === 0) { setState({ phase: 'idle', error: 'Không có tin nào có địa chỉ chi tiết (số nhà/đường/thôn) để tìm.' }); return }
    setState({ phase: 'running' })
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
        const { data, error: e } = await supabase.rpc('admin_get_research_artifact', { p_kind: CACHE_KIND, p_name: NAMES[mode].cache })
        if (e) { setState({ cacheWarning: 'Chưa đọc được bộ nhớ đệm tìm kiếm (cần áp dụng DDL research_store) — lần sau có thể phải tra lại.' }); return null }
        return ((data as { payload?: SearchCache } | null)?.payload ?? null)
      },
      async saveCache(cache) {
        const { error: e } = await supabase.rpc('admin_save_research_artifact', {
          p_kind: CACHE_KIND, p_name: NAMES[mode].cache, p_payload: cache, p_meta: { entries: Object.keys(cache).length },
        })
        if (e) { setState({ cacheWarning: 'Không lưu được bộ nhớ đệm tìm kiếm (cần áp dụng DDL research_store) — lần sau có thể phải tra lại.' }); throw new Error(e.message) }
      },
      pause: () => new Promise((resolve) => setTimeout(resolve, 300)),
    }
    let lastPersistedAt = 0
    const result = await runAutoLocate(jobs, deps, {
      expectedTotal: mode === 'address' ? jobs.length : CHOTOT_EXPECTED_TOTAL,
      strategy: mode === 'address' ? ADDRESS_STRATEGY : undefined,
      usedAtStart,
      shouldStop: () => state.stop,
      onProgress: (s) => {
        setState({ summary: s, ...(s.remainingToday !== null ? { remaining: s.remainingToday } : {}) })
        if (s.searched - lastPersistedAt >= PERSIST_EVERY_JOBS) { lastPersistedAt = s.searched; void persistRun(s, usedAtStart, mode) }
      },
    })
    setState({ summary: result, phase: 'finished', ...(result.remainingToday !== null ? { remaining: result.remainingToday } : {}), ...(result.stopped === 'error' && result.errorMessage ? { error: result.errorMessage } : {}) })
    await persistRun(result, usedAtStart, mode)
    await onChanged()
  } catch (e) {
    setState({ phase: state.summary ? 'finished' : 'idle', error: e instanceof Error ? e.message : 'Lỗi không xác định.' })
  } finally {
    activeRun = false
  }
}

export function AdminAutoLocate({ onChanged }: { onChanged: () => Promise<void> }) {
  const st = useSyncExternalStore(subscribe, getState)

  useEffect(() => {
    void refreshUsage()
    void restoreLastRun()
  }, [])

  const busy = st.phase === 'loading' || st.phase === 'running'
  const summary = st.summary
  const finished = st.phase === 'finished'
  const noPinOutcomes = summary?.outcomes.filter((o) => o.status === 'no_pin') ?? []
  const extraServerCalls = summary && summary.serverCallsDelta !== null ? summary.serverCallsDelta - summary.callsThisRun : 0
  return <div style={{ border: '1px solid #bfdbfe', background: '#f8fbff', borderRadius: 12, padding: 16, marginBottom: 16 }}>
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <button type="button" disabled={busy} onClick={() => void startRun(onChanged, 'company')}>Tìm vị trí tự động (chotot)</button>
      <button type="button" disabled={busy} onClick={() => void startRun(onChanged, 'address')}>Tìm theo địa chỉ chi tiết (chotot)</button>
      {st.phase === 'running' && <button type="button" onClick={() => setState({ stop: true })}>Dừng</button>}
      <small>Hôm nay còn {st.remaining === null ? '—' : st.remaining}/{st.limit} lượt gọi VietMap.</small>
    </div>
    <p style={{ margin: '8px 0 0' }}><small>
      <b>Địa chỉ chi tiết:</b> chỉ các tin có số nhà + tên đường (hoặc thôn/lô). Tìm theo địa chỉ trên VietMap (tên phường/xã, quận/huyện cũ ghi trong tin), tối đa {MAX_CALLS_PER_TARGET} lượt/tin; chỉ duyệt thành ghim khi số nhà + tên đường khớp chính xác và phường/xã hoặc quận/huyện khớp. Lô/thôn/trong KCN không có số nhà + tên đường thì không có ghim.
    </small></p>
    <p style={{ margin: '8px 0 0' }}><small>
      <b>Theo tên công ty:</b> Tìm công ty làm việc của tin chotot (ID {CHOTOT_ID_MIN}–{CHOTOT_ID_MAX}) trên VietMap, tối đa {MAX_CALLS_PER_TARGET} lượt/tin (Search 1 + Place 1 chỉ khi có điểm trùng tên chính xác). Chỉ tên công ty khớp chính xác và nằm trong quận/huyện hoặc khu công nghiệp ghi trong địa chỉ mới được duyệt thành ghim; điểm giống địa chỉ đăng ký pháp nhân bị loại. Còn lại: không có ghim.
    </small></p>
    {st.phase === 'loading' && <p><small>Đang đọc danh sách tin…</small></p>}
    {st.phase === 'running' && <p><b>Đang chạy…</b> <small>(đừng đóng trang; có thể chuyển tab quản trị rồi quay lại)</small></p>}
    {st.error && <p className="admin-error">{st.error}</p>}
    {st.cacheWarning && <p><small>{st.cacheWarning}</small></p>}
    {st.report && <p style={st.report.found < st.report.expected ? { color: '#b45309' } : undefined}><small>
      Đã đọc {st.report.found}/{st.report.expected} tin chotot từ cơ sở dữ liệu (đang ẩn: {st.report.hidden}, hiển thị: {st.report.visible}).
      {st.report.found < st.report.expected && ` Thiếu ${st.report.missingCount} tin trong ID ${CHOTOT_ID_MIN}–${CHOTOT_ID_MAX} (không tồn tại hoặc không đọc được): ${st.report.missingIds.join(', ')}${st.report.missingCount > st.report.missingIds.length ? ', …' : ''}. Các tin này tính là chưa xử lý.`}
    </small></p>}
    {summary && <div style={{ marginTop: 12 }}>
      {st.restored && <p style={{ margin: '0 0 6px' }}><small>Kết quả lần chạy gần nhất (đã lưu).</small></p>}
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        <li>Đã tìm: <b>{summary.searched}</b> / {summary.jobsTotal} tin (đọc được {summary.jobsFound})</li>
        <li>Tự động duyệt (có ghim): <b>{summary.autoApproved}</b>{summary.alreadyApproved > 0 && ` · đã có vị trí duyệt trước đó: ${summary.alreadyApproved}`}</li>
        <li>Không có ghim: <b>{summary.noPin}</b></li>
        {summary.lookupFailed > 0 && <li>Tra cứu lỗi (tính là chưa xử lý, sẽ thử lại): <b>{summary.lookupFailed}</b></li>}
        <li>Chưa xử lý: <b>{summary.notProcessed}</b></li>
        <li>Gọi VietMap lần này: <b>{summary.callsThisRun}</b> yêu cầu từ trang này{summary.serverCallsDelta !== null && <> · bộ đếm server tăng: <b>{summary.serverCallsDelta}</b></>}</li>
        <li>Hôm nay còn: <b>{summary.remainingToday === null ? (st.remaining ?? '—') : summary.remainingToday}</b> lượt</li>
      </ul>
      {extraServerCalls > 0 && <p style={{ color: '#b45309', margin: '6px 0 0' }}><small>
        Bộ đếm server tăng nhiều hơn số yêu cầu của trang này (+{extraServerCalls}): có thể tab khác hoặc script đang dùng cùng bộ đếm 250 lượt/ngày.
      </small></p>}
      {finished && <p style={{ margin: '8px 0' }}><small>{STOP_TEXT[summary.stopped]}</small></p>}
      {noPinOutcomes.length > 0 && <>
        <button type="button" onClick={() => setState({ showDetails: !st.showDetails })}>{st.showDetails ? 'Ẩn chi tiết' : `Xem chi tiết ${noPinOutcomes.length} tin không có ghim`}</button>
        {st.showDetails && <ul style={{ margin: '8px 0 0', paddingLeft: 18, maxHeight: 280, overflow: 'auto' }}>
          {noPinOutcomes.map((o, i) => <li key={`${o.jobId}-${i}`}><small>#{o.jobId} · {o.company || '—'} — {o.reason ? NO_PIN_LABEL[o.reason] : ''}{o.poiName ? ` (${o.poiName})` : ''}</small></li>)}
        </ul>}
      </>}
    </div>}
  </div>
}
