import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink, useNavigate, useSearchParams } from 'react-router-dom'
import ApplyModal from '../../components/ApplyModal'
import JobCard from '../../components/JobCard'
import { useApply } from '../../components/useApply'
import { useAuth } from '../../context/AuthContext'
import { useJobs } from '../../context/JobsContext'
import { JOB_REGIONS, jobMatchesRegion, type JobRegionId } from '../../data/jobRegions'
import { loadApplications } from '../../lib/applicationsStorage'
import { loadSavedJobIds, toggleSavedJobId } from '../../lib/storage'
import type { Job } from '../../types/job'

/**
 * 급구 공고 — local_jobs.urgent === true인 공고만 모아 보여준다. 제목의
 * 모호한 단어("gấp" 등)로 urgent를 임의 판정하지 않는다 — jobRows.ts가
 * DB 컬럼값을 그대로 매핑하고(ensureJobFields의 키워드 추론은 값이 이미
 * boolean으로 채워진 뒤라 실질적으로 적용되지 않음), 이 페이지는 그
 * job.urgent 값만 신뢰한다. 지역은 사용자가 직접 선택하며, 위치 권한을
 * 강제로 요청하지 않는다(수동 선택만 제공).
 */
export default function UrgentJobsPage() {
  const { jobs } = useJobs()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { status, job: applyJob, profile, openApply, confirm, close, retry } = useApply()

  const [regionId, setRegionId] = useState<JobRegionId | 'all'>(
    (searchParams.get('region') as JobRegionId) || 'all',
  )
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set(loadSavedJobIds(user?.id)))
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const sync = () => setSavedIds(new Set(loadSavedJobIds(user?.id)))
    sync()
    window.addEventListener('vgb:saved-jobs', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('vgb:saved-jobs', sync)
      window.removeEventListener('storage', sync)
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) { setAppliedIds(new Set()); return }
    let cancelled = false
    loadApplications().then((apps) => {
      if (cancelled) return
      setAppliedIds(new Set(apps.filter((a) => a.seekerId === user.id).map((a) => a.jobId)))
    })
    return () => { cancelled = true }
  }, [user?.id])

  const handleToggleSave = useCallback((job: Job) => {
    toggleSavedJobId(job.id, user?.id)
    setSavedIds(new Set(loadSavedJobIds(user?.id)))
  }, [user?.id])

  const handleApply = useCallback((job: Job) => {
    if (!user) { navigate('/dang-nhap'); return }
    openApply(job)
  }, [user, navigate, openApply])

  const handleRegionChange = (id: JobRegionId | 'all') => {
    setRegionId(id)
    const next = new URLSearchParams(searchParams)
    if (id === 'all') next.delete('region')
    else next.set('region', id)
    setSearchParams(next, { replace: true })
  }

  // 모집 중인 급구만: 급구(urgent)라도 지원 마감일이 이미 지났으면 급구 목록에서
  // 제외한다(SavedJobsPage의 "모집 중/마감" 판정과 동일 기준 — 마감일이 없으면
  // 상시 모집으로 보고 포함).
  const todayStr = new Date().toISOString().slice(0, 10)
  const urgentJobs = useMemo(
    () => jobs.filter((j) => j.urgent && (!j.applicationDeadline || j.applicationDeadline >= todayStr)),
    [jobs, todayStr],
  )
  const filtered = useMemo(() => {
    if (regionId === 'all') return urgentJobs
    return urgentJobs.filter((j) => jobMatchesRegion(j.location, regionId, j.workLocations))
  }, [urgentJobs, regionId])

  const isApplied = useCallback((id: string) => appliedIds.has(id), [appliedIds])

  return (
    <div className="page jobs-menu-page">
      <header className="page-header">
        <h1 className="page-header__title">🔥 Tuyển gấp</h1>
        <p className="page-header__lead">
          Các công việc nhà tuyển dụng đánh dấu cần tuyển gấp — chọn khu vực để lọc theo nơi bạn muốn làm.
        </p>
      </header>

      <div className="jm-region-picker" role="group" aria-label="Chọn khu vực">
        <button
          type="button"
          className={`jm-region-picker__btn${regionId === 'all' ? ' is-active' : ''}`}
          onClick={() => handleRegionChange('all')}
        >
          Tất cả khu vực
        </button>
        {JOB_REGIONS.map((r) => (
          <button
            key={r.id}
            type="button"
            className={`jm-region-picker__btn${regionId === r.id ? ' is-active' : ''}`}
            onClick={() => handleRegionChange(r.id)}
          >
            {r.label}
          </button>
        ))}
      </div>

      <p className="jm-result-count">{filtered.length} việc làm tuyển gấp</p>

      {filtered.length === 0 ? (
        <div className="city-result__empty">
          <span>🔍</span>
          <p>Chưa có việc làm tuyển gấp {regionId !== 'all' ? 'tại khu vực này' : ''}.</p>
          <NavLink to="/">← Xem tất cả việc làm</NavLink>
        </div>
      ) : (
        <div className="home-jobs-grid">
          {filtered.map((job) => (
            <NavLink key={job.id} className="home-card-wrap" to={`/viec-lam/${job.id}`}>
              <JobCard
                job={job}
                isApplied={isApplied(job.id)}
                onApply={handleApply}
                isSaved={savedIds.has(job.id)}
                onToggleSave={handleToggleSave}
              />
            </NavLink>
          ))}
        </div>
      )}

      <ApplyModal status={status} job={applyJob} profile={profile} onConfirm={confirm} onClose={close} onRetry={retry} />
    </div>
  )
}
