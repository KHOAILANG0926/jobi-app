import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, Pause, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useJobs } from '../../context/JobsContext'
import { ALL_CATEGORIES, CATEGORY_LABELS } from '../../data/categories'
import { JOB_REGIONS } from '../../data/jobRegions'
import {
  CRITERION_LABELS, MAX_PREFERENCES, createPreference, deletePreference, describeSaveError, emptyPreferenceInput, fetchMatches, groupMatchResults,
  listPreferences, reasonLabel, setPreferenceStatus, unknownRequiredCriteria, updatePreference, validatePreferenceInput,
  type Importance, type JobAlertPreference, type JobAlertPreferenceInput, type JobMatchRow, type SalaryPeriodPref,
} from '../../lib/jobAlerts'
import { toAppJobId } from '../../lib/jobId'
import type { JobCategory } from '../../types/job'
import BottomSheet from '../ui/BottomSheet'

const IMPORTANCE: { v: Importance | null; t: string }[] = [{ v: null, t: 'Không dùng' }, { v: 'preferred', t: 'Ưu tiên' }, { v: 'required', t: 'Bắt buộc' }]
const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)

function ImportanceSeg({ label, value, onChange }: { label: string; value: Importance | null; onChange: (v: Importance | null) => void }) {
  return <div className="app-seg app-cond__seg" role="group" aria-label={`Mức độ — ${label}`}>{IMPORTANCE.map((o) => <button key={o.t} type="button" className={value === o.v ? 'app-on' : ''} aria-pressed={value === o.v} onClick={() => onChange(o.v)}>{o.t}</button>)}</div>
}

// 조건 편집 시트 — 항목·검사·저장은 웹 JobAlertsPanel과 같은 lib/jobAlerts(validatePreferenceInput·createPreference·updatePreference). 이동거리 조건은 웹과 같이 아직 쓰지 않는다.
function Editor({ initial, onSave, onClose }: { initial: JobAlertPreferenceInput; onSave: (p: JobAlertPreferenceInput) => Promise<void>; onClose: () => void }) {
  const [p, setP] = useState(initial)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof JobAlertPreferenceInput>(k: K, v: JobAlertPreferenceInput[K]) => setP((x) => ({ ...x, [k]: v }))
  const toggle = <T extends string>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])
  const save = async () => {
    const err = validatePreferenceInput(p, false)
    if (err) { setError(err); return }
    setBusy(true); setError('')
    try { await onSave(p); onClose() } catch (e) { setError(describeSaveError(e instanceof Error ? e.message : undefined)) } finally { setBusy(false) }
  }
  return (
    <BottomSheet title="Điều kiện việc làm phù hợp" full onClose={busy ? () => {} : onClose}
      footer={<button type="button" className="app-btn app-btn--primary" disabled={busy} onClick={save}>{busy ? 'Đang lưu…' : 'Lưu điều kiện'}</button>}>
      <div className="app-form app-form--sheet" data-testid="app-cond-form">
        {error && <p className="app-form__error" role="alert">{error}</p>}
        <label className="app-field"><span>Tên điều kiện</span><input value={p.name} maxLength={60} onChange={(e) => set('name', e.target.value)} /></label>
        <fieldset className="app-cond__crit"><legend>{CRITERION_LABELS.region}</legend>
          <ImportanceSeg label={CRITERION_LABELS.region} value={p.regionImportance} onChange={(v) => set('regionImportance', v)} />
          {p.regionImportance && <div className="app-chip-row app-chip-row--wrap">{JOB_REGIONS.map((r) => <button key={r.id} type="button" className={'app-chip' + (p.regionIds.includes(r.id) ? ' app-on' : '')} aria-pressed={p.regionIds.includes(r.id)} onClick={() => set('regionIds', toggle(p.regionIds, r.id))}>{r.label}</button>)}</div>}
        </fieldset>
        <fieldset className="app-cond__crit"><legend>{CRITERION_LABELS.category}</legend>
          <ImportanceSeg label={CRITERION_LABELS.category} value={p.categoryImportance} onChange={(v) => set('categoryImportance', v)} />
          {p.categoryImportance && <div className="app-chip-row app-chip-row--wrap">{ALL_CATEGORIES.map((c) => <button key={c} type="button" className={'app-chip' + (p.categories.includes(c) ? ' app-on' : '')} aria-pressed={p.categories.includes(c)} onClick={() => set('categories', toggle<JobCategory>(p.categories, c))}>{CATEGORY_LABELS[c]}</button>)}</div>}
        </fieldset>
        <fieldset className="app-cond__crit"><legend>{CRITERION_LABELS.salary}</legend>
          <ImportanceSeg label={CRITERION_LABELS.salary} value={p.salaryImportance} onChange={(v) => set('salaryImportance', v)} />
          {p.salaryImportance && <div className="app-cond__pair"><input inputMode="numeric" aria-label="Lương tối thiểu (VND)" placeholder="Lương tối thiểu (VND)" value={p.salaryMin ?? ''} onChange={(e) => set('salaryMin', e.target.value ? Number(e.target.value.replace(/\D/g, '')) : null)} />
            <select aria-label="Đơn vị lương" value={p.salaryPeriod ?? ''} onChange={(e) => set('salaryPeriod', (e.target.value || null) as SalaryPeriodPref | null)}><option value="">-- Đơn vị --</option><option value="hour">/ giờ</option><option value="day">/ ngày</option><option value="month">/ tháng</option></select></div>}
        </fieldset>
        <fieldset className="app-cond__crit"><legend>{CRITERION_LABELS.hours}</legend>
          <ImportanceSeg label={CRITERION_LABELS.hours} value={p.hoursImportance} onChange={(v) => set('hoursImportance', v)} />
          {p.hoursImportance && <><div className="app-cond__pair"><select aria-label="Giờ bắt đầu" value={p.workStart ?? ''} onChange={(e) => set('workStart', e.target.value || null)}><option value="">Bắt đầu</option>{TIMES.map((t) => <option key={t}>{t}</option>)}</select>
            <select aria-label="Giờ kết thúc" value={p.workEnd ?? ''} onChange={(e) => set('workEnd', e.target.value || null)}><option value="">Kết thúc</option>{TIMES.map((t) => <option key={t}>{t}</option>)}</select></div>
            <label className="app-cond__check"><input type="checkbox" checked={p.acceptRotating} onChange={(e) => set('acceptRotating', e.target.checked)} />Chấp nhận làm xoay ca</label></>}
        </fieldset>
        <p className="app-cv__hint">Cần ít nhất một điều kiện «Bắt buộc». Khi có tin mới đạt đủ điều kiện bắt buộc, bạn sẽ nhận thông báo.</p>
      </div>
    </BottomSheet>
  )
}

function Results({ pref }: { pref: JobAlertPreference }) {
  const { jobs } = useJobs()
  const byId = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs])
  const [rows, setRows] = useState<JobMatchRow[] | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let cancelled = false
    setRows(null); setFailed(false)
    fetchMatches(pref.id).then((r) => { if (!cancelled) setRows(r) }).catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [pref.id, pref.updatedAt])
  const grouped = useMemo(() => (rows ? groupMatchResults(rows) : null), [rows])
  if (failed) return <p className="app-form__error" role="alert">Không tải được kết quả. Vui lòng thử lại.</p>
  if (!grouped) return <p className="app-state" role="status">Đang đối chiếu tin tuyển dụng…</p>
  const line = (jobId: number, note?: string) => {
    const j = byId.get(toAppJobId(jobId))
    return j ? <li key={jobId}><Link to={`/viec-lam/${j.id}`}><strong>{j.title}</strong><span>{j.company}</span>{note && <small>{note}</small>}</Link></li> : null
  }
  return (
    <div className="app-cond__results">
      <h3>Phù hợp · {grouped.matched.length} tin</h3>
      {grouped.matched.length === 0 ? <p className="app-state">Chưa có tin nào đạt đủ điều kiện bắt buộc.</p>
        : <ul>{grouped.matched.map((r) => line(r.jobId, r.result.preferred_total > 0 ? `Ưu tiên đạt ${r.result.preferred_met}/${r.result.preferred_total}` : undefined))}</ul>}
      <h3>Chưa xác định · {grouped.unknown.length} tin</h3>
      <p className="app-cv__hint">Các tin này không có điều kiện bắt buộc nào bị sai, nhưng thiếu thông tin để xác nhận. Không gửi thông báo cho các tin này.</p>
      {grouped.unknown.length > 0 && <ul>{grouped.unknown.map((r) => line(r.jobId, unknownRequiredCriteria(r.result).map((u) => `${CRITERION_LABELS[u.key]}: ${reasonLabel(u.reason)}`).join(' · ')))}</ul>}
      <p className="app-cv__hint">Không phù hợp (có điều kiện bắt buộc bị sai): {grouped.mismatchCount} tin — không hiển thị.</p>
    </div>
  )
}

// 맞춤 조건 설정(로그인 구직자) — 웹 '맞춤 공고'의 서버 저장 조건(JobAlertsPanel)과 같은 자료·같은 판정. 로그인 전·기업 계정은 웹과 같이 쓸 수 없다.
export default function ConditionsScreen() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [prefs, setPrefs] = useState<JobAlertPreference[] | null>(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<JobAlertPreference | 'new' | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const seeker = user?.role === 'seeker'

  const reload = useCallback(() => { listPreferences().then(setPrefs).catch(() => { setPrefs([]); setError('Không tải được điều kiện đã lưu. Vui lòng thử lại.') }) }, [])
  useEffect(() => { if (seeker) reload(); else setPrefs([]) }, [seeker, reload])

  const act = async (fn: () => Promise<unknown>) => { setError(''); try { await fn(); reload() } catch (e) { setError(describeSaveError(e instanceof Error ? e.message : undefined)) } }

  return (
    <div className="app-page" data-testid="app-conditions">
      <header className="app-pagebar"><button type="button" className="app-icon-btn" aria-label="Quay lại" onClick={() => navigate(-1)}><ChevronLeft size={24} aria-hidden /></button><h1 className="app-pagebar__title">Việc làm phù hợp</h1></header>
      {loading || prefs === null ? <p className="app-state" role="status">Đang tải…</p>
        : !user ? <div className="app-menu__login"><p>Đăng nhập để lưu điều kiện tìm việc và nhận thông báo khi có tin mới phù hợp</p><div><Link className="app-btn app-btn--primary" to="/dang-nhap?redirect=%2Fho-so%2Fdieu-kien">Đăng nhập</Link></div></div>
        : !seeker ? <p className="app-state">Chỉ tài khoản người tìm việc dùng được điều kiện này.</p>
        : (
          <>
            <p className="app-cv__hint">Lưu điều kiện tìm việc (khu vực, ngành nghề, lương, giờ làm) và chọn điều kiện nào là bắt buộc. Khi có tin mới đạt đủ điều kiện bắt buộc, bạn sẽ nhận thông báo.</p>
            {error && <p className="app-form__error app-cond__err" role="alert">{error}</p>}
            <ul className="app-applist">
              {prefs.map((pref) => (
                <li key={pref.id} className="app-cond__item" data-testid="app-cond-item">
                  <div className="app-cond__head"><button type="button" className="app-cond__name" aria-expanded={openId === pref.id} onClick={() => setOpenId(openId === pref.id ? null : pref.id)}><strong>{pref.name}</strong><small>{pref.status === 'active' ? 'Đang bật' : 'Đang tạm dừng'}</small></button>
                    <div>
                      <button type="button" className="app-icon-btn" aria-label={pref.status === 'active' ? 'Tạm dừng' : 'Bật lại'} onClick={() => act(() => setPreferenceStatus(pref.id, pref.status === 'active' ? 'paused' : 'active'))}>{pref.status === 'active' ? <Pause size={18} aria-hidden /> : <Play size={18} aria-hidden />}</button>
                      <button type="button" className="app-icon-btn" aria-label="Sửa" onClick={() => setEditing(pref)}><Pencil size={18} aria-hidden /></button>
                      <button type="button" className="app-icon-btn" aria-label="Xoá" onClick={() => { if (window.confirm(`Xoá điều kiện "${pref.name}"?`)) void act(() => deletePreference(pref.id)) }}><Trash2 size={18} aria-hidden /></button>
                    </div></div>
                  {openId === pref.id && <Results pref={pref} />}
                </li>
              ))}
            </ul>
            {prefs.length === 0 && <p className="app-state">Bạn chưa lưu điều kiện nào.</p>}
            <div className="app-cond__cta"><button type="button" className="app-btn app-btn--primary app-btn--block" disabled={prefs.length >= MAX_PREFERENCES} onClick={() => setEditing('new')}><Plus size={18} aria-hidden />Thêm điều kiện{prefs.length >= MAX_PREFERENCES ? ` (tối đa ${MAX_PREFERENCES})` : ''}</button></div>
          </>
        )}
      {editing && <Editor initial={editing === 'new' ? emptyPreferenceInput() : { ...editing }} onClose={() => setEditing(null)} onSave={async (input) => { if (editing === 'new') await createPreference(input); else await updatePreference(editing.id, input); reload() }} />}
    </div>
  )
}
