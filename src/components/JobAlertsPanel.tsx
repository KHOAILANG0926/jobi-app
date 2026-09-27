import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useJobs } from '../context/JobsContext'
import { ALL_CATEGORIES, CATEGORY_LABELS } from '../data/categories'
import { REGION_MACRO_TABS } from '../data/jobRegions'
import { searchAddress } from '../lib/geoapify'
import {
  CRITERION_LABELS,
  DISTANCE_DISABLED_REASON,
  DISTANCE_MATCHING_ENABLED,
  IMPORTANCE_LABELS,
  MAX_PREFERENCES,
  createPreference,
  deleteHomeLocation,
  deletePreference,
  describeSaveError,
  diagnoseEmptyResult,
  emptyPreferenceInput,
  fetchMatches,
  groupMatchResults,
  listPreferences,
  loadHomeLocation,
  reasonLabel,
  saveHomeLocation,
  setPreferenceStatus,
  unknownRequiredCriteria,
  updatePreference,
  validatePreferenceInput,
  type CriterionKey,
  type EmptyDiagnosis,
  type HomeLocation,
  type Importance,
  type JobAlertPreference,
  type JobAlertPreferenceInput,
  type JobMatchRow,
  type SalaryPeriodPref,
} from '../lib/jobAlerts'
import { toAppJobId } from '../lib/jobId'
import type { Job, JobCategory } from '../types/job'
import './jobAlerts.css'

/**
 * 로그인 구직자용 "희망조건 저장 → 매칭 → 알림" 패널(1차). 조건은 서버
 * (job_alert_preferences)에 저장되고, 판정은 전부 서버 함수가 한다 — 이
 * 컴포넌트는 결과를 충족 / 정보 미확인 / 불일치(건수만) 세 영역으로 보여준다.
 * 새 공고 알림은 서버 배치가 만들고 헤더 알림벨(NotificationContext)에 합쳐진다.
 */

type ImportanceChoice = Importance | 'off'

const REGION_LABELS: Record<string, string> = Object.fromEntries(
  REGION_MACRO_TABS.flatMap((t) => t.provinces.map((p) => [p.id, p.label])),
)

const SALARY_UNIT: Record<SalaryPeriodPref, { label: string; multiplier: number; unitLabel: string }> = {
  month: { label: 'Theo tháng', multiplier: 1_000_000, unitLabel: 'triệu đồng / tháng' },
  day: { label: 'Theo ngày', multiplier: 1_000, unitLabel: 'nghìn đồng / ngày' },
  hour: { label: 'Theo giờ', multiplier: 1_000, unitLabel: 'nghìn đồng / giờ' },
}

function withImportance(p: JobAlertPreferenceInput, key: CriterionKey, value: Importance | null): JobAlertPreferenceInput {
  switch (key) {
    case 'region': return { ...p, regionImportance: value }
    case 'category': return { ...p, categoryImportance: value }
    case 'salary': return { ...p, salaryImportance: value, salaryPeriod: p.salaryPeriod ?? 'month' }
    case 'hours': return { ...p, hoursImportance: value }
    case 'distance': return { ...p, distanceImportance: value }
  }
}

function toInput(p: JobAlertPreference): JobAlertPreferenceInput {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = p
  return rest
}

function formatVndShort(v: number): string {
  return v.toLocaleString('vi-VN')
}

function summarize(p: JobAlertPreference): string[] {
  const parts: string[] = []
  const tag = (imp: Importance | null) => (imp ? ` (${IMPORTANCE_LABELS[imp]})` : '')
  if (p.regionImportance) parts.push(`${p.regionIds.map((id) => REGION_LABELS[id] ?? id).join(', ')}${tag(p.regionImportance)}`)
  if (p.categoryImportance) parts.push(`${p.categories.map((c) => CATEGORY_LABELS[c] ?? c).join(', ')}${tag(p.categoryImportance)}`)
  if (p.salaryImportance && p.salaryMin && p.salaryPeriod) {
    parts.push(`Từ ${formatVndShort(p.salaryMin)}đ ${SALARY_UNIT[p.salaryPeriod].label.toLowerCase()}${tag(p.salaryImportance)}`)
  }
  if (p.hoursImportance) parts.push(`${p.workStart}–${p.workEnd}${p.acceptRotating ? ', nhận xoay ca' : ''}${tag(p.hoursImportance)}`)
  if (p.distanceImportance) parts.push(`Trong ${p.maxDistanceKm} km${tag(p.distanceImportance)}`)
  return parts
}

// ---------------------------------------------------------------------------
// 집 위치(동의 기반) — 원문 주소는 저장하지 않는다
// ---------------------------------------------------------------------------

function HomeLocationBox({ home, onChange }: { home: HomeLocation | null; onChange: (h: HomeLocation | null) => void }) {
  const [consent, setConsent] = useState(false)
  const [address, setAddress] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  const save = async () => {
    if (!consent) {
      setMessage({ kind: 'error', text: 'Bạn chưa đồng ý lưu vị trí — chưa thể dùng điều kiện khoảng cách.' })
      return
    }
    if (!address.trim()) return
    setBusy(true)
    setMessage(null)
    try {
      // 검색 기록(addAddressSearchHistory)에도 남기지 않는다 — 주소 원문은 이 입력칸
      // 밖으로 나가지 않고, 변환된 좌표만 저장한다.
      const results = await searchAddress(address)
      const first = results[0]
      if (!first) {
        setMessage({ kind: 'error', text: 'Không chuyển được địa chỉ này thành vị trí — chưa thể dùng điều kiện khoảng cách. Hãy thử ghi rõ quận/huyện, tỉnh/thành.' })
        return
      }
      const saved = await saveHomeLocation(first.lat, first.lng)
      setAddress('')
      setConsent(false)
      onChange(saved)
      setMessage({ kind: 'info', text: 'Đã lưu vị trí gần đúng (làm tròn khoảng 100 m). Địa chỉ bạn nhập không được lưu.' })
    } catch {
      setMessage({ kind: 'error', text: 'Không lưu được vị trí. Vui lòng thử lại.' })
    } finally {
      setBusy(false)
    }
  }

  const withdraw = async () => {
    setBusy(true)
    try {
      await deleteHomeLocation()
      onChange(null)
      setMessage({ kind: 'info', text: 'Đã xóa vị trí. Các điều kiện khoảng cách sẽ hiển thị "chưa xác định".' })
    } catch {
      setMessage({ kind: 'error', text: 'Không xóa được vị trí. Vui lòng thử lại.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="ja-home">
      <p className="ja-home__title">Vị trí của bạn (cho điều kiện khoảng cách)</p>
      {home ? (
        <div className="ja-home__saved">
          <span>Đã lưu vị trí gần đúng · chỉ bạn xem được</span>
          <button type="button" className="ja-btn ja-btn--ghost" onClick={withdraw} disabled={busy}>
            Xóa vị trí (rút lại đồng ý)
          </button>
        </div>
      ) : (
        <>
          <label className="ja-home__consent">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              Tôi đồng ý lưu vị trí gần đúng (làm tròn khoảng 100 m) để tính khoảng cách đến nơi làm việc.
              Địa chỉ tôi nhập sẽ không được lưu. Chỉ tôi xem được và có thể xóa bất cứ lúc nào.
            </span>
          </label>
          <div className="ja-home__row">
            <input
              className="ja-input"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="VD: Phường Bến Nghé, Quận 1, TP.HCM"
              disabled={!consent || busy}
              aria-label="Địa chỉ để chuyển thành vị trí"
              autoComplete="off"
            />
            <button type="button" className="ja-btn" onClick={save} disabled={!consent || busy || !address.trim()}>
              {busy ? 'Đang xử lý…' : 'Lưu vị trí'}
            </button>
          </div>
          {!consent && <p className="ja-note">Chưa đồng ý lưu vị trí — điều kiện khoảng cách chưa dùng được.</p>}
        </>
      )}
      {message && <p className={`ja-msg ja-msg--${message.kind}`} role="status">{message.text}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 조건 편집 폼
// ---------------------------------------------------------------------------

function ImportancePicker({ value, onChange, disabled }: { value: ImportanceChoice; onChange: (v: ImportanceChoice) => void; disabled?: boolean }) {
  const options: { v: ImportanceChoice; label: string }[] = [
    { v: 'off', label: 'Không dùng' },
    { v: 'required', label: IMPORTANCE_LABELS.required },
    { v: 'preferred', label: IMPORTANCE_LABELS.preferred },
  ]
  return (
    <div className="ja-imp" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          className={`ja-imp__opt${value === o.v ? ' ja-imp__opt--on' : ''}`}
          onClick={() => onChange(o.v)}
          disabled={disabled && o.v !== 'off'}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function PreferenceForm({
  initial,
  home,
  onSubmit,
  onCancel,
  submitting,
}: {
  initial: JobAlertPreferenceInput
  home: HomeLocation | null
  onSubmit: (p: JobAlertPreferenceInput) => void
  onCancel?: () => void
  submitting: boolean
}) {
  const [draft, setDraft] = useState<JobAlertPreferenceInput>(initial)
  const [salaryText, setSalaryText] = useState(() =>
    initial.salaryMin && initial.salaryPeriod ? String(initial.salaryMin / SALARY_UNIT[initial.salaryPeriod].multiplier) : '',
  )
  const [error, setError] = useState<string | null>(null)

  const setImp = (key: CriterionKey, v: ImportanceChoice) => setDraft((d) => withImportance(d, key, v === 'off' ? null : v))
  const period = draft.salaryPeriod ?? 'month'

  const submit = () => {
    const num = Number(salaryText.replace(',', '.'))
    const next: JobAlertPreferenceInput = {
      ...draft,
      salaryMin: draft.salaryImportance && Number.isFinite(num) && num > 0 ? Math.round(num * SALARY_UNIT[period].multiplier) : null,
      salaryPeriod: draft.salaryImportance ? period : null,
    }
    const msg = validatePreferenceInput(next, !!home)
    setError(msg)
    if (!msg) onSubmit(next)
  }

  const toggle = <T extends string>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  return (
    <div className="ja-form">
      <label className="ja-field">
        <span className="ja-field__label">Tên điều kiện</span>
        <input className="ja-input" value={draft.name} maxLength={60} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      </label>
      <p className="ja-note">
        <strong>Bắt buộc</strong>: tin phải xác nhận được là đạt mới được coi là phù hợp và gửi thông báo.{' '}
        <strong>Ưu tiên</strong>: chỉ dùng để sắp xếp.
      </p>

      {/* 지역 */}
      <fieldset className="ja-crit">
        <legend className="ja-crit__title">{CRITERION_LABELS.region}</legend>
        <ImportancePicker value={draft.regionImportance ?? 'off'} onChange={(v) => setImp('region', v)} />
        {draft.regionImportance && (
          <div className="ja-chips-groups">
            {REGION_MACRO_TABS.map((tab) => (
              <div key={tab.id} className="ja-chips-group">
                <span className="ja-chips-group__label">{tab.label}</span>
                <div className="ja-chips">
                  {tab.provinces.map((p) => (
                    <label key={p.id} className={`ja-chip${draft.regionIds.includes(p.id) ? ' ja-chip--on' : ''}`}>
                      <input
                        type="checkbox"
                        checked={draft.regionIds.includes(p.id)}
                        onChange={() => setDraft({ ...draft, regionIds: toggle(draft.regionIds, p.id) })}
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </fieldset>

      {/* 이동거리 */}
      <fieldset className="ja-crit">
        <legend className="ja-crit__title">{CRITERION_LABELS.distance}</legend>
        <ImportancePicker
          value={draft.distanceImportance ?? 'off'}
          onChange={(v) => setImp('distance', v)}
          disabled={!DISTANCE_MATCHING_ENABLED || !home}
        />
        {!DISTANCE_MATCHING_ENABLED ? (
          <p className="ja-note ja-note--warn" role="note">{DISTANCE_DISABLED_REASON}</p>
        ) : (
          !home && <p className="ja-note ja-note--warn">Chưa lưu vị trí của bạn — chưa thể dùng điều kiện khoảng cách.</p>
        )}
        {draft.distanceImportance && (
          <label className="ja-field ja-field--inline">
            <span>Tối đa</span>
            <input
              className="ja-input ja-input--short"
              type="number"
              min={0.5}
              max={200}
              step={0.5}
              aria-label="Khoảng cách tối đa (km)"
              value={draft.maxDistanceKm ?? ''}
              onChange={(e) => setDraft({ ...draft, maxDistanceKm: e.target.value === '' ? null : Number(e.target.value) })}
            />
            <span>km</span>
          </label>
        )}
        {draft.distanceImportance && (
          <p className="ja-note">Tin chưa xác minh được vị trí nơi làm việc sẽ được xếp vào "chưa xác định", không ước đoán khoảng cách.</p>
        )}
      </fieldset>

      {/* 업무 */}
      <fieldset className="ja-crit">
        <legend className="ja-crit__title">{CRITERION_LABELS.category}</legend>
        <ImportancePicker value={draft.categoryImportance ?? 'off'} onChange={(v) => setImp('category', v)} />
        {draft.categoryImportance && (
          <div className="ja-chips">
            {ALL_CATEGORIES.filter((c) => c !== 'khac').map((c: JobCategory) => (
              <label key={c} className={`ja-chip${draft.categories.includes(c) ? ' ja-chip--on' : ''}`}>
                <input
                  type="checkbox"
                  checked={draft.categories.includes(c)}
                  onChange={() => setDraft({ ...draft, categories: toggle(draft.categories, c) })}
                />
                {CATEGORY_LABELS[c]}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      {/* 희망급여 */}
      <fieldset className="ja-crit">
        <legend className="ja-crit__title">{CRITERION_LABELS.salary}</legend>
        <ImportancePicker value={draft.salaryImportance ?? 'off'} onChange={(v) => setImp('salary', v)} />
        {draft.salaryImportance && (
          <>
            <div className="ja-field ja-field--inline">
              <select
                className="ja-input ja-input--short"
                value={period}
                onChange={(e) => setDraft({ ...draft, salaryPeriod: e.target.value as SalaryPeriodPref })}
                aria-label="Đơn vị lương"
              >
                {(Object.keys(SALARY_UNIT) as SalaryPeriodPref[]).map((k) => (
                  <option key={k} value={k}>{SALARY_UNIT[k].label}</option>
                ))}
              </select>
              <span>Từ</span>
              <input
                className="ja-input ja-input--short"
                type="number"
                min={0}
                step="any"
                value={salaryText}
                onChange={(e) => setSalaryText(e.target.value)}
                aria-label="Mức lương tối thiểu"
              />
              <span>{SALARY_UNIT[period].unitLabel}</span>
            </div>
            <p className="ja-note">
              Chỉ so sánh với tin ghi lương cùng đơn vị (tháng/ngày/giờ), không quy đổi. Lương thỏa thuận hoặc khoảng lương
              bao quanh mức bạn chọn sẽ ở mục "chưa xác định".
            </p>
          </>
        )}
      </fieldset>

      {/* 근무시간 */}
      <fieldset className="ja-crit">
        <legend className="ja-crit__title">{CRITERION_LABELS.hours}</legend>
        <ImportancePicker value={draft.hoursImportance ?? 'off'} onChange={(v) => setImp('hours', v)} />
        {draft.hoursImportance && (
          <>
            <div className="ja-field ja-field--inline">
              <span>Trong khung</span>
              <input className="ja-input ja-input--short" type="time" value={draft.workStart ?? ''} onChange={(e) => setDraft({ ...draft, workStart: e.target.value || null })} aria-label="Giờ bắt đầu" />
              <span>–</span>
              <input className="ja-input ja-input--short" type="time" value={draft.workEnd ?? ''} onChange={(e) => setDraft({ ...draft, workEnd: e.target.value || null })} aria-label="Giờ kết thúc" />
            </div>
            <label className="ja-check">
              <input type="checkbox" checked={draft.acceptRotating} onChange={(e) => setDraft({ ...draft, acceptRotating: e.target.checked })} />
              Chấp nhận làm xoay ca
            </label>
          </>
        )}
      </fieldset>

      {error && <p className="ja-msg ja-msg--error" role="alert">{error}</p>}
      <div className="ja-actions">
        <button type="button" className="ja-btn" onClick={submit} disabled={submitting}>
          {submitting ? 'Đang lưu…' : 'Lưu điều kiện'}
        </button>
        {onCancel && (
          <button type="button" className="ja-btn ja-btn--ghost" onClick={onCancel} disabled={submitting}>
            Hủy
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 결과
// ---------------------------------------------------------------------------

function JobLine({ jobId, job, children }: { jobId: number; job?: Job; children?: ReactNode }) {
  const appId = toAppJobId(jobId)
  return (
    <li className="ja-job">
      <Link to={`/viec-lam/${appId}`} className="ja-job__link">
        <span className="ja-job__title">{job?.title ?? `Tin tuyển dụng #${jobId}`}</span>
        {job && <span className="ja-job__meta">{job.company} · {job.salary} · {job.location}</span>}
      </Link>
      {children}
    </li>
  )
}

function listKeys(items: { key: CriterionKey; count: number }[]): string {
  return items.map((i) => `${CRITERION_LABELS[i.key]} (${i.count} tin)`).join(', ')
}

function EmptyDiagnosisBox({ d }: { d: EmptyDiagnosis }) {
  let title: string
  const details: string[] = []
  switch (d.kind) {
    case 'no_open_jobs':
      title = 'Hiện chưa có tin tuyển dụng nào đang mở.'
      break
    case 'few_jobs_in_scope':
      title = 'Hiện chưa có tin tuyển dụng đang mở trong phạm vi bạn chọn.'
      details.push(`Không có tin nào đạt riêng điều kiện: ${d.emptyScopes.map((k) => CRITERION_LABELS[k]).join(', ')}.`)
      if (d.relaxable.length > 0) details.push(`Nếu nới điều kiện này sẽ có thêm tin: ${listKeys(d.relaxable)}.`)
      break
    case 'too_narrow':
      title = 'Điều kiện bắt buộc đang khá hẹp.'
      if (d.relaxable.length > 0) details.push(`Nếu nới điều kiện này sẽ có thêm tin: ${listKeys(d.relaxable)}.`)
      if (d.emptyScopes.length > 0) details.push(`Không có tin nào đạt riêng điều kiện: ${d.emptyScopes.map((k) => CRITERION_LABELS[k]).join(', ')}.`)
      if (d.relaxable.length === 0) details.push('Mỗi tin đều không đạt từ hai điều kiện bắt buộc trở lên.')
      break
    case 'insufficient_info':
      title = 'Nhiều tin chưa ghi đủ thông tin để xác định có phù hợp hay không.'
      details.push(`${d.unknownCount} tin đang ở mục "chưa xác định". Thiếu thông tin: ${listKeys(d.missingInfo)}.`)
      break
    default:
      title = 'Chưa thể xác định một nguyên nhân duy nhất.'
      if (d.unknownCount > 0) details.push(`${d.unknownCount} tin thiếu thông tin: ${listKeys(d.missingInfo)}.`)
      if (d.relaxable.length > 0) details.push(`Nếu nới điều kiện sẽ có thêm tin: ${listKeys(d.relaxable)}.`)
  }
  return (
    <div className="ja-empty" role="status">
      <p className="ja-empty__title">Chưa có tin nào đạt đủ điều kiện bắt buộc</p>
      <p>{title}</p>
      {details.map((t) => <p key={t} className="ja-empty__detail">{t}</p>)}
      <p className="ja-empty__detail">Đang có {d.totalOpenJobs} tin tuyển dụng mở.</p>
    </div>
  )
}

function Results({ pref, jobsById }: { pref: JobAlertPreference; jobsById: Map<number, Job> }) {
  const [rows, setRows] = useState<JobMatchRow[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setRows(null)
    setFailed(false)
    fetchMatches(pref.id)
      .then((r) => { if (!cancelled) setRows(r) })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [pref.id, pref.updatedAt])

  const grouped = useMemo(() => (rows ? groupMatchResults(rows) : null), [rows])
  const diagnosis = useMemo(() => (rows && grouped && grouped.matched.length === 0 ? diagnoseEmptyResult(rows) : null), [rows, grouped])

  if (failed) return <p className="ja-msg ja-msg--error">Không tải được kết quả. Vui lòng thử lại.</p>
  if (!grouped) return <p className="ja-note">Đang đối chiếu tin tuyển dụng…</p>

  return (
    <div className="ja-results">
      <section className="ja-block" aria-label="Tin đạt đủ điều kiện bắt buộc">
        <h3 className="ja-block__title">Phù hợp · {grouped.matched.length} tin</h3>
        {grouped.matched.length === 0 && diagnosis ? (
          <EmptyDiagnosisBox d={diagnosis} />
        ) : (
          <ul className="ja-jobs">
            {grouped.matched.map((r) => (
              <JobLine key={r.jobId} jobId={r.jobId} job={jobsById.get(r.jobId)}>
                {r.result.preferred_total > 0 && (
                  <span className="ja-tag">Ưu tiên đạt {r.result.preferred_met}/{r.result.preferred_total}</span>
                )}
              </JobLine>
            ))}
          </ul>
        )}
      </section>

      <section className="ja-block ja-block--unknown" aria-label="Tin chưa xác định">
        <h3 className="ja-block__title">Chưa xác định · {grouped.unknown.length} tin</h3>
        <p className="ja-note">
          Các tin này không có điều kiện bắt buộc nào bị sai, nhưng thiếu thông tin để xác nhận. Không gửi thông báo cho các tin này.
        </p>
        {grouped.unknown.length > 0 && (
          <ul className="ja-jobs">
            {grouped.unknown.map((r) => (
              <JobLine key={r.jobId} jobId={r.jobId} job={jobsById.get(r.jobId)}>
                <span className="ja-reasons">
                  {unknownRequiredCriteria(r.result).map((u) => (
                    <span key={u.key} className="ja-tag ja-tag--warn">{CRITERION_LABELS[u.key]}: {reasonLabel(u.reason)}</span>
                  ))}
                </span>
              </JobLine>
            ))}
          </ul>
        )}
      </section>

      <p className="ja-note">Không phù hợp (có điều kiện bắt buộc bị sai): {grouped.mismatchCount} tin — không hiển thị.</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 패널
// ---------------------------------------------------------------------------

export function JobAlertsPanel() {
  const { jobs } = useJobs()
  const [prefs, setPrefs] = useState<JobAlertPreference[] | null>(null)
  const [home, setHome] = useState<HomeLocation | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<'view' | 'create' | 'edit'>('view')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const jobsById = useMemo(() => {
    const m = new Map<number, Job>()
    for (const j of jobs) {
      const n = Number(j.id.replace(/^sb-/, ''))
      if (Number.isFinite(n)) m.set(n, j)
    }
    return m
  }, [jobs])

  const reload = useCallback(async () => {
    try {
      const [list, h] = await Promise.all([listPreferences(), loadHomeLocation()])
      setPrefs(list)
      setHome(h)
      setLoadError(false)
      setSelectedId((cur) => (cur && list.some((p) => p.id === cur) ? cur : list[0]?.id ?? null))
      if (list.length === 0) setMode('create')
    } catch {
      setLoadError(true)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  const selected = prefs?.find((p) => p.id === selectedId) ?? null

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setActionError(null)
    try {
      await fn()
    } catch (e) {
      setActionError(describeSaveError((e as { message?: string })?.message))
    } finally {
      setBusy(false)
    }
  }

  const onCreate = (input: JobAlertPreferenceInput) => run(async () => {
    const created = await createPreference(input)
    await reload()
    setSelectedId(created.id)
    setMode('view')
  })

  const onUpdate = (input: JobAlertPreferenceInput) => run(async () => {
    if (!selected) return
    await updatePreference(selected.id, input)
    await reload()
    setMode('view')
  })

  const onToggleStatus = () => run(async () => {
    if (!selected) return
    await setPreferenceStatus(selected.id, selected.status === 'active' ? 'paused' : 'active')
    await reload()
  })

  const onDelete = () => run(async () => {
    if (!selected) return
    if (!window.confirm(`Xóa điều kiện "${selected.name}"? Thông báo của điều kiện này cũng sẽ bị xóa.`)) return
    await deletePreference(selected.id)
    await reload()
  })

  if (loadError) return <p className="ja-msg ja-msg--error">Không tải được điều kiện đã lưu. Vui lòng tải lại trang.</p>
  if (!prefs) return <p className="ja-note">Đang tải…</p>

  const distanceWithoutHome = DISTANCE_MATCHING_ENABLED && !home && prefs.some((p) => p.distanceImportance)

  return (
    <section className="ja-panel" aria-label="Điều kiện tìm việc đã lưu">
      {DISTANCE_MATCHING_ENABLED && (
        <HomeLocationBox home={home} onChange={(h) => { setHome(h); void reload() }} />
      )}
      {distanceWithoutHome && (
        <p className="ja-note ja-note--warn">
          Bạn đã xóa vị trí — điều kiện khoảng cách trong các điều kiện đã lưu sẽ luôn ở trạng thái "chưa xác định".
        </p>
      )}

      {prefs.length > 0 && (
        <div className="ja-tabs" role="tablist">
          {prefs.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={p.id === selectedId && mode !== 'create'}
              className={`ja-tab${p.id === selectedId && mode !== 'create' ? ' ja-tab--on' : ''}`}
              onClick={() => { setSelectedId(p.id); setMode('view') }}
            >
              {p.name}
              {p.status === 'paused' && <span className="ja-tab__paused"> · Tạm dừng</span>}
            </button>
          ))}
          {prefs.length < MAX_PREFERENCES && (
            <button type="button" className="ja-tab ja-tab--add" onClick={() => setMode('create')}>+ Thêm điều kiện</button>
          )}
        </div>
      )}

      {actionError && <p className="ja-msg ja-msg--error" role="alert">{actionError}</p>}

      {mode === 'create' && (
        <PreferenceForm
          key="create"
          initial={emptyPreferenceInput()}
          home={home}
          onSubmit={onCreate}
          onCancel={prefs.length > 0 ? () => setMode('view') : undefined}
          submitting={busy}
        />
      )}

      {mode === 'edit' && selected && (
        <PreferenceForm key={`edit-${selected.id}`} initial={toInput(selected)} home={home} onSubmit={onUpdate} onCancel={() => setMode('view')} submitting={busy} />
      )}

      {mode === 'view' && selected && (
        <>
          <div className="ja-summary">
            <div className="ja-summary__text">
              <p className="ja-summary__status">
                {selected.status === 'active' ? 'Đang nhận thông báo tin mới' : 'Đã tạm dừng thông báo'}
              </p>
              <ul className="ja-summary__list">
                {summarize(selected).map((s) => <li key={s}>{s}</li>)}
              </ul>
            </div>
            <div className="ja-actions">
              <button type="button" className="ja-btn ja-btn--ghost" onClick={() => setMode('edit')} disabled={busy}>Sửa</button>
              <button type="button" className="ja-btn ja-btn--ghost" onClick={onToggleStatus} disabled={busy}>
                {selected.status === 'active' ? 'Tạm dừng thông báo' : 'Bật lại thông báo'}
              </button>
              <button type="button" className="ja-btn ja-btn--danger" onClick={onDelete} disabled={busy}>Xóa</button>
            </div>
          </div>
          <Results pref={selected} jobsById={jobsById} />
        </>
      )}

      <p className="ja-note">
        Thông báo chỉ gửi cho tin mới đăng sau khi bạn lưu (hoặc bật lại) điều kiện và đạt đủ mọi điều kiện bắt buộc.
        Mỗi tin chỉ thông báo một lần cho mỗi điều kiện. Tin đã hết hạn hoặc bị ẩn không được thông báo.
      </p>
    </section>
  )
}
