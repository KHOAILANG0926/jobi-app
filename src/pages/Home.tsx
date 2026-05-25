import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

const CITY_BUTTONS: { id: JobRegionId; label: string }[] = [
  { id: 'hanoi',      label: 'Hà Nội' },
  { id: 'hcm',        label: 'TP. HCM' },
  { id: 'danang',     label: 'Đà Nẵng' },
  { id: 'binhduong',  label: 'Bình Dương' },
  { id: 'bacninh',    label: 'Bắc Ninh' },
  { id: 'haiphong',   label: 'Hải Phòng' },
  { id: 'dongnai',    label: 'Đồng Nai' },
  { id: 'cantho',     label: 'Cần Thơ' },
  { id: 'hunguyen',   label: 'Hưng Yên' },
  { id: 'thainguyen', label: 'Thái Nguyên' },
  { id: 'vinhphuc',   label: 'Vĩnh Phúc' },
  { id: 'bacgiang',   label: 'Bắc Giang' },
  { id: 'haiduong',   label: 'Hải Dương' },
]

/* ── Ad slot (replace <div className="ad-slot__ph"> with real ad code) */

const AD_CONFIGS = {
  header: {
    bg: 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)',
    icon: '🎓',
    eyebrow: 'Khóa học kỹ năng nghề',
    headline: 'Nâng cao kỹ năng — tăng lương ngay',
    sub: 'Hơn 200 khóa học chứng chỉ nghề trực tuyến',
    cta: 'Đăng ký miễn phí →',
    light: true,
  },
  mid: {
    bg: 'linear-gradient(135deg,#0f2027 0%,#203a43 50%,#2c5364 100%)',
    icon: '🏢',
    eyebrow: 'Dành cho nhà tuyển dụng',
    headline: 'Tìm ứng viên chất lượng cao',
    sub: 'Đăng tin miễn phí — Tiếp cận 50.000+ ứng viên',
    cta: 'Đăng tin ngay →',
    light: true,
  },
  inline: {
    bg: 'linear-gradient(90deg,#f7971e 0%,#ffd200 100%)',
    icon: '📱',
    headline: 'Tải app Việc gần Bạn — Nhận việc làm trên di động',
    cta: 'Tải ngay miễn phí →',
    light: false,
  },
}

interface AdSlotProps {
  slotId: keyof typeof AD_CONFIGS
}

function AdSlot({ slotId }: AdSlotProps) {
  const cfg = AD_CONFIGS[slotId]
  if (slotId === 'inline') {
    return (
      <div className="ad-slot ad-slot--inline" data-ad-slot={slotId} style={{ background: cfg.bg }}>
        <div className="ad-slot__inline-content">
          <span className="ad-slot__inline-icon">{cfg.icon}</span>
          <span className="ad-slot__inline-text" style={{ color: cfg.light ? '#fff' : '#1a1a1a' }}>
            {cfg.headline}
          </span>
          <a href="mailto:ads@jobi.vn" className="ad-slot__inline-cta" style={{ color: cfg.light ? '#fff' : '#7c2d12' }}>
            {cfg.cta}
          </a>
        </div>
        <span className="ad-slot__label" style={{ color: cfg.light ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.4)' }}>QC</span>
      </div>
    )
  }
  const textColor = cfg.light ? '#fff' : '#1a1a1a'
  const subColor  = cfg.light ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.6)'
  return (
    <div className="ad-slot" data-ad-slot={slotId} style={{ background: cfg.bg }}>
      <span className="ad-slot__label" style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)' }}>QC</span>
      <div className="ad-slot__content">
        <span className="ad-slot__big-icon">{cfg.icon}</span>
        <div className="ad-slot__text-wrap">
          {'eyebrow' in cfg && <p className="ad-slot__eyebrow" style={{ color: 'rgba(255,255,255,0.7)' }}>{cfg.eyebrow}</p>}
          <p className="ad-slot__headline" style={{ color: textColor }}>{cfg.headline}</p>
          {'sub' in cfg && <p className="ad-slot__sub" style={{ color: subColor }}>{cfg.sub}</p>}
        </div>
        <a href="mailto:ads@jobi.vn" className="ad-slot__cta-btn">
          {cfg.cta}
        </a>
      </div>
    </div>
  )
}

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
      <img src={logo} alt="" aria-hidden className="home-brand__logo-img" onError={() => setFailed(true)} />
    </span>
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
  const [selectedCity, setSelectedCity] = useState<JobRegionId | null>(null)

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
    setGeoLoading(true); setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => { setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setNearMe(true); setGeoLoading(false) },
      () => { setGeoError('Không thể lấy vị trí.'); setGeoLoading(false) },
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

  // City counts: always based on full job list (ignore category/urgentOnly)
  // so count matches what clicking the button will show (after reset)
  const cityJobCounts = useMemo(() => {
    const c: Partial<Record<JobRegionId, number>> = {}
    for (const city of CITY_BUTTONS) {
      c[city.id] = jobs.filter(j => jobMatchesRegion(j.location, city.id)).length
    }
    return c
  }, [jobs])

  const filtered = useMemo(() => {
    const q = normalizeViText(search)
    let result = jobs.filter((j) => {
      if (category !== 'all' && j.category !== category) return false
      if (urgentOnly && !j.urgent) return false
      if (selectedCity && !jobMatchesRegion(j.location, selectedCity)) return false
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
  }, [jobs, search, category, urgentOnly, selectedCity, nearMe, userCoords, nearRadius, jobDistances])

  const urgentJobs  = useMemo(() => filtered.filter((j) => j.urgent), [filtered])
  const regularJobs = useMemo(() => filtered.filter((j) => !j.urgent), [filtered])

  const handleApply = useCallback((job: Job) => {
    if (!user) { navigate('/dang-nhap'); return }
    openApply(job)
  }, [user, navigate, openApply])

  // Ref for scrolling to city results
  const cityResultRef = useRef<HTMLElement>(null)

  // Scroll to results when a city is selected
  useEffect(() => {
    if (selectedCity && cityResultRef.current) {
      cityResultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [selectedCity])

  const resetFilters = () => {
    setSearch(''); setCategory('all'); setUrgentOnly(false); setNearMe(false); setSelectedCity(null)
  }

  // Filters that are NOT city-based (used for the bottom job section)
  const hasOtherFilters = !!(search || category !== 'all' || urgentOnly || nearMe)
  const hasFilters = !!(hasOtherFilters || selectedCity)

  const handleBrandClick = (brandSearch: string) => {
    setSearch(brandSearch); setCategory('all'); setNearMe(false); setSelectedCity(null)
  }
  const handleCategoryClick = (cat: JobCategory | 'all') => {
    setCategory(cat); setSearch(''); setNearMe(false)
  }
  const handleCityClick = (id: JobRegionId) => {
    setSelectedCity(prev => prev === id ? null : id)
    // Reset all other filters so city count matches displayed results
    setSearch('')
    setCategory('all')
    setUrgentOnly(false)
    setNearMe(false)
  }

  const isApplied = useCallback((id: string) => hasAppliedToJob(id, user?.id), [user?.id])

  const JobGrid = ({ jobs: list, title }: { jobs: Job[]; title?: string }) => (
    <section className="home-section">
      {title && <h2 className="home-section__title">{title}</h2>}
      <div className="home-jobs-grid">
        {list.map((job) => (
          <div key={job.id} className="home-card-wrap" onClick={() => navigate(`/viec-lam/${job.id}`)}>
            <JobCard
              job={job}
              isApplied={isApplied(job.id)}
              onApply={handleApply}
              isSaved={savedIds.has(job.id)}
              onToggleSave={handleToggleSave}
              distanceKm={jobDistances[job.id]}
            />
          </div>
        ))}
      </div>
    </section>
  )

  return (
    <div className="home-page">

      {/* ── Banner ─────────────────────────────────────────────── */}
      <HomeBanner />

      {/* ── Ad slot 1: Header ──────────────────────────────────── */}
      <AdSlot slotId="header" />

      {/* ── Search ─────────────────────────────────────────────── */}
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
          {search && <button className="home-search__clear" onClick={() => setSearch('')} aria-label="Xóa">✕</button>}
        </div>
      </div>

      {/* ── City button grid ───────────────────────────────────── */}
      <section className="city-grid" aria-label="Lọc theo thành phố">
        <div className="city-grid__head">
          <span className="city-grid__icon">📍</span>
          <h2 className="city-grid__title">Tìm việc theo khu vực</h2>
        </div>
        <div className="city-grid__buttons">
          <button
            className={`city-btn${!selectedCity ? ' city-btn--all' : ''}`}
            onClick={() => setSelectedCity(null)}
          >
            <span className="city-btn__label">🌐 Tất cả</span>
            <span className="city-btn__count">{jobs.length}</span>
          </button>
          {CITY_BUTTONS.map((city) => {
            const count = cityJobCounts[city.id] ?? 0
            return (
              <button
                key={city.id}
                className={`city-btn${selectedCity === city.id ? ' city-btn--active' : ''}${count === 0 ? ' city-btn--empty' : ''}`}
                onClick={() => handleCityClick(city.id)}
                disabled={count === 0}
              >
                <span className="city-btn__label">{city.label}</span>
                {count > 0 && <span className="city-btn__count">{count}</span>}
              </button>
            )
          })}
        </div>
      </section>

      {/* ── City filtered results — right below city buttons ──── */}
      {selectedCity && (() => {
        const cityLabel = CITY_BUTTONS.find(c => c.id === selectedCity)?.label ?? ''
        return (
          <section className="city-result" ref={cityResultRef}>
            <div className="city-result__head">
              <div className="city-result__title-wrap">
                <span className="city-result__pin">📍</span>
                <h2 className="city-result__title">Việc làm tại {cityLabel}</h2>
                <span className="city-result__count">{filtered.length} kết quả</span>
              </div>
              <button className="city-result__clear" onClick={() => setSelectedCity(null)}>
                ✕ Bỏ chọn
              </button>
            </div>

            {filtered.length === 0 ? (
              <div className="city-result__empty">
                <span>🔍</span>
                <p>Chưa có việc làm tại <strong>{cityLabel}</strong></p>
                <button onClick={() => setSelectedCity(null)}>← Xem tất cả</button>
              </div>
            ) : (
              <>
                {urgentJobs.length > 0 && (
                  <div className="home-jobs-grid">
                    {urgentJobs.map(job => (
                      <div key={job.id} className="home-card-wrap" onClick={() => navigate(`/viec-lam/${job.id}`)}>
                        <JobCard job={job} isApplied={isApplied(job.id)} onApply={handleApply} isSaved={savedIds.has(job.id)} onToggleSave={handleToggleSave} />
                      </div>
                    ))}
                  </div>
                )}
                {urgentJobs.length > 0 && regularJobs.length > 0 && (
                  <AdSlot slotId="inline" />
                )}
                {regularJobs.length > 0 && (
                  <div className="home-jobs-grid">
                    {regularJobs.map(job => (
                      <div key={job.id} className="home-card-wrap" onClick={() => navigate(`/viec-lam/${job.id}`)}>
                        <JobCard job={job} isApplied={isApplied(job.id)} onApply={handleApply} isSaved={savedIds.has(job.id)} onToggleSave={handleToggleSave} />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        )
      })()}

      {/* ── Category grid ──────────────────────────────────────── */}
      <section className="home-cat-grid" aria-label="Lọc theo ngành nghề">
        <button
          className={`home-cat-card${category === 'all' ? ' home-cat-card--active' : ''}`}
          onClick={() => handleCategoryClick('all')}
        >
          <span className="home-cat-card__icon" style={{ background: CATEGORY_COLORS.all }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </span>
          <span className="home-cat-card__label">Tất cả</span>
          <span className="home-cat-card__count">{jobs.length}</span>
        </button>
        {ALL_CATEGORIES.map((cat) => (
          <button key={cat} className={`home-cat-card${category === cat ? ' home-cat-card--active' : ''}`} onClick={() => handleCategoryClick(cat)}>
            <span className="home-cat-card__icon" style={{ background: CATEGORY_COLORS[cat] }}>
              {cat === 'factory'  && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M2 20V8l6-4v4l6-4v4l6-4v16H2z"/><path d="M6 20v-4h4v4M14 20v-4h4v4"/></svg>}
              {cat === 'cafe'     && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M17 8h1a4 4 0 010 8h-1"/><path d="M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4V8z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>}
              {cat === 'delivery' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>}
              {cat === 'cleaning' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 22l4-4M14 3l7 7-9.5 9.5L4 12l9-9zM4 12l4 4"/><path d="M14.5 6.5l3 3"/></svg>}
              {cat === 'retail'   && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>}
              {cat === 'other'    && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
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
            <button key={b.name} className="home-brand" onClick={() => handleBrandClick(b.search)} title={b.name}>
              <BrandLogo name={b.name} initial={b.initial} color={b.color} logo={b.logo} />
              <span className="home-brand__name">{b.name}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Ad slot 2: Mid ─────────────────────────────────────── */}
      <AdSlot slotId="mid" />

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
          <button className="home-promo__btn" onClick={() => navigate('/ho-so')}>Tạo CV miễn phí →</button>
        </div>
      )}

      {/* ── Filter bar ─────────────────────────────────────────── */}
      <div className="home-filter-bar">
        <span className="home-result-count">
          {selectedCity
            ? `${filtered.length} việc làm tại ${CITY_BUTTONS.find(c => c.id === selectedCity)?.label}`
            : hasFilters
            ? `${filtered.length} kết quả`
            : `${jobs.length} việc làm`}
          {nearMe && userCoords && ` trong ${nearRadius}km`}
        </span>
        <button
          className={`home-urgent-toggle${urgentOnly ? ' home-urgent-toggle--active' : ''}`}
          onClick={() => setUrgentOnly(v => !v)}
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
        {hasFilters && <button className="home-reset-btn" onClick={resetFilters}>✕ Xóa lọc</button>}
      </div>

      {nearMe && userCoords && (
        <div className="home-radius-wrap" role="group" aria-label="Bán kính">
          {[1, 3, 5, 10].map(r => (
            <button key={r} className={`home-radius-btn${nearRadius === r ? ' home-radius-btn--active' : ''}`} onClick={() => setNearRadius(r)}>
              {r} km
            </button>
          ))}
        </div>
      )}
      {geoError && <p className="home-geo-error" role="alert">{geoError}</p>}

      {/* ── Bottom job section: only when NO city is selected ──── */}
      {!selectedCity && (
        <>
          {!hasOtherFilters && <RecommendSection jobs={jobs} />}

          {hasOtherFilters && filtered.length === 0 ? (
            <div className="home-empty">
              <span className="home-empty__icon">🔍</span>
              <p className="home-empty__text">Không tìm thấy việc làm phù hợp</p>
              <button className="home-empty__reset" onClick={resetFilters}>Xóa bộ lọc</button>
            </div>
          ) : nearMe && userCoords ? (
            <JobGrid jobs={filtered} title="📍 Việc làm gần bạn" />
          ) : (
            <>
              {!urgentOnly && urgentJobs.length > 0 && (
                <JobGrid jobs={urgentJobs} title="🔥 Tuyển gấp" />
              )}
              {!urgentOnly && urgentJobs.length > 0 && regularJobs.length > 0 && (
                <AdSlot slotId="inline" />
              )}
              {(urgentOnly ? filtered : regularJobs).length > 0 && (
                <JobGrid
                  jobs={urgentOnly ? filtered : regularJobs}
                  title={(!urgentOnly && urgentJobs.length > 0) ? '📋 Tất cả kết quả' : undefined}
                />
              )}
            </>
          )}
        </>
      )}

      {/* ── Stats & Ad Inquiry Section ─────────────────────────── */}
      <section style={{
        margin: '32px 0 16px',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)'
      }}>
        {/* Subscriber stats */}
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '28px 24px',
          color: '#fff',
          textAlign: 'center'
        }}>
          <p style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '0.08em', opacity: 0.8, marginBottom: '16px', textTransform: 'uppercase' }}>
            Cong dong Viec gan Ban
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: '36px', fontWeight: 800, lineHeight: 1 }}>50.000+</p>
              <p style={{ fontSize: '13px', opacity: 0.85, marginTop: '4px' }}>Nguoi tim viec</p>
            </div>
            <div style={{ width: '1px', background: 'rgba(255,255,255,0.25)', alignSelf: 'stretch' }} />
            <div>
              <p style={{ fontSize: '36px', fontWeight: 800, lineHeight: 1 }}>1.200+</p>
              <p style={{ fontSize: '13px', opacity: 0.85, marginTop: '4px' }}>Nha tuyen dung</p>
            </div>
            <div style={{ width: '1px', background: 'rgba(255,255,255,0.25)', alignSelf: 'stretch' }} />
            <div>
              <p style={{ fontSize: '36px', fontWeight: 800, lineHeight: 1 }}>25+</p>
              <p style={{ fontSize: '13px', opacity: 0.85, marginTop: '4px' }}>Tinh / Thanh pho</p>
            </div>
          </div>
        </div>

        {/* Ad inquiry */}
        <div style={{
          background: '#fff8f0',
          borderTop: '1px solid #ffe0b2',
          padding: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <p style={{ fontSize: '16px', fontWeight: 700, color: '#b45309', marginBottom: '4px' }}>
              Quang cao & Hop tac
            </p>
            <p style={{ fontSize: '13px', color: '#78350f' }}>
              Tiep can 50.000+ ung vien — Dang tin mien phi
            </p>
          </div>
          <a
            href="mailto:ads@viecganbạn.vn"
            style={{
              display: 'inline-block',
              padding: '10px 22px',
              background: '#f59e0b',
              color: '#fff',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 700,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(245,158,11,0.35)'
            }}
          >
            Lien he ngay
          </a>
        </div>
      </section>

      <ApplyModal status={status} job={applyJob} profile={profile} onConfirm={confirm} onClose={close} onRetry={retry} />
    </div>
  )
}
