import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import ApplyModal from '../../components/ApplyModal'
import JobsListToolbar from '../../components/JobsListToolbar'
import JobsTable, { type JobsTableRow } from '../../components/JobsTable'
import { useApply } from '../../components/useApply'
import { useAuth } from '../../context/AuthContext'
import { useJobs } from '../../context/JobsContext'
import { JOB_REGIONS, type JobRegionId } from '../../data/jobRegions'
import { loadApplications } from '../../lib/applicationsStorage'
import { loadJobsViewMode, matchesDateRange, saveJobsViewMode, type DateRangeFilter, type JobsViewMode } from '../../lib/jobsListView'
import { hasSuggestionSignal, preferredCategoryCounts, suggestJobs } from '../../lib/jobSuggestions'
import { loadPrefs } from '../../lib/recommendStorage'
import { loadSavedJobIds } from '../../lib/storage'
import type { Job } from '../../types/job'
import SalaryText from '../../components/SalaryText'

function formatShortDate(iso: string | undefined) {
  if (!iso) return undefined
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return undefined
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * 추천 공고 — "맞춤 공고"(사용자가 직접 설정하는 조건)와는 다르게, 사용자의
 * 실제 활동(저장·지원한 공고의 업종)과 맞춤 조건에서 이미 설정한 지역만
 * 근거로 쓴다. 급여 추정이나 확인되지 않은 조건으로 "일치"를 만들지 않고,
 * 실제로 쓴 근거만 이유 칩으로 보여준다. 활동/선호 정보가 전혀 없으면 일반
 * 목록을 대신 보여주지 않고 조건 설정을 안내한다. 'AI'라는 표현을 쓰지 않는다.
 */
export default function SuggestedJobsPage() {
  const { jobs } = useJobs()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { status, job: applyJob, profile, openApply, confirm, close, retry } = useApply()

  const [savedIds, setSavedIds] = useState<string[]>(() => loadSavedJobIds(user?.id))
  const [appliedJobs, setAppliedJobs] = useState<Job[]>([])
  const prefs = useMemo(() => loadPrefs(), [])

  const [view, setView] = useState<JobsViewMode>(() => loadJobsViewMode())
  const [dateRange, setDateRange] = useState<DateRangeFilter>('all')
  const [sortValue, setSortValue] = useState<'weight' | 'posted'>('weight')
  const [pageSize, setPageSize] = useState<number>(20)
  const handleViewChange = (v: JobsViewMode) => { setView(v); saveJobsViewMode(v) }

  useEffect(() => {
    const sync = () => setSavedIds(loadSavedJobIds(user?.id))
    sync()
    window.addEventListener('vgb:saved-jobs', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('vgb:saved-jobs', sync)
      window.removeEventListener('storage', sync)
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) { setAppliedJobs([]); return }
    let cancelled = false
    loadApplications().then((apps) => {
      if (cancelled) return
      const mineIds = new Set(apps.filter((a) => a.seekerId === user.id).map((a) => a.jobId))
      setAppliedJobs(jobs.filter((j) => mineIds.has(j.id)))
    })
    return () => { cancelled = true }
  }, [user?.id, jobs])

  const savedJobs = useMemo(
    () => savedIds.map((id) => jobs.find((j) => j.id === id)).filter((j): j is Job => !!j),
    [savedIds, jobs],
  )

  // 관심 업종·신호·추천 판정은 lib/jobSuggestions.ts 한 곳(앱과 공유) — 아래는 그 함수를 부르기만 한다.
  const preferredCategories = useMemo(() => preferredCategoryCounts(savedJobs, appliedJobs), [savedJobs, appliedJobs])
  const hasSignal = hasSuggestionSignal(preferredCategories, prefs.regionId as JobRegionId | undefined)

  const regionLabel = prefs.regionId
    ? JOB_REGIONS.find((r) => r.id === prefs.regionId)?.label
    : undefined

  const suggestions = useMemo(
    () => suggestJobs({ jobs, savedJobs, appliedJobs, regionId: prefs.regionId as JobRegionId | undefined, regionLabel }),
    [jobs, prefs.regionId, regionLabel, savedJobs, appliedJobs],
  )

  const filteredSuggestions = useMemo(
    () => suggestions.filter((s) => matchesDateRange(s.job.postedAt, dateRange)),
    [suggestions, dateRange],
  )
  const sortedSuggestions = sortValue === 'posted'
    ? [...filteredSuggestions].sort((a, b) => b.job.postedAt.localeCompare(a.job.postedAt))
    : filteredSuggestions
  const visibleSuggestions = sortedSuggestions.slice(0, pageSize)

  const handleApply = useCallback((job: Job) => {
    if (!user) { navigate('/dang-nhap'); return }
    openApply(job)
  }, [user, navigate, openApply])

  return (
    <div className="page jobs-menu-page">
      <header className="page-header">
        <h1 className="page-header__title">Gợi ý việc làm</h1>
        <p className="page-header__lead">
          Dựa trên tin bạn đã lưu/ứng tuyển và khu vực đã chọn ở "Việc làm phù hợp" — không suy đoán mức lương
          hay điều kiện chưa xác nhận.
        </p>
      </header>

      {!hasSignal ? (
        <div className="city-result__empty">
          <span>💡</span>
          <p>Chưa có đủ thông tin để gợi ý. Hãy lưu/ứng tuyển vài công việc bạn quan tâm, hoặc thiết lập điều kiện ở Việc làm phù hợp.</p>
          <Link to="/viec-lam/phu-hop">→ Thiết lập Việc làm phù hợp</Link>
        </div>
      ) : suggestions.length === 0 ? (
        <div className="city-result__empty">
          <span>🔍</span>
          <p>Chưa tìm thấy việc làm phù hợp với hoạt động/điều kiện hiện tại của bạn.</p>
          <NavLink to="/">← Xem tất cả việc làm</NavLink>
        </div>
      ) : (
        <>
          <JobsListToolbar
            count={filteredSuggestions.length}
            countLabel="việc gợi ý"
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            sortOptions={[
              { value: 'weight', label: 'Phù hợp nhất' },
              { value: 'posted', label: 'Đăng gần đây nhất' },
            ]}
            sortValue={sortValue}
            onSortChange={(v) => setSortValue(v as 'weight' | 'posted')}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            view={view}
            onViewChange={handleViewChange}
          />
          {view === 'table' ? (
            <JobsTable
              dateColumnLabel="Ngày đăng"
              showTrailingColumn
              rows={visibleSuggestions.map(({ job, reasons }): JobsTableRow => ({
                id: job.id,
                href: `/viec-lam/${job.id}`,
                region: job.location,
                title: job.title,
                company: job.company,
                salary: job.salary,
                salaryPeriod: job.salaryPeriod,
                description: job.description,
                hours: job.hours,
                dateLabel: formatShortDate(job.postedAt),
                badge: reasons[0],
                trailing: (
                  <button className="btn btn--primary btn--sm" onClick={() => handleApply(job)}>
                    Ứng tuyển
                  </button>
                ),
              }))}
            />
          ) : (
            <ul className="rec-list">
              {visibleSuggestions.map(({ job, reasons }) => (
                <li key={job.id} className="rec-card">
                  <div className="rec-card__score-row">
                    <div className="rec-card__reasons">
                      {reasons.map((r) => (
                        <span key={r} className="rec-card__reason">{r}</span>
                      ))}
                    </div>
                  </div>
                  <Link to={`/viec-lam/${job.id}`} className="rec-card__link">
                    <p className="rec-card__title">{job.title}</p>
                    <p className="rec-card__company">{job.company}</p>
                    <p className="rec-card__salary"><SalaryText job={job} /></p>
                    <p className="rec-card__location">📍 {job.location}</p>
                  </Link>
                  <div className="rec-card__actions">
                    <button className="btn btn--primary btn--sm" onClick={() => handleApply(job)}>
                      Ứng tuyển
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <ApplyModal status={status} job={applyJob} profile={profile} onConfirm={confirm} onClose={close} onRetry={retry} />
    </div>
  )
}
