import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import ApplyModal from '../components/ApplyModal'
import JobCard from '../components/JobCard'
import { useApply } from '../components/useApply'
import { useAuth } from '../context/AuthContext'
import { useJobs } from '../context/JobsContext'
import { jobMatchesRegion, REGION_MACRO_TABS, type JobRegionId } from '../data/jobRegions'
import { hasAppliedToJob } from '../lib/applicationsStorage'
import { calcDistanceKm, guessCoordinatesFromLocation, normalizeViText } from '../lib/jobCoords'
import { loadSavedJobIds, toggleSavedJobId } from '../lib/storage'
import type { Job, JobCategory } from '../types/job'

/* ── Static data ─────────────────────────────────────────────────── */

const FEATURED_BRANDS = [
  { name: 'GrabFood',         search: 'Grab',      initial: 'G', color: '#00b14f', logo: 'https://www.google.com/s2/favicons?sz=64&domain=grab.com' },
  { name: 'Highlands',        search: 'Highlands', initial: 'H', color: '#006241', logo: 'https://www.google.com/s2/favicons?sz=64&domain=highlandscoffee.com.vn' },
  { name: 'Shopee',           search: 'Shopee',    initial: 'S', color: '#ff5722', logo: 'https://www.google.com/s2/favicons?sz=64&domain=shopee.vn' },
  { name: 'Samsung',          search: 'Samsung',   initial: 'S', color: '#1428a0', logo: 'https://www.google.com/s2/favicons?sz=64&domain=samsung.com' },
  { name: "McDonald's",       search: 'McDonald',  initial: 'M', color: '#FFC72C', logo: 'https://www.google.com/s2/favicons?sz=64&domain=mcdonalds.com' },
  { name: 'KFC',              search: 'KFC',       initial: 'K', color: '#e4003b', logo: 'https://www.google.com/s2/favicons?sz=64&domain=kfc.com' },
  { name: 'Lotteria',         search: 'Lotteria',  initial: 'L', color: '#e60028', logo: 'https://www.google.com/s2/favicons?sz=64&domain=lotteria.com' },
  { name: 'Circle K',         search: 'Circle',    initial: 'C', color: '#c8102e', logo: 'https://www.google.com/s2/favicons?sz=64&domain=circlek.com' },
  { name: 'FamilyMart',       search: 'Family',    initial: 'F', color: '#00539f', logo: 'https://www.google.com/s2/favicons?sz=64&domain=familymart.com' },
  { name: 'WinMart',          search: 'WinMart',   initial: 'W', color: '#e30613', logo: 'https://www.google.com/s2/favicons?sz=64&domain=winmart.vn' },
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
          <a href="/dang-tin" className="ad-slot__inline-cta" style={{ color: cfg.light ? '#fff' : '#7c2d12' }}>
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
        <a href="/dang-tin" className="ad-slot__cta-btn">
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
  const location = useLocation()
  const { status, job: applyJob, profile, openApply, confirm, close, retry } = useApply()

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<JobCategory | 'all'>('all')
  const [urgentOnly, setUrgentOnly] = useState(false)
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set(loadSavedJobIds()))
  const [selectedCity, setSelectedCity] = useState<JobRegionId | null>(null)
  const [brandFilter, setBrandFilter] = useState<string | null>(null)

  const [nearMe, setNearMe] = useState(false)

  useEffect(() => {
    const p = new URLSearchParams(location.search)
    const q = p.get('q')
    const brand = p.get('brand')
    const cat = p.get('cat')
    const region = p.get('region')
    const urgent = p.get('urgent')
    const near = p.get('near')

    setSearch(q ?? '')
    setBrandFilter(brand ?? null)
    setCategory((cat as JobCategory) ?? 'all')
    setSelectedCity((region as JobRegionId) ?? null)
    setUrgentOnly(urgent === '1')
    setNearMe(near === '1')
  }, [location.search])
  const [nearRadius] = useState(5)
  const [userCoords] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    const sync = () => setSavedIds(new Set(loadSavedJobIds()))
    window.addEventListener('vgb:saved-jobs', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('vgb:saved-jobs', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const handleToggleSave = useCallback((job: Job) => { toggleSavedJobId(job.id) }, [])



  const jobDistances = useMemo<Record<string, number>>(() => {
    if (!nearMe || !userCoords) return {}
    const r: Record<string, number> = {}
    for (const job of jobs) {
      const c = guessCoordinatesFromLocation(job.location)
      r[job.id] = calcDistanceKm(userCoords.lat, userCoords.lng, c.lat, c.lng)
    }
    return r
  }, [jobs, nearMe, userCoords])



  const filtered = useMemo(() => {
    const q = normalizeViText(search)
    let result = jobs.filter((j) => {
      if (category !== 'all' && j.category !== category) return false
      if (urgentOnly && !j.urgent) return false
      if (selectedCity && !jobMatchesRegion(j.location, selectedCity)) return false
      if (brandFilter && !normalizeViText(j.company).includes(normalizeViText(brandFilter))) return false
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
  }, [jobs, search, brandFilter, category, urgentOnly, selectedCity, nearMe, userCoords, nearRadius, jobDistances])

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


  const handleBrandClick = (brandSearch: string) => {
    setBrandFilter(brandSearch); setSearch(''); setCategory('all'); setNearMe(false); setSelectedCity(null)
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

      {/* ── Hero: Ad + Login prompt (Albamon style) ─────────── */}
      <section className="hero-row" style={{ height: '120px' }}>
        <div className="hero-row__ad">
          <AdSlot slotId="header" />
        </div>
        {!user && (
          <div className="hero-row__login">
              <div className="hero-row__login-text">
              <p className="hero-row__cta">Bạn muốn biết thêm nhiều thông tin việc làm?</p>
              <p className="hero-row__cta2">Hãy <NavLink to="/dang-nhap" className="hero-row__login-btn">đăng nhập</NavLink> ngay!</p>
            </div>
            <img src="/char-upper.png" className="hero-row__mascot" aria-hidden alt="" />
          </div>
        )}
      </section>


      {/* ── Brands + Region ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '6fr 4fr', gap: '1rem', marginBottom: '1.25rem', alignItems: 'start' }}>
        <section className="home-brands-section">
          <div className="home-brands-box">
            <div className="home-brands-box__head">
              <h2 className="home-brands-box__title">Thương hiệu tuyển dụng</h2>
              <span className="home-brands-box__sub">Nhấn để xem việc làm</span>
            </div>
            <div className="home-brands-box__row">
              <div className="home-brands-box__track">
                {[...FEATURED_BRANDS, ...FEATURED_BRANDS].map((b, i) => (
                  <button key={`${b.name}-${i}`} className="home-brand" onClick={() => handleBrandClick(b.search)} title={b.name}>
                    <BrandLogo name={b.name} initial={b.initial} color={b.color} logo={b.logo} />
                    <span className="home-brand__name">{b.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Region panel (right) ── */}
        <div className="home-region-panel">
          <h2 className="home-region-panel__title">Việc làm theo khu vực</h2>
          <div className="home-region-panel__grid">
            {[
              { id: 'hanoi', label: 'Hà Nội' },
              { id: 'haiphong', label: 'Hải Phòng' },
              { id: 'bacninh', label: 'Bắc Ninh' },
              { id: 'bacgiang', label: 'Bắc Giang' },
              { id: 'thainguyen', label: 'Thái Nguyên' },
              { id: 'danang', label: 'Đà Nẵng' },
              { id: 'hue', label: 'Huế' },
              { id: 'khanhhoa', label: 'Khánh Hòa' },
              { id: 'hcm', label: 'TP. HCM' },
              { id: 'dongnai', label: 'Đồng Nai' },
              { id: 'cantho', label: 'Cần Thơ' },
            ].map(p => (
              <button key={p.id} className={`home-region-panel__btn${selectedCity === p.id ? ' home-region-panel__btn--active' : ''}`}
                onClick={() => { setSelectedCity(p.id as any); setSearch(''); setBrandFilter(null); setCategory('all'); setUrgentOnly(false); setNearMe(false); }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── City filtered results ──────────────────────────────── */}
      {selectedCity && (() => {
        const cityLabel = REGION_MACRO_TABS.flatMap(t => t.provinces).find(p => p.id === selectedCity)?.label ?? ''
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

      {/* ── Job listings ─────────────────────────────────────── */}
      {!selectedCity && (
        <>
          <section className="home-jobs-section">
            <div className="home-jobs-section__head">
              <h2 className="home-jobs-section__title">Việc làm mới nhất</h2>
              <NavLink to="/" className="home-jobs-section__more">Xem tất cả →</NavLink>
            </div>
          </section>

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


      <ApplyModal status={status} job={applyJob} profile={profile} onConfirm={confirm} onClose={close} onRetry={retry} />
    </div>
  )
}
