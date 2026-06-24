import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { CATEGORY_ICONS, CATEGORY_LABELS } from '../data/categories'
import { JOB_REGIONS } from '../data/jobRegions'
import { hasAppliedToJob } from '../lib/applicationsStorage'
import {
  ALL_TIME_SLOTS,
  TIME_SLOT_LABELS,
  hasPrefs,
  loadPrefs,
  matchJobs,
  savePrefs,
  type JobMatch,
  type RecommendPrefs,
  type TimeSlot,
} from '../lib/recommendStorage'
import { isJobSaved, toggleSavedJobId } from '../lib/storage'
import type { Job, JobCategory } from '../types/job'
import { useApply } from './useApply'
import ApplyModal from './ApplyModal'

const SALARY_OPTIONS = [
  { value: 0, label: 'Không giới hạn' },
  { value: 20_000, label: 'Từ 20.000 đ/giờ' },
  { value: 25_000, label: 'Từ 25.000 đ/giờ' },
  { value: 30_000, label: 'Từ 30.000 đ/giờ' },
  { value: 40_000, label: 'Từ 40.000 đ/giờ' },
  { value: 50_000, label: 'Từ 50.000 đ/giờ' },
]

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.min(100, score)
  const cls =
    pct >= 75 ? 'score-badge--high' : pct >= 55 ? 'score-badge--mid' : 'score-badge--low'
  return (
    <span className={`score-badge ${cls}`} title={`Độ phù hợp: ${pct}%`}>
      {pct}%
    </span>
  )
}

function RecommendCard({
  match,
  seekerId,
  onApply,
}: {
  match: JobMatch
  seekerId?: string
  onApply: (j: Job) => void
}) {
  const { job, score, reasons } = match
  const [saved, setSaved] = useState(() => isJobSaved(job.id))
  const applied = hasAppliedToJob(job.id, seekerId)

  const handleSave = (e: React.MouseEvent) => {
    e.preventDefault()
    setSaved(toggleSavedJobId(job.id))
  }

  return (
    <li className="rec-card">
      <div className="rec-card__score-row">
        <ScoreBadge score={score} />
        <div className="rec-card__reasons">
          {reasons.slice(0, 3).map((r) => (
            <span key={r} className="rec-card__reason">
              {r}
            </span>
          ))}
        </div>
      </div>
      <Link to={`/viec-lam/${job.id}`} className="rec-card__link">
        <p className="rec-card__title">{job.title}</p>
        <p className="rec-card__company">{job.company}</p>
        <p className="rec-card__salary">{job.salary}</p>
        <p className="rec-card__location">📍 {job.location}</p>
      </Link>
      <div className="rec-card__actions">
        <button
          className={`btn btn--primary btn--sm${applied ? ' btn--ghost' : ''}`}
          disabled={applied}
          onClick={() => !applied && onApply(job)}
        >
          {applied ? 'Đã ứng tuyển' : 'Ứng tuyển'}
        </button>
        <button
          className={`job-card__bookmark${saved ? ' job-card__bookmark--saved' : ''}`}
          onClick={handleSave}
          aria-label={saved ? 'Bỏ lưu' : 'Lưu tin'}
          title={saved ? 'Bỏ lưu' : 'Lưu tin'}
        >
          <svg
            className="job-card__bookmark-icon"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill={saved ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      </div>
    </li>
  )
}

export function RecommendSection({ jobs }: { jobs: Job[] }) {
  const { user } = useAuth()
  const [prefs, setPrefs] = useState<RecommendPrefs>(() => loadPrefs())
  const [draft, setDraft] = useState<RecommendPrefs>(() => loadPrefs())
  const [open, setOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const formRef = useRef<HTMLDivElement>(null)

  const { status, job: applyJob, profile, openApply, confirm, close, retry } = useApply()

  useEffect(() => {
    const onUpdate = () => {
      const p = loadPrefs()
      setPrefs(p)
      setDraft(p)
    }
    window.addEventListener('vgb:recommend-prefs', onUpdate)
    return () => window.removeEventListener('vgb:recommend-prefs', onUpdate)
  }, [])

  // Scroll form into view when opened
  useEffect(() => {
    if (open) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [open])

  const matches = matchJobs(jobs, prefs)
  const visible = showAll ? matches : matches.slice(0, 4)
  const active = hasPrefs(prefs)

  const toggleSlot = (slot: TimeSlot) => {
    setDraft((d) => ({
      ...d,
      timeSlots: d.timeSlots.includes(slot)
        ? d.timeSlots.filter((s) => s !== slot)
        : [...d.timeSlots, slot],
    }))
  }

  const toggleCat = (cat: JobCategory) => {
    setDraft((d) => ({
      ...d,
      categories: d.categories.includes(cat)
        ? d.categories.filter((c) => c !== cat)
        : [...d.categories, cat],
    }))
  }

  const handleSave = () => {
    savePrefs(draft)
    setPrefs(draft)
    setOpen(false)
    setShowAll(false)
  }

  const handleReset = () => {
    const empty: RecommendPrefs = { regionId: '', minHourlySalary: 0, timeSlots: [], categories: [] }
    setDraft(empty)
    savePrefs(empty)
    setPrefs(empty)
    setOpen(false)
    setShowAll(false)
  }

  return (
    <section className="rec-section" aria-label="Gợi ý việc làm phù hợp">
      <div className="rec-section__header">
        <div className="rec-section__title-row">
          <span className="rec-section__icon" aria-hidden>
            ✨
          </span>
          <h2 className="rec-section__title">Gợi ý cho bạn</h2>
          {active && matches.length > 0 && (
            <span className="rec-section__count">{matches.length} việc phù hợp</span>
          )}
        </div>
        <button
          className={`rec-section__settings-btn${open ? ' rec-section__settings-btn--active' : ''}`}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Thiết lập điều kiện gợi ý"
        >
          {open ? 'Đóng' : active ? 'Sửa điều kiện' : 'Thiết lập'}
        </button>
      </div>

      {/* ── Preference form ── */}
      {open && (
        <div className="rec-form" ref={formRef}>
          <div className="rec-form__grid">
            {/* Region */}
            <label className="rec-form__field">
              <span className="rec-form__label">📍 Khu vực</span>
              <select
                className="field__input rec-form__select"
                value={draft.regionId}
                onChange={(e) => setDraft((d) => ({ ...d, regionId: e.target.value }))}
              >
                <option value="">Tất cả khu vực</option>
                {JOB_REGIONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>

            {/* Min salary */}
            <label className="rec-form__field">
              <span className="rec-form__label">💰 Lương tối thiểu</span>
              <select
                className="field__input rec-form__select"
                value={draft.minHourlySalary}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, minHourlySalary: Number(e.target.value) }))
                }
              >
                {SALARY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Time slots */}
          <div className="rec-form__field">
            <span className="rec-form__label">🕐 Khung giờ ưu tiên</span>
            <div className="rec-form__chips">
              {ALL_TIME_SLOTS.map((ts) => (
                <button
                  key={ts}
                  type="button"
                  className={`rec-chip${draft.timeSlots.includes(ts) ? ' rec-chip--active' : ''}`}
                  onClick={() => toggleSlot(ts)}
                >
                  {TIME_SLOT_LABELS[ts]}
                </button>
              ))}
            </div>
          </div>

          {/* Categories */}
          <div className="rec-form__field">
            <span className="rec-form__label">🏷 Loại công việc ưu tiên</span>
            <div className="rec-form__chips">
              {(['factory', 'cafe', 'delivery', 'cleaning', 'retail', 'other'] as JobCategory[]).map(
                (cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`rec-chip${draft.categories.includes(cat) ? ' rec-chip--active' : ''}`}
                    onClick={() => toggleCat(cat)}
                  >
                    {CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}
                  </button>
                ),
              )}
            </div>
          </div>

          <div className="rec-form__actions">
            <button className="btn btn--primary" onClick={handleSave}>
              Lưu &amp; tìm việc phù hợp
            </button>
            {active && (
              <button className="btn btn--ghost btn--sm" onClick={handleReset}>
                Đặt lại
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {!open && !active && (
        <div className="rec-empty">
          <p className="rec-empty__text">
            Cho chúng tôi biết <strong>khu vực, mức lương và khung giờ</strong> bạn muốn — Việc gần Bạn sẽ
            tự động chọn ra những tin tuyển dụng phù hợp nhất.
          </p>
          <button className="btn btn--primary btn--sm" onClick={() => setOpen(true)}>
            Thiết lập ngay
          </button>
        </div>
      )}

      {!open && active && matches.length === 0 && (
        <div className="rec-empty">
          <p className="rec-empty__text">
            Chưa tìm thấy công việc khớp với điều kiện của bạn. Thử điều chỉnh khu vực hoặc mức
            lương.
          </p>
          <button className="btn btn--ghost btn--sm" onClick={() => setOpen(true)}>
            Sửa điều kiện
          </button>
        </div>
      )}

      {!open && active && matches.length > 0 && (
        <>
          <ul className="rec-list">
            {visible.map((m) => (
              <RecommendCard key={m.job.id} match={m} seekerId={user?.id} onApply={openApply} />
            ))}
          </ul>
          {matches.length > 4 && (
            <div className="rec-section__more">
              {showAll ? (
                <button className="btn btn--ghost btn--sm" onClick={() => setShowAll(false)}>
                  Thu gọn
                </button>
              ) : (
                <button className="btn btn--ghost btn--sm" onClick={() => setShowAll(true)}>
                  Xem thêm {matches.length - 4} việc phù hợp
                </button>
              )}
            </div>
          )}
        </>
      )}

      <ApplyModal
        status={status}
        job={applyJob}
        profile={profile}
        onConfirm={confirm}
        onClose={close}
        onRetry={retry}
      />
    </section>
  )
}
