import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ApplyModal from '../components/ApplyModal'
import JobCard from '../components/JobCard'
import { RegionFilter } from '../components/RegionFilter'
import { useApply } from '../components/useApply'
import { useAuth } from '../context/AuthContext'
import { useJobs } from '../context/JobsContext'
import { ALL_CATEGORIES, CATEGORY_ICONS, CATEGORY_LABELS } from '../data/categories'
import { jobMatchesRegion, type RegionFilter as RegionFilterType } from '../data/jobRegions'
import { hasAppliedToJob } from '../lib/applicationsStorage'
import { calcDistanceKm, guessCoordinatesFromLocation, normalizeViText } from '../lib/jobCoords'
import { loadSavedJobIds, toggleSavedJobId } from '../lib/storage'
import type { Job, JobCategory } from '../types/job'

export function Home() {
  const { jobs } = useJobs()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { status, job: applyJob, profile, openApply, confirm, close, retry } = useApply()

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<JobCategory | 'all'>('all')
  const [region, setRegion] = useState<RegionFilterType>('all')
  const [urgentOnly, setUrgentOnly] = useState(false)
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set(loadSavedJobIds()))

  const [nearMe, setNearMe] = useState(false)
  const [nearRadius, setNearRadius] = useState(5)
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)

  useEffect(() => {
    const sync = () => setSavedIds(new Set(loadSavedJobIds()))
    window.addEventListener('jobi:saved-jobs', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('jobi:saved-jobs', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const handleToggleSave = (job: Job) => {
    toggleSavedJobId(job.id)
  }

  const handleNearMe = useCallback(() => {
    if (nearMe) {
      setNearMe(false)
      return
    }
    if (userCoords) {
      setNearMe(true)
      return
    }
    if (!navigator.geolocation) {
      setGeoError('Trình duyệt không hỗ trợ định vị.')
      return
    }
    setGeoLoading(true)
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setNearMe(true)
        setGeoLoading(false)
      },
      () => {
        setGeoError('Không thể lấy vị trí. Hãy cho phép định vị trên trình duyệt.')
        setGeoLoading(false)
      },
      { timeout: 10_000 },
    )
  }, [nearMe, userCoords])

  const jobDistances = useMemo<Record<string, number>>(() => {
    if (!nearMe || !userCoords) return {}
    const result: Record<string, number> = {}
    for (const job of jobs) {
      const coords = guessCoordinatesFromLocation(job.location)
      result[job.id] = calcDistanceKm(userCoords.lat, userCoords.lng, coords.lat, coords.lng)
    }
    return result
  }, [jobs, nearMe, userCoords])

  const filtered = useMemo(() => {
    const q = normalizeViText(search)
    let result = jobs.filter((j) => {
      if (category !== 'all' && j.category !== category) return false
      if (region !== 'all' && !jobMatchesRegion(j.location, region)) return false
      if (urgentOnly && !j.urgent) return false
      if (q) {
        const hay = normalizeViText(`${j.title} ${j.company} ${j.location}`)
        if (!hay.includes(q)) return false
      }
      if (nearMe && userCoords) {
        const d = jobDistances[j.id]
        if (d === undefined || d > nearRadius) return false
      }
      return true
    })
    if (nearMe && userCoords) {
      result = [...result].sort((a, b) => (jobDistances[a.id] ?? 99) - (jobDistances[b.id] ?? 99))
    }
    return result
  }, [jobs, search, category, region, urgentOnly, nearMe, userCoords, nearRadius, jobDistances])

  const urgentJobs = useMemo(() => filtered.filter((j) => j.urgent), [filtered])
  const regularJobs = useMemo(() => filtered.filter((j) => !j.urgent), [filtered])

  const handleApply = (job: Job) => {
    if (!user) {
      navigate('/dang-nhap')
      return
    }
    openApply(job)
  }

  const resetFilters = () => {
    setSearch('')
    setCategory('all')
    setRegion('all')
    setUrgentOnly(false)
    setNearMe(false)
  }

  const hasFilters = search || category !== 'all' || region !== 'all' || urgentOnly || nearMe

  return (
    <div className="home-page">
      {/* Search */}
      <div className="home-search-wrap">
        <div className="home-search">
          <svg className="home-search__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            type="search"
            className="home-search__input"
            placeholder="Tìm việc làm, công ty, địa điểm..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Tìm kiếm việc làm"
          />
          {search && (
            <button className="home-search__clear" onClick={() => setSearch('')} aria-label="Xóa tìm kiếm">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Category chips */}
      <div className="chip-row home-categories" role="group" aria-label="Lọc theo ngành nghề">
        <button
          className={`chip${category === 'all' ? ' chip--active' : ''}`}
          onClick={() => setCategory('all')}
        >
          ✨ Tất cả
        </button>
        {ALL_CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`chip${category === cat ? ' chip--active' : ''}`}
            onClick={() => setCategory(cat)}
          >
            {CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Region filter */}
      <div className="home-region-wrap">
        <RegionFilter value={region} onChange={setRegion} />
      </div>

      {/* Filter bar */}
      <div className="home-filter-bar">
        <span className="home-result-count">
          {filtered.length} việc làm
          {nearMe && userCoords && ` trong ${nearRadius}km`}
        </span>
        <button
          className={`home-urgent-toggle${urgentOnly ? ' home-urgent-toggle--active' : ''}`}
          onClick={() => setUrgentOnly((v) => !v)}
          aria-pressed={urgentOnly}
        >
          🔥 Tuyển gấp
        </button>
        <button
          className={`home-near-btn${nearMe ? ' home-near-btn--active' : ''}${geoLoading ? ' home-near-btn--loading' : ''}`}
          onClick={handleNearMe}
          disabled={geoLoading}
          aria-pressed={nearMe}
        >
          {geoLoading ? 'Đang định vị...' : '📍 Gần tôi'}
        </button>
      </div>
      {nearMe && userCoords && (
        <div className="home-radius-wrap" role="group" aria-label="Bán kính tìm kiếm">
          {[1, 3, 5, 10].map((r) => (
            <button
              key={r}
              className={`home-radius-btn${nearRadius === r ? ' home-radius-btn--active' : ''}`}
              onClick={() => setNearRadius(r)}
            >
              {r} km
            </button>
          ))}
        </div>
      )}
      {geoError && <p className="home-geo-error" role="alert">{geoError}</p>}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="home-empty">
          <span className="home-empty__icon">🔍</span>
          <p className="home-empty__text">Không tìm thấy việc làm phù hợp</p>
          {hasFilters && (
            <button className="home-empty__reset" onClick={resetFilters}>
              Xóa bộ lọc
            </button>
          )}
        </div>
      )}

      {/* Near-me: flat list sorted by distance */}
      {nearMe && userCoords ? (
        filtered.length > 0 ? (
          <section className="home-section">
            <h2 className="home-section__title">📍 Việc làm gần bạn</h2>
            {filtered.map((job) => (
              <div
                key={job.id}
                className="home-card-wrap"
                onClick={() => navigate(`/viec-lam/${job.id}`)}
              >
                <JobCard
                  job={job}
                  isApplied={hasAppliedToJob(job.id, user?.id)}
                  onApply={(j) => { handleApply(j) }}
                  isSaved={savedIds.has(job.id)}
                  onToggleSave={handleToggleSave}
                  distanceKm={jobDistances[job.id]}
                />
              </div>
            ))}
          </section>
        ) : null
      ) : (
        <>
          {/* Urgent section */}
          {!urgentOnly && urgentJobs.length > 0 && (
            <section className="home-section">
              <h2 className="home-section__title">🔥 Tuyển gấp</h2>
              {urgentJobs.map((job, i) => (
                <div
                  key={job.id}
                  className="home-card-wrap"
                  onClick={() => navigate(`/viec-lam/${job.id}`)}
                >
                  <JobCard
                    job={job}
                    isApplied={hasAppliedToJob(job.id, user?.id)}
                    onApply={(j) => { handleApply(j) }}
                    isSaved={savedIds.has(job.id)}
                    onToggleSave={handleToggleSave}
                    rank={i + 1}
                  />
                </div>
              ))}
            </section>
          )}

          {/* Main jobs list */}
          {(urgentOnly ? filtered : regularJobs).length > 0 && (
            <section className="home-section">
              {!urgentOnly && urgentJobs.length > 0 && (
                <h2 className="home-section__title">📋 Tất cả việc làm</h2>
              )}
              {(urgentOnly ? filtered : regularJobs).map((job) => (
                <div
                  key={job.id}
                  className="home-card-wrap"
                  onClick={() => navigate(`/viec-lam/${job.id}`)}
                >
                  <JobCard
                    job={job}
                    isApplied={hasAppliedToJob(job.id, user?.id)}
                    onApply={(j) => { handleApply(j) }}
                    isSaved={savedIds.has(job.id)}
                    onToggleSave={handleToggleSave}
                  />
                </div>
              ))}
            </section>
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
    </div>
  )
}
