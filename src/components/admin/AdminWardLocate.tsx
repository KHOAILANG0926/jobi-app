import { useEffect, useSyncExternalStore } from 'react'
import { supabase } from '../../lib/supabase'
import { callAdminVietmap } from '../../lib/adminVietmapClient'
import { findIndustrialPark } from '../../lib/industrialPark'
import { wardUnitForAddresses, type WardUnit } from '../../lib/wardArea'
import {
  MAX_CALLS_PER_WARD, WARD_CACHE_KIND, WARD_CACHE_NAME, WARD_MISS_LABEL, runWardLocate,
  type WardCenterCache, type WardLocateDeps, type WardLocateSummary,
} from '../../lib/wardLocate'
import { loadJobs } from './AdminAutoLocate'

// Vị trí 탭 "Tìm khu vực xã/phường" (2026-10-08).
// 핀·KCN 영역이 없고 행정구역(xã/phường)만 아는 chotot 공고의 그 동네 중심 좌표를 서버 API(/api/admin-vietmap)로 한 번 찾아
// 비공개 저장소(research_artifacts)에 캐시한다. 같은 xã/phường은 다시 부르지 않는다. 좌표는 "동네가 보이는 지도"에만 쓰이고
// 핀·길찾기·거리 계산에는 쓰이지 않는다. 하루 250회는 서버가 센다(다른 검색 버튼과 같은 카운터).
// 실행 상태는 모듈 전역 저장소에 둔다 — 다른 탭에 갔다 와도 진행 화면이 사라지지 않는다.

const STOP_TEXT: Record<WardLocateSummary['stopped'], string> = {
  running: 'Đang chạy…',
  done: 'Đã xử lý xong tất cả xã/phường.',
  incomplete: 'CHƯA xong: còn xã/phường chưa tra được (tra cứu lỗi). Bấm lại để chạy tiếp.',
  daily_limit: 'Đã chạm giới hạn 250 lượt/ngày — dừng lại. Ngày mai bấm lại nút này để chạy tiếp (kết quả đã tra được lưu lại, không tra lại).',
  user: 'Đã dừng theo yêu cầu. Bấm lại để chạy tiếp.',
  error: 'Dừng do lỗi.',
}

type Phase = 'idle' | 'loading' | 'running' | 'finished'
interface WardState {
  phase: Phase
  summary: WardLocateSummary | null
  error: string
  cacheWarning: string
  remaining: number | null
  limit: number
  stop: boolean
  jobsByKey: Record<string, number>
  jobsTotal: number
  showDetails: boolean
}

let state: WardState = { phase: 'idle', summary: null, error: '', cacheWarning: '', remaining: null, limit: 250, stop: false, jobsByKey: {}, jobsTotal: 0, showDetails: false }
const listeners = new Set<() => void>()
const getState = () => state
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
function setState(patch: Partial<WardState>) { state = { ...state, ...patch }; listeners.forEach((fn) => fn()) }

async function refreshUsage() {
  try {
    const r = await callAdminVietmap({ action: 'usage' })
    setState({ remaining: Math.max(0, r.limit - r.used), limit: r.limit })
  } catch (e) {
    setState({ error: e instanceof Error ? e.message : 'Lỗi không xác định.' })
  }
}

let activeRun = false

async function startRun() {
  if (activeRun) return
  activeRun = true
  setState({ phase: 'loading', error: '', cacheWarning: '', summary: null, stop: false, showDetails: false, jobsByKey: {}, jobsTotal: 0 })
  try {
    const usage = await callAdminVietmap({ action: 'usage' })
    setState({ remaining: Math.max(0, usage.limit - usage.used), limit: usage.limit })
    const { jobs } = await loadJobs()
    // 승인 핀이 있거나 KCN 영역 지도가 나오는 공고는 제외 — 공고 화면과 같은 규칙.
    const byKey = new Map<string, { unit: WardUnit; jobs: number }>()
    let jobsTotal = 0
    for (const job of jobs) {
      if (job.existing.some((c) => c.status === 'approved')) continue
      if (findIndustrialPark(job.location, ...job.targets.map((t) => t.address))) continue
      const unit = wardUnitForAddresses(job.targets.map((t) => t.address))
      if (!unit) continue
      jobsTotal++
      const known = byKey.get(unit.key)
      if (known) known.jobs++
      else byKey.set(unit.key, { unit, jobs: 1 })
    }
    const entries = [...byKey.values()].sort((a, b) => b.jobs - a.jobs)
    const jobsByKey = Object.fromEntries(entries.map((e) => [e.unit.key, e.jobs]))
    setState({ jobsByKey, jobsTotal })
    if (entries.length === 0) { setState({ phase: 'idle', error: 'Không có tin nào chỉ có xã/phường để tìm.' }); return }
    setState({ phase: 'running' })
    const deps: WardLocateDeps = {
      search: (body) => callAdminVietmap(body),
      place: (body) => callAdminVietmap(body),
      async loadCache() {
        const { data, error } = await supabase.rpc('admin_get_research_artifact', { p_kind: WARD_CACHE_KIND, p_name: WARD_CACHE_NAME })
        if (error) { setState({ cacheWarning: 'Chưa đọc được bộ nhớ đệm xã/phường (cần áp dụng DDL research_store) — có thể phải tra lại.' }); return null }
        return ((data as { payload?: WardCenterCache } | null)?.payload ?? null)
      },
      async saveCache(cache) {
        const { error } = await supabase.rpc('admin_save_research_artifact', {
          p_kind: WARD_CACHE_KIND, p_name: WARD_CACHE_NAME, p_payload: cache, p_meta: { entries: Object.keys(cache).length },
        })
        if (error) { setState({ cacheWarning: 'Không lưu được bộ nhớ đệm xã/phường — lần sau có thể phải tra lại.' }); throw new Error(error.message) }
      },
      pause: () => new Promise((resolve) => setTimeout(resolve, 300)),
    }
    const result = await runWardLocate(entries.map((e) => e.unit), deps, {
      usedAtStart: usage.used,
      shouldStop: () => state.stop,
      onProgress: (s) => setState({ summary: s, ...(s.remainingToday !== null ? { remaining: s.remainingToday } : {}) }),
    })
    setState({ summary: result, phase: 'finished', ...(result.remainingToday !== null ? { remaining: result.remainingToday } : {}), ...(result.stopped === 'error' && result.errorMessage ? { error: result.errorMessage } : {}) })
  } catch (e) {
    setState({ phase: state.summary ? 'finished' : 'idle', error: e instanceof Error ? e.message : 'Lỗi không xác định.' })
  } finally {
    activeRun = false
  }
}

export function AdminWardLocate() {
  const st = useSyncExternalStore(subscribe, getState)
  useEffect(() => { void refreshUsage() }, [])

  const busy = st.phase === 'loading' || st.phase === 'running'
  const summary = st.summary
  const covered = summary
    ? summary.outcomes.filter((o) => o.status === 'found' || o.status === 'cached_found').reduce((n, o) => n + (st.jobsByKey[o.key] ?? 0), 0)
    : 0
  const misses = summary?.outcomes.filter((o) => o.status === 'miss' || o.status === 'cached_miss') ?? []
  return <div style={{ border: '1px solid #bbf7d0', background: '#f7fef9', borderRadius: 12, padding: 16, marginBottom: 16 }}>
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <button type="button" disabled={busy} onClick={() => void startRun()}>Tìm khu vực xã/phường (chotot)</button>
      {st.phase === 'running' && <button type="button" onClick={() => setState({ stop: true })}>Dừng</button>}
      <small>Hôm nay còn {st.remaining === null ? '—' : st.remaining}/{st.limit} lượt gọi VietMap.</small>
    </div>
    <p style={{ margin: '8px 0 0' }}><small>
      <b>Khu vực xã/phường:</b> với tin không có ghim và không có bản đồ KCN, chỉ có xã/phường — tìm vị trí tên xã/phường đó trên VietMap để hiển thị bản đồ khu vực (không ghim, không chỉ đường, không tính khoảng cách). Mỗi xã/phường chỉ tra một lần (tối đa {MAX_CALLS_PER_WARD} lượt), kết quả lưu ở kho riêng; xã/phường đã tra không bị gọi lại. Tin ghi nhiều xã/phường hoặc lẫn nhiều tỉnh bị bỏ qua.
    </small></p>
    {st.phase === 'loading' && <p><small>Đang đọc danh sách tin…</small></p>}
    {st.phase === 'running' && <p><b>Đang chạy…</b> <small>(đừng đóng trang; có thể chuyển tab quản trị rồi quay lại)</small></p>}
    {st.error && <p className="admin-error">{st.error}</p>}
    {st.cacheWarning && <p><small>{st.cacheWarning}</small></p>}
    {st.jobsTotal > 0 && <p><small>Tin đủ điều kiện: <b>{st.jobsTotal}</b> tin / <b>{Object.keys(st.jobsByKey).length}</b> xã/phường khác nhau → tối đa {Object.keys(st.jobsByKey).length * MAX_CALLS_PER_WARD} lượt (thường 2 lượt/xã).</small></p>}
    {summary && <div style={{ marginTop: 12 }}>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        <li>Tìm thấy vị trí khu vực: <b>{summary.found}</b> xã/phường mới{summary.fromCache > 0 && ` · dùng lại từ bộ nhớ đệm (không gọi): ${summary.fromCache}`} → <b>{covered}</b> tin có bản đồ khu vực</li>
        <li>Không tìm được: <b>{summary.miss}</b> xã/phường</li>
        {summary.lookupFailed > 0 && <li>Tra cứu lỗi (sẽ thử lại): <b>{summary.lookupFailed}</b></li>}
        <li>Chưa xử lý: <b>{summary.notProcessed}</b> / {summary.wardsTotal} xã/phường</li>
        <li>Gọi VietMap lần này: <b>{summary.callsThisRun}</b> yêu cầu{summary.serverCallsDelta !== null && <> · bộ đếm server tăng: <b>{summary.serverCallsDelta}</b></>}</li>
        <li>Hôm nay còn: <b>{summary.remainingToday === null ? (st.remaining ?? '—') : summary.remainingToday}</b> lượt</li>
      </ul>
      {st.phase === 'finished' && <p style={{ margin: '8px 0' }}><small>{STOP_TEXT[summary.stopped]}</small></p>}
      {misses.length > 0 && <>
        <button type="button" onClick={() => setState({ showDetails: !st.showDetails })}>{st.showDetails ? 'Ẩn chi tiết' : `Xem chi tiết ${misses.length} xã/phường không tìm được`}</button>
        {st.showDetails && <ul style={{ margin: '8px 0 0', paddingLeft: 18, maxHeight: 280, overflow: 'auto' }}>
          {misses.map((o) => <li key={o.key}><small>{o.label} ({st.jobsByKey[o.key] ?? 0} tin) — {o.reason ? WARD_MISS_LABEL[o.reason] : ''}</small></li>)}
        </ul>}
      </>}
    </div>}
  </div>
}
