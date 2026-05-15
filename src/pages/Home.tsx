import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ApplyModal from '../components/ApplyModal'
import { HomeBanner } from '../components/HomeBanner'
import JobCard from '../components/JobCard'
import { RecommendSection } from '../components/RecommendSection'
import { useApply } from '../components/useApply'
import { useAuth } from '../context/AuthContext'
import { useJobs } from '../context/JobsContext'
import {
  ALL_CATEGORIES,
  CATEGORY_COLORS,
  CATEGORY_SHORT,
} from '../data/categories'
import { jobMatchesRegion, type JobRegionId } from '../data/jobRegions'
import { hasAppliedToJob } from '../lib/applicationsStorage'
import { calcDistanceKm, guessCoordinatesFromLocation, normalizeViText } from '../lib/jobCoords'
import { loadSavedJobIds, toggleSavedJobId } from '../lib/storage'
import type { Job, JobCategory } from '../types/job'

/* ── Static data ─────────────────────────────────────────────────── */

const FEATURED_BRANDS = [
  { name: 'GrabFood',         search: 'Grab',      initial: 'G', color: '#00b14f', logo: 'https://logo.clearbit.com/grab.com' },
  { name: 'Highlands Coffee', search: 'Highlands', initial: 'H', color: '#006241', logo: 'https://logo.clearbit.com/highlandscoffee.vn' },
  { name: 'WinMart',          search: 'WinMart',   initial: 'W', color: '#e30613', logo: 'https://logo.clearbit.com/winmart.vn' },
  { name: 'Shopee',           search: 'Shopee',    initial: 'S', color: '#ff5722', logo: 'https://logo.clearbit.com/shopee.com' },
  { name: 'Be Group',         search: 'Be',        initial: 'B', color: '#f59e0b', logo: 'https://logo.clearbit.com/be.com.vn' },
  { name: 'Lotteria',         search: 'Lotteria',  initial: 'L', color: '#e60028', logo: 'https://logo.clearbit.com/lotteria.com' },
  { name: 'Circle K',         search: 'Circle',    initial: 'C', color: '#c8102e', logo: 'https://logo.clearbit.com/circlek.com' },
  { name: 'FamilyMart',       search: 'Family',    initial: 'F', color: '#00539f', logo: 'https://logo.clearbit.com/familymart.com' },
  { name: "McDonald's VN",    search: 'McDonald',  initial: 'M', color: '#27251F', logo: 'https://logo.clearbit.com/mcdonalds.com' },
  { name: 'KFC VN',           search: 'KFC',       initial: 'K', color: '#e4003b', logo: 'https://logo.clearbit.com/kfc.com' },
  { name: 'Samsung VN',       search: 'Samsung',   initial: 'S', color: '#1428a0', logo: 'https://logo.clearbit.com/samsung.com' },
  { name: 'Gogi House',       search: 'Gogi',      initial: 'G', color: '#d97706', logo: 'https://logo.clearbit.com/gogihouse.com' },
]

const CITY_SECTIONS: { id: JobRegionId; label: string; color: string; icon: string }[] = [
  { id: 'hanoi',     label: 'Hà Nội',           color: '#E53935', icon: '🏛️' },
  { id: 'hcm',       label: 'TP. Hồ Chí Minh',  color: '#F97316', icon: '🌆' },
  { id: 'danang',    label: 'Đà Nẵng',           color: '#3B82F6', icon: '🏖️' },
  { id: 'binhduong', label: 'Bình Dương',         color: '#10B981', icon: '🏭' },
  { id: 'bacninh',   label: 'Bắc Ninh',           color: '#8B5CF6', icon: '⚙️' },
  { id: 'haiphong',  label: 'Hải Phòng',          color: '#06B6D4', icon: '⚓' },
  { id: 'dongnai',   label: 'Đồng Nai',           color: '#F59E0B', icon: '🏗️' },
  { id: 'cantho',    label: 'Cần Thơ',            color: '#EC4899', icon: '🌾' },
]

/* ── Brand logo with image + initial fallback ───────────────────── */

function BrandLogo({ initial, color, logo }: {
  name: string; initial: string; color: string; logo: string
}) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <span className="home-brand__logo" style={{ background: color }}>
        <span className="home-brand__logo-initial">{initial}</span>
      </span>
    )
  }

  return (
    <span className="home-brand__logo home-brand__logo--img">
      <img
        src={logo}
        alt=""
        aria-hidden
        className="home-brand__logo-img"
        onError={() => setFailed(true)}
      />
    </span>
  )
}

/* ── City section sub-component ─────────────────────────────────── */

interface CitySectionProps {
  label: string
  color: string
  icon: string
  jobs: Job[]
  savedIds: Set<string>
  onApply: (j: Job) => void
  onToggleSave: (j: Job) => void
  isApplied: (id: string) => boolean
  onNavigate: (id: string) => void
}

function CitySection({ label, color, icon, jobs, savedIds, onApply, onToggleSave, isApplied, onNavigate }: CitySectionProps) {
  const [expanded, setExpanded] = useState(false)
  if (jobs.length === 0) return null
  const shown = expanded ? jobs : jobs.slice(0, 4)

  return (
    <section className="home-city-sec">
      <div className="home-city-sec__head">
        <span className="home-city-sec__icon">{icon}</span>
        <div>
          <h2 className="home-city-sec__title">{label}</h2>
          <span className="home-city-sec__count" style={{ color }}>{jobs.length} việc làm đang tuyển</span>
        </div>
        <div className="home-city-sec__bar" style={{ background: color }} />
      </div>

      <div className="home-city-sec__list">
        {shown.map((job) => (
          <div key={job.id} className="home-card-wrap" onClick={() => onNavigate(job.id)}>
            <JobCard
              job={job}
              isApplied={isApplied(job.id)}
              onApply={onApply}
              isSaved={savedIds.has(job.id)}
              onToggleSave={onToggleSave}
            />
          </div>
        ))}
      </div>

      {jobs.length > 4 && (
        <button
          className="home-city-sec__more"
          style={{ color }}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded
            ? '▲ Ẩn bớt'
            : `Xem thêm ${jobs.length - 4} việc làm tại ${label} ▼`}
        </button>
      )}
    </section>
  )
}

/* ── Main component ──────────────────────────────────────────────── */

export function Home() {
  const { jobs } = useJobs()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { status, job: applyJob, profile, openApply, confirm, close, retry } = useApply()

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<JobCategory | 'all'>('all')
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

  const handleToggleSave = useCallback((job: Job) => { toggleSavedJobId(job.id) }, [])

  const handleNearMe = useCallback(() => {
    if (nearMe) { setNearMe(false); return }
    if (userCoords) { setNearMe(true); return }
    if (!navigator.geolocation) { setGeoError('Trình duyệt không hỗ trợ định vị.'); return }
    setGeoLoading(true)
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => { setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setNearMe(true); setGeoLoading(false) },
      () => { setGeoError('Không thể lấy vị trí. Hãy cho phép định vị.'); setGeoLoading(false) },
      { timeout: 10_000 },
    )
  }, [nearMe, userCoords])

  const jobDistances = useMemo<Record<string, number>>(() => {
    if (!nearMe || !userCoords) return {}
    const r: Record<string, number> = {}
    for (const job of jobs) {
      const c = guessCoordinatesFromLocation(job.location)
      r[job.id] = calcDistanceKm(userCoords.lat, userCoords.lng, c.lat, c.lng)
    }
    return r
  }, [jobs, nearMe, userCoords])

  const jobCountByCategory = useMemo(() => {
    const c: Partial<Record<JobCategory | 'all', number>> = { all: jobs.length }
    for (const j of jobs) c[j.category] = (c[j.category] ?? 0) + 1
    return c
  }, [jobs])

  // Jobs per city for default browse view
  const jobsByCity = useMemo(() => {
    const result: Partial<Record<JobRegionId, Job[]>> = {}
    for (const city of CITY_SECTIONS) {
      const cityJobs = jobs.filter(j => jobMatchesRegion(j.location, city.id))
      if (cityJobs.length > 0) result[city.id] = cityJobs
    }
    return result
  }, [jobs])

  const filtered = useMemo(() => {
    const q = normalizeViText(search)
    let result = jobs.filter((j) => {
      if (category !== 'all' && j.category !== category) return false
      if (urgentOnly && !j.urgent) return false
      if (q && !normalizeViText(`${j.title} ${j.company} ${j.location}`).includes(q)) return false
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
  }, [jobs, search, category, urgentOnly, nearMe, userCoords, nearRadius, jobDistances])

  const urgentJobs = useMemo(() => filtered.filter((j) => j.urgent), [filtered])
  const regularJobs = useMemo(() => filtered.filter((j) => !j.urgent), [filtered])

  const handleApply = useCallback((job: Job) => {
    if (!user) { navigate('/dang-nhap'); return }
    openApply(job)
  }, [user, navigate, openApply])

  const resetFilters = () => {
    setSearch(''); setCategory('all'); setUrgentOnly(false); setNearMe(false)
  }

  const hasFilters = !!(search || category !== 'all' || urgentOnly || nearMe)

  const handleBrandClick = (brandSearch: string) => {
    setSearch(brandSearch); setCategory('all'); setNearMe(false)
  }

  const handleCategoryClick = (cat: JobCategory | 'all') => {
    setCategory(cat); setSearch(''); setNearMe(false)
  }

  const isApplied = useCallback((id: string) => hasAppliedToJob(id, user?.id), [user?.id])

  return (
    <div className="home-page">

      {/* ── Auto-rotating banner ────────────────────────────────── */}
      <HomeBanner />

      {/* ── Search bar ─────────────────────────────────────────── */}
      <div className="home-search-wrap">
        <div className="home-search">
          <svg className="home-search__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
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
            <button className="home-search__clear" onClick={() => setSearch('')} aria-label="Xóa">✕</button>
          )}
        </div>
      </div>

      {/* ── City sections — right below search ─────────────────── */}
      {!hasFilters && CITY_SECTIONS
        .filter(city => (jobsByCity[city.id]?.length ?? 0) > 0)
        .map(city => (
          <CitySection
            key={city.id}
            label={city.label}
            color={city.color}
            icon={city.icon}
            jobs={jobsByCity[city.id] ?? []}
            savedIds={savedIds}
            onApply={handleApply}
            onToggleSave={handleToggleSave}
            isApplied={isApplied}
            onNavigate={(id) => navigate(`/viec-lam/${id}`)}
          />
        ))
      }

      {/* ── Category grid ──────────────────────────────────────── */}
      <section className="home-cat-grid" aria-label="Lọc theo ngành nghề">
        <button
          className={`home-cat-card${category === 'all' ? ' home-cat-card--active' : ''}`}
          onClick={() => handleCategoryClick('all')}
        >
          <span className="home-cat-card__icon" style={{ background: CATEGORY_COLORS.all }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </span>
          <span className="home-cat-card__label">Tất cả</span>
          <span className="home-cat-card__count">{jobs.length}</span>
        </button>

        {ALL_CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`home-cat-card${category === cat ? ' home-cat-card--active' : ''}`}
            onClick={() => handleCategoryClick(cat)}
          >
            <span className="home-cat-card__icon" style={{ background: CATEGORY_COLORS[cat] }}>
              {cat === 'factory' && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M2 20V8l6-4v4l6-4v4l6-4v16H2z"/><path d="M6 20v-4h4v4M14 20v-4h4v4"/>
                </svg>
              )}
              {cat === 'cafe' && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M17 8h1a4 4 0 010 8h-1"/><path d="M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4V8z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/>
                </svg>
              )}
              {cat === 'delivery' && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
                </svg>
              )}
              {cat === 'cleaning' && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3 22l4-4M14 3l7 7-9.5 9.5L4 12l9-9zM4 12l4 4"/><path d="M14.5 6.5l3 3"/>
                </svg>
              )}
              {cat === 'retail' && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>
                </svg>
              )}
              {cat === 'other' && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              )}
            </span>
            <span className="home-cat-card__label">{CATEGORY_SHORT[cat]}</span>
            <span className="home-cat-card__count">{jobCountByCategory[cat] ?? 0}</span>
          </button>
        ))}
      </section>

      {/* ── Featured brands ────────────────────────────────────── */}
      <section className="home-brands">
        <div className="home-brands__head">
          <h2 className="home-brands__title">🏢 Nhà tuyển dụng nổi bật</h2>
          <span className="home-brands__sub">Nhấn để lọc</span>
        </div>
        <div className="home-brands__row">
          {FEATURED_BRANDS.map((b) => (
            <button
              key={b.name}
              className="home-brand"
              onClick={() => handleBrandClick(b.search)}
              title={b.name}
            >
              <BrandLogo name={b.name} initial={b.initial} color={b.color} logo={b.logo} />
              <span className="home-brand__name">{b.name}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Promo strip ────────────────────────────────────────── */}
      {!hasFilters && (
        <div className="home-promo">
          <div className="home-promo__content">
            <span className="home-promo__icon">📋</span>
            <div>
              <p className="home-promo__title">Tạo CV ngay — tăng cơ hội được gọi!</p>
              <p className="home-promo__sub">Nhà tuyển dụng tìm kiếm CV mỗi ngày.</p>
            </div>
          </div>
          <button className="home-promo__btn" onClick={() => navigate('/ho-so')}>
            Tạo CV miễn phí →
          </button>
        </div>
      )}

      {/* ── Filter bar ─────────────────────────────────────────── */}
      <div className="home-filter-bar">
        <span className="home-result-count">
          {hasFilters ? `${filtered.length} kết quả` : `${jobs.length} việc làm`}
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
        {hasFilters && (
          <button className="home-reset-btn" onClick={resetFilters}>✕ Xóa lọc</button>
        )}
      </div>

      {nearMe && userCoords && (
        <div className="home-radius-wrap" role="group" aria-label="Bán kính">
          {[1, 3, 5, 10].map((r) => (
            <button key={r} className={`home-radius-btn${nearRadius === r ? ' home-radius-btn--active' : ''}`} onClick={() => setNearRadius(r)}>
              {r} km
            </button>
          ))}
        </div>
      )}
      {geoError && <p className="home-geo-error" role="alert">{geoError}</p>}

      {/* ── Default view: recommend section ────────────────────── */}
      {!hasFilters && <RecommendSection jobs={jobs} />}

      {/* ── Filtered view ──────────────────────────────────────── */}
      {hasFilters && (
        <>
          {filtered.length === 0 ? (
            <div className="home-empty">
              <span className="home-empty__icon">🔍</span>
              <p className="home-empty__text">Không tìm thấy việc làm phù hợp</p>
              <button className="home-empty__reset" onClick={resetFilters}>Xóa bộ lọc</button>
            </div>
          ) : nearMe && userCoords ? (
            <section className="home-section">
              <h2 className="home-section__title">📍 Việc làm gần bạn</h2>
              {filtered.map((job) => (
                <div key={job.id} className="home-card-wrap" onClick={() => navigate(`/viec-lam/${job.id}`)}>
                  <JobCard job={job} isApplied={isApplied(job.id)} onApply={handleApply} isSaved={savedIds.has(job.id)} onToggleSave={handleToggleSave} distanceKm={jobDistances[job.id]} />
                </div>
              ))}
            </section>
          ) : (
            <>
              {!urgentOnly && urgentJobs.length > 0 && (
                <section className="home-section">
                  <h2 className="home-section__title">🔥 Tuyển gấp</h2>
                  {urgentJobs.map((job, i) => (
                    <div key={job.id} className="home-card-wrap" onClick={() => navigate(`/viec-lam/${job.id}`)}>
                      <JobCard job={job} isApplied={isApplied(job.id)} onApply={handleApply} isSaved={savedIds.has(job.id)} onToggleSave={handleToggleSave} rank={i + 1} />
                    </div>
                  ))}
                </section>
              )}
              {(urgentOnly ? filtered : regularJobs).length > 0 && (
                <section className="home-section">
                  {!urgentOnly && urgentJobs.length > 0 && <h2 className="home-section__title">📋 Tất cả kết quả</h2>}
                  {(urgentOnly ? filtered : regularJobs).map((job) => (
                    <div key={job.id} className="home-card-wrap" onClick={() => navigate(`/viec-lam/${job.id}`)}>
                      <JobCard job={job} isApplied={isApplied(job.id)} onApply={handleApply} isSaved={savedIds.has(job.id)} onToggleSave={handleToggleSave} />
                    </div>
                  ))}
                </section>
              )}
            </>
          )}
        </>
      )}

      <ApplyModal status={status} job={applyJob} profile={profile} onConfirm={confirm} onClose={close} onRetry={retry} />
    </div>
  )
}
