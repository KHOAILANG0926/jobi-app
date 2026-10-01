import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import ApplyModal from '../components/ApplyModal'
import HomeMapExplorer from '../components/home/HomeMapExplorer'
import FeaturedJobsSection from '../components/FeaturedJobsSection'
import JobCard from '../components/JobCard'
import { useApply } from '../components/useApply'
import { useAuth } from '../context/AuthContext'
import { useJobs } from '../context/JobsContext'
import { REGION_MACRO_TABS, type JobRegionId } from '../data/jobRegions'
import { loadApplications } from '../lib/applicationsStorage'
import { computePreferredCategories, filterAndSortJobs } from '../lib/jobSearch'
import { loadSavedJobIds, toggleSavedJobId } from '../lib/storage'
import type { Job, JobCategory } from '../types/job'

/* ── Static data ─────────────────────────────────────────────────── */




/* ── Ad slot (replace <div className="ad-slot__ph"> with real ad code) */

const AD_CONFIGS = {
  header: {
    bg: 'linear-gradient(135deg,#1c1c1e 0%,#3a3a3c 100%)',
    icon: '📱',
    eyebrow: 'Samsung Galaxy Z Flip8',
    headline: 'Mỏng nhẹ nhất từ trước đến nay',
    sub: 'Galaxy AI · FlexWindow tùy chỉnh',
    cta: 'Khám phá ngay →',
    href: 'https://www.samsung.com/us/smartphones/galaxy-z-flip8/',
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
  card1: {
    bg: '#fff',
    icon: '☕',
    eyebrow: 'Highlands Coffee',
    headline: 'Cùng Highlands Coffee tìm kiếm nhân tài.',
    cta: '',
    light: false,
    img: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=300&h=180&fit=crop',
  },
  card2: {
    bg: '#fff',
    icon: '🏪',
    eyebrow: 'WinMart / WinMart+',
    headline: 'Tuyển dụng nhân viên bán hàng toàn quốc.',
    cta: '',
    light: false,
    img: 'https://images.unsplash.com/photo-1534723452862-4c874018d66d?w=300&h=180&fit=crop',
  },
}

interface AdSlotProps {
  slotId: keyof typeof AD_CONFIGS
}

function AdSlot({ slotId }: AdSlotProps) {
  const cfg = AD_CONFIGS[slotId]
  if (slotId === 'header') {
    const c = AD_CONFIGS.header
    return (
      <div className="ad-slot ad-slot--samsung" data-ad-slot={slotId}>
        <span className="ad-slot__label" style={{ background: 'rgba(26,26,46,0.12)', color: '#1a1a2e' }}>QC</span>
        <div className="ad-slot__samsung-content">
          <div className="ad-slot__samsung-copy">
            <p className="ad-slot__samsung-eyebrow">{c.eyebrow}</p>
            <p className="ad-slot__samsung-headline">{c.headline}</p>
            <a href={c.href} target="_blank" rel="noopener noreferrer" className="ad-slot__samsung-cta">{c.cta}</a>
          </div>
          <div className="ad-slot__samsung-visual" aria-hidden="true">
            <svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="samsungPhoneBody" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#3f3f56" />
                  <stop offset="100%" stopColor="#1a1a2e" />
                </linearGradient>
                <radialGradient id="samsungScreenGlow" cx="50%" cy="35%" r="70%">
                  <stop offset="0%" stopColor="#a9d6ff" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#a9d6ff" stopOpacity="0" />
                </radialGradient>
              </defs>
              <rect x="18" y="4" width="84" height="40" rx="11" fill="url(#samsungPhoneBody)" />
              <rect x="25" y="10" width="70" height="28" rx="7" fill="url(#samsungScreenGlow)" />
              <rect x="18" y="47" width="84" height="7" rx="3.5" fill="#0f0f1a" />
              <rect x="18" y="57" width="84" height="40" rx="11" fill="url(#samsungPhoneBody)" />
              <circle cx="60" cy="77" r="3.2" fill="#ffd9ec" opacity="0.9" />
            </svg>
          </div>
        </div>
      </div>
    )
  }
  if (slotId === 'card1' || slotId === 'card2') {
    const c = cfg as typeof cfg & { eyebrow?: string; sub?: string; img?: string }
    return (
      <div className="ad-card" data-ad-slot={slotId}>
        <div className="ad-card__body">
          <p className="ad-card__eyebrow">{c.eyebrow ?? ''}</p>
          <p className="ad-card__headline">{c.headline ?? ''}</p>
        </div>
        {c.img && <img className="ad-card__img" src={c.img} alt={c.eyebrow ?? ''} />}
        <span className="ad-slot__label" style={{ color: 'rgba(0,0,0,0.3)' }}>QC</span>
      </div>
    )
  }
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
  const link = 'href' in cfg && cfg.href ? cfg.href : '/dang-tin'
  const isExternal = /^https?:\/\//.test(link)
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
        <a href={link} className="ad-slot__cta-btn" {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
          {cfg.cta}
        </a>
      </div>
    </div>
  )
}

/* ── Main component ──────────────────────────────────────────────── */

export function Home() {
  const { jobs, jobsError } = useJobs()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { status, job: applyJob, profile, openApply, confirm, close, retry } = useApply()

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<JobCategory | 'all'>('all')
  const [subcategory, setSubcategory] = useState('')
  const [urgentOnly, setUrgentOnly] = useState(false)
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set(loadSavedJobIds(user?.id)))
  const [selectedCity, setSelectedCity] = useState<JobRegionId | null>(null)
  const [brandFilter, setBrandFilter] = useState<string | null>(null)

  const [activeRec] = useState<string | null>(null)

  useEffect(() => {
    const p = new URLSearchParams(location.search)
    const q = p.get('q')
    const brand = p.get('brand')
    const cat = p.get('cat')
    const region = p.get('region')
    const urgent = p.get('urgent')
    // 2026-09-20 사용자 지시("헤더 메가메뉴 탐색축 세분화") — 헤더에서
    // "Lương cao"로 바로 진입할 수 있도록, 이미 화면 안에 있던 퀵필터 칩
    // (handleQuickSalary 등)과 동일한 sortMode를 URL로도 설정할 수 있게 한다.
    const sort = p.get('sort')

    setSearch(q ?? '')
    setBrandFilter(brand ?? null)
    setCategory((cat as JobCategory) ?? 'all')
    setSubcategory('')
    setSelectedCity((region as JobRegionId) ?? null)
    setUrgentOnly(urgent === '1')
    if (sort === 'salary' || sort === 'recommended') setSortMode(sort)
  }, [location.search])
  // 2026-10-01: 'Làm hôm nay' 빠른 필터 버튼은 메인 지도 개편으로 빠졌다(필터 로직은 유지).
  const todayOnly = false
  const [sortMode, setSortMode] = useState<'none' | 'salary' | 'recommended'>('none')

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

  const handleToggleSave = useCallback((job: Job) => { toggleSavedJobId(job.id, user?.id) }, [user?.id])

  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (!user?.id) { setAppliedIds(new Set()); return }
    let cancelled = false
    const syncApplications = () => {
      loadApplications().then((apps) => {
        if (cancelled) return
        setAppliedIds(new Set(apps.filter((a) => a.seekerId === user.id).map((a) => a.jobId)))
      })
    }
    syncApplications()
    window.addEventListener('vgb:applications', syncApplications)
    return () => {
      cancelled = true
      window.removeEventListener('vgb:applications', syncApplications)
    }
  }, [user?.id])



  // "Gợi ý cho bạn" — no popularity/click-count field, so: logged-in users get jobs
  // matching the categories they've saved/applied to ranked first; everyone else
  // (and logged-in users with no history yet) falls back to hireCount desc as a
  // "nhiều vị trí đang cần tuyển" popularity proxy.
  const preferredCategories = useMemo(
    () => computePreferredCategories(jobs, savedIds, appliedIds),
    [jobs, savedIds, appliedIds],
  )

  const filtered = useMemo(
    () => filterAndSortJobs(jobs, { search, category, subcategory, urgentOnly, todayOnly, selectedCity, brandFilter, sortMode }, preferredCategories),
    [jobs, search, brandFilter, category, subcategory, urgentOnly, todayOnly, selectedCity, sortMode, preferredCategories],
  )


  const urgentJobs  = useMemo(() => filtered.filter((j) => j.urgent), [filtered])
  const regularJobs = useMemo(() => filtered.filter((j) => !j.urgent), [filtered])

  const handleApply = useCallback((job: Job) => {
    if (!user) { navigate('/dang-nhap'); return }
    openApply(job)
  }, [user, navigate, openApply])

  // Ref for scrolling to city results
  const cityResultRef = useRef<HTMLElement>(null)
  // Ref for scrolling to the main job list (quick-filter chips)
  const jobResultRef = useRef<HTMLElement>(null)
  // 2026-09-20 사용자 지시("Tìm việc theo khu vực thay vào đó" 눌러도
  // 변화가 없어 보인다고 실사이트 스크린샷으로 지적) — 원인은 scrollIntoView
  // 자체가 아니라, `.layout__header`가 `position: sticky`인데 target의
  // block:'start' 스크롤이 헤더 높이를 고려 안 해서, 목적지 섹션의 맨 위
  // (제목·실제 클릭할 내용)가 고정 헤더 뒤로 가려지는 것이었다(모바일은
  // 헤더가 3줄이라 ~200px로 더 심함). 헤더 높이를 매번 실측해서 그만큼
  // 여유를 두고 window.scrollTo로 직접 이동한다 — CSS scroll-margin-top
  // 고정값은 모바일/데스크톱 헤더 높이가 달라 하나로 못 맞춘다.
  const scrollToRefBelowHeader = (el: HTMLElement | null, behavior: ScrollBehavior) => {
    if (!el) return
    const headerEl = document.querySelector('.layout__header')
    const headerHeight = headerEl instanceof HTMLElement ? headerEl.getBoundingClientRect().height : 0
    const top = el.getBoundingClientRect().top + window.scrollY - headerHeight - 12
    window.scrollTo({ top, behavior })
  }

  // Scroll to results when a city is selected
  useEffect(() => {
    if (selectedCity && cityResultRef.current) {
      scrollToRefBelowHeader(cityResultRef.current, 'smooth')
    }
  }, [selectedCity])

  // Scroll to the job list instantly when a quick-filter chip is tapped
  useEffect(() => {
    if (activeRec && !selectedCity && jobResultRef.current) {
      scrollToRefBelowHeader(jobResultRef.current, 'smooth')
    }
  }, [activeRec, selectedCity])

  const isApplied = useCallback((id: string) => appliedIds.has(id), [appliedIds])

  return (
    <div className="home-page">

      {jobsError && (
        <div className="home-jobs-error" role="alert" style={{ background: '#fdecea', color: '#b71c1c', padding: '12px 16px', textAlign: 'center', fontSize: 14 }}>
          Không thể tải danh sách tin tuyển dụng lúc này. Vui lòng thử lại sau.
        </div>
      )}

      {/* ── White top section ─────────────────────────────── */}
      <div className="home-top-bg">

      {/* ── Brand hero: Korea bridge + local job search ─────────── */}
      <section className="home-brand-hero">
        <div className="home-brand-hero__content">
          <h1 className="home-brand-hero__title">
            Kết nối người Việt<br />
            <span>với việc làm tại Hàn Quốc</span>
          </h1>
          <p className="home-brand-hero__lead">
            Hàng nghìn cơ hội việc làm tốt đang chờ bạn
          </p>
          <NavLink to="/viec-han-quoc" className="home-hero-search home-hero-cta">
            <span className="home-hero-cta__icon" aria-hidden>🇰🇷</span>
            <span className="home-hero-cta__text">Việc làm tại Hàn Quốc</span>
            <span className="home-hero-cta__arrow" aria-hidden>→</span>
          </NavLink>
          <div className="home-brand-hero__links">
            <span>{filtered.length} việc làm đang mở</span>
            <NavLink to="/viec-han-quoc">Khám phá việc làm Hàn Quốc →</NavLink>
          </div>
        </div>
      </section>

      {/* ── 내 주변 일자리 지도 탐색 (2026-10-01: 광고·브랜드·지역·빠른필터·업종 select 블록을 대체) ── */}
      <HomeMapExplorer />

      </div>{/* /.home-top-bg */}

      <FeaturedJobsSection
        jobs={jobs}
        isApplied={isApplied}
        onApply={handleApply}
        isSaved={(id) => savedIds.has(id)}
        onToggleSave={handleToggleSave}
      />

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
                      <NavLink key={job.id} className="home-card-wrap" to={`/viec-lam/${job.id}`}>
                        <JobCard job={job} isApplied={isApplied(job.id)} onApply={handleApply} isSaved={savedIds.has(job.id)} onToggleSave={handleToggleSave} />
                      </NavLink>
                    ))}
                  </div>
                )}
                {urgentJobs.length > 0 && regularJobs.length > 0 && (
                  <AdSlot slotId="inline" />
                )}
                {regularJobs.length > 0 && (
                  <div className="home-jobs-grid">
                    {regularJobs.map(job => (
                      <NavLink key={job.id} className="home-card-wrap" to={`/viec-lam/${job.id}`}>
                        <JobCard job={job} isApplied={isApplied(job.id)} onApply={handleApply} isSaved={savedIds.has(job.id)} onToggleSave={handleToggleSave} />
                      </NavLink>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        )
      })()}

      {/* ── Job listings: 전체 결과 (기존 방식 그대로) ─────────────── */}
      {!selectedCity && (
        <section className="home-section" ref={jobResultRef}>
          <h2 className="home-section__title">Tất cả kết quả</h2>
          {filtered.length === 0 ? (
            // 필터(ngành/thương hiệu/khu vực/...) 결과가 0건일 때 아무것도
            // 렌더링되지 않던 결함 수정 — 안내 문구 없이 섹션 전체가 사라져서
            // "로딩이 안 되나?" 오인을 유발했다(실측 확인: ?cat=cafe, ?brand=...).
            <div className="city-result__empty">
              <span>🔍</span>
              <p>Không tìm thấy việc làm phù hợp với bộ lọc hiện tại.</p>
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
        </section>
      )}

      <ApplyModal status={status} job={applyJob} profile={profile} onConfirm={confirm} onClose={close} onRetry={retry} />
    </div>
  )
}
