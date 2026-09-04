import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import ApplyModal from '../components/ApplyModal'
import JobCard from '../components/JobCard'
import { useApply } from '../components/useApply'
import { useAuth } from '../context/AuthContext'
import { useJobs } from '../context/JobsContext'
import { jobMatchesRegion, REGION_MACRO_TABS, type JobRegionId } from '../data/jobRegions'
import { loadApplications } from '../lib/applicationsStorage'
import { hasStoredCv } from '../lib/cvStorage'
import { calcDistanceKm, guessCoordinatesFromLocation, normalizeViText } from '../lib/jobCoords'
import { loadSeekerInterviews } from '../lib/interviewStorage'
import { loadThreads } from '../lib/messagesStorage'
import { parseSalaryToHourly } from '../lib/recommendStorage'
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

const HOME_REGION_LIST: { id: JobRegionId; label: string }[] = [
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
]


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
  const [deadlineFilter] = useState<'all' | 'today' | 'week'>('all')
  const [activeRec] = useState<string | null>(null)
  // include: title+company에서 하나라도 매칭 (OR)
  // exclude: title에서 하나라도 매칭되면 제외
  // cats: job.category가 목록에 있으면 include 없이 통과
  const [recFilter] = useState<{ include: string[]; exclude: string[]; cats: string[] } | null>(null)

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
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [geoErrorMsg, setGeoErrorMsg] = useState<string | null>(null)
  const [todayOnly, setTodayOnly] = useState(false)
  const [sortMode, setSortMode] = useState<'none' | 'salary' | 'recommended'>('none')

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

  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set())
  const [activityCounts, setActivityCounts] = useState({ cv: 0, applications: 0, messages: 0, interviews: 0 })
  useEffect(() => {
    if (!user?.id) {
      setAppliedIds(new Set())
      setActivityCounts({ cv: 0, applications: 0, messages: 0, interviews: 0 })
      return
    }
    let cancelled = false
    const syncApplications = () => {
      loadApplications().then((apps) => {
        if (cancelled) return
        const mine = apps.filter((a) => a.seekerId === user.id)
        setAppliedIds(new Set(mine.map((a) => a.jobId)))
        setActivityCounts((prev) => ({ ...prev, cv: hasStoredCv() ? 1 : 0, applications: mine.length }))
      })
    }
    const syncMessages = () => {
      loadThreads().then((threads) => {
        if (cancelled) return
        setActivityCounts((prev) => ({ ...prev, messages: threads.length }))
      })
    }
    const syncInterviews = () => {
      loadSeekerInterviews(user.id).then((list) => {
        if (cancelled) return
        setActivityCounts((prev) => ({ ...prev, interviews: list.length }))
      })
    }
    syncApplications()
    syncMessages()
    syncInterviews()
    window.addEventListener('vgb:applications', syncApplications)
    window.addEventListener('vgb:messages', syncMessages)
    window.addEventListener('vgb:interviews', syncInterviews)
    return () => {
      cancelled = true
      window.removeEventListener('vgb:applications', syncApplications)
      window.removeEventListener('vgb:messages', syncMessages)
      window.removeEventListener('vgb:interviews', syncInterviews)
    }
  }, [user?.id])



  const jobDistances = useMemo<Record<string, number>>(() => {
    if (!nearMe || !userCoords) return {}
    const r: Record<string, number> = {}
    for (const job of jobs) {
      const c = guessCoordinatesFromLocation(job.location)
      r[job.id] = calcDistanceKm(userCoords.lat, userCoords.lng, c.lat, c.lng)
    }
    return r
  }, [jobs, nearMe, userCoords])



  // "Làm hôm nay" — no dedicated DB field for immediate-start/day-work postings,
  // so approximate via Vietnamese phrasing commonly used for these listings.
  const TODAY_KEYWORDS = ['lam ngay', 'di lam ngay', 'nhan viec ngay', 'viec lam ngay', 'ngay hom nay', 'nhan lam ngay']
  const isTodayJob = useCallback((j: Job) => {
    const text = normalizeViText(`${j.title} ${j.description ?? ''} ${j.hours ?? ''} ${j.workPeriod ?? ''}`)
    return TODAY_KEYWORDS.some((kw) => text.includes(kw))
  }, [])

  // "Gợi ý cho bạn" — no popularity/click-count field, so: logged-in users get jobs
  // matching the categories they've saved/applied to ranked first; everyone else
  // (and logged-in users with no history yet) falls back to hireCount desc as a
  // "nhiều vị trí đang cần tuyển" popularity proxy.
  const preferredCategories = useMemo(() => {
    const cats = new Map<JobCategory, number>()
    for (const j of jobs) {
      if (savedIds.has(j.id) || appliedIds.has(j.id)) {
        cats.set(j.category, (cats.get(j.category) ?? 0) + 1)
      }
    }
    return cats
  }, [jobs, savedIds, appliedIds])

  const filtered = useMemo(() => {
    const q = normalizeViText(search)
    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)
    const weekLater = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10)
    let result = jobs.filter((j) => {
      if (category !== 'all') {
        // cafe와 restaurant는 같은 F&B 그룹으로 통합 필터링
        const FNB = ['cafe', 'restaurant']
        const allowed = FNB.includes(category) ? FNB : [category]
        if (!allowed.includes(j.category)) return false
      }
      if (urgentOnly && !j.urgent) return false
      if (todayOnly && !isTodayJob(j)) return false
      if (selectedCity && !jobMatchesRegion(j.location, selectedCity, j.workLocations)) return false
      if (brandFilter) {
        const nb = normalizeViText(brandFilter)
        // 프랜차이즈 매장은 회사명이 운영사(예: Wincommerce)로 등록되고
        // 브랜드명은 공고 제목에만 나오는 경우가 많아 title도 함께 검사
        const matches = normalizeViText(j.company).includes(nb) || normalizeViText(j.title).includes(nb)
        if (!matches) return false
      }
      if (q && !normalizeViText(`${j.title} ${j.company} ${j.location}`).includes(q)) return false
      if (recFilter) {
        const titleCo = normalizeViText(`${j.title} ${j.company}`)
        // category 목록에 있으면 자동 통과, 아니면 include 키워드 확인
        const catPass = recFilter.cats.includes(j.category)
        const includePass = catPass || recFilter.include.some(kw => titleCo.includes(kw))
        if (!includePass) return false
        // exclude 키워드가 title에 있으면 제외
        if (recFilter.exclude.some(kw => titleCo.includes(kw))) return false
      }
      if (nearMe && userCoords) {
        const d = jobDistances[j.id]
        if (d === undefined || d > nearRadius) return false
      }
      if (deadlineFilter !== 'all' && j.applicationDeadline) {
        if (deadlineFilter === 'today' && j.applicationDeadline > todayStr) return false
        if (deadlineFilter === 'week' && j.applicationDeadline > weekLater) return false
      }
      return true
    })
    if (nearMe && userCoords) {
      result = [...result].sort((a, b) => (jobDistances[a.id] ?? 99) - (jobDistances[b.id] ?? 99))
    } else if (sortMode === 'salary') {
      result = [...result].sort((a, b) => parseSalaryToHourly(b.salary) - parseSalaryToHourly(a.salary))
    } else if (sortMode === 'recommended') {
      result = [...result].sort((a, b) => {
        const aMatch = preferredCategories.has(a.category) ? 1 : 0
        const bMatch = preferredCategories.has(b.category) ? 1 : 0
        if (aMatch !== bMatch) return bMatch - aMatch
        return (b.hireCount ?? 0) - (a.hireCount ?? 0)
      })
    }
    return result
  }, [jobs, search, brandFilter, category, urgentOnly, todayOnly, isTodayJob, selectedCity, nearMe, userCoords, nearRadius, jobDistances, deadlineFilter, recFilter, sortMode, preferredCategories])

  const urgentJobs  = useMemo(() => filtered.filter((j) => j.urgent), [filtered])
  const regularJobs = useMemo(() => filtered.filter((j) => !j.urgent), [filtered])

  // 지역별 실제 활성 공고 수 기준 TOP3 자동 선정 (나머지는 원래 순서로 숨기지 않고 표시)
  const rankedRegions = useMemo(() => {
    const withCounts = HOME_REGION_LIST.map((r) => ({
      ...r,
      count: jobs.reduce((n, j) => n + (jobMatchesRegion(j.location, r.id, j.workLocations) ? 1 : 0), 0),
    }))
    const top3 = [...withCounts].sort((a, b) => b.count - a.count).slice(0, 3)
    const top3Ids = new Set(top3.map((r) => r.id))
    const rest = HOME_REGION_LIST.filter((r) => !top3Ids.has(r.id))
    return { top3, rest }
  }, [jobs])

  const handleRegionClick = useCallback((id: JobRegionId | null) => {
    setSelectedCity(id)
    setSearch('')
    setBrandFilter(null)
    setCategory('all')
    setUrgentOnly(false)
    setNearMe(false)
  }, [])

  const handleApply = useCallback((job: Job) => {
    if (!user) { navigate('/dang-nhap'); return }
    openApply(job)
  }, [user, navigate, openApply])

  // Ref for scrolling to city results
  const cityResultRef = useRef<HTMLElement>(null)
  // Ref for scrolling to the main job list (quick-filter chips)
  const jobResultRef = useRef<HTMLElement>(null)
  // Ref for the hero search's category <select>, focused by the "Theo ngành nghề" quick filter
  const categorySelectRef = useRef<HTMLSelectElement>(null)

  // Scroll to results when a city is selected
  useEffect(() => {
    if (selectedCity && cityResultRef.current) {
      cityResultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [selectedCity])

  // Scroll to the job list instantly when a quick-filter chip is tapped
  useEffect(() => {
    if (activeRec && !selectedCity && jobResultRef.current) {
      jobResultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [activeRec, selectedCity])

  const handleBrandClick = (brandSearch: string) => {
    setBrandFilter(brandSearch); setSearch(''); setCategory('all'); setNearMe(false); setSelectedCity(null)
  }

  // Quick-filter category row: each button gives an isolated single-purpose view,
  // so clicking one clears the other quick-filter states first.
  const clearQuickFilters = () => {
    setUrgentOnly(false); setNearMe(false); setTodayOnly(false); setSortMode('none'); setSelectedCity(null)
  }
  const scrollToResults = () => {
    window.requestAnimationFrame(() => {
      jobResultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }
  const handleQuickUrgent = () => { clearQuickFilters(); setUrgentOnly(true); scrollToResults() }
  const handleQuickNearMe = () => {
    if (!navigator.geolocation) { setGeoErrorMsg('Trình duyệt không hỗ trợ định vị.'); return }
    setGeoErrorMsg(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearQuickFilters()
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setNearMe(true)
        scrollToResults()
      },
      () => setGeoErrorMsg('Không thể lấy vị trí. Hãy cho phép định vị để xem việc gần bạn.'),
      { timeout: 10_000 },
    )
  }
  const handleQuickToday = () => { clearQuickFilters(); setTodayOnly(true); scrollToResults() }
  const handleQuickRecommended = () => { clearQuickFilters(); setSortMode('recommended'); scrollToResults() }
  const handleQuickSalary = () => { clearQuickFilters(); setSortMode('salary'); scrollToResults() }
  const handleQuickCategory = () => {
    window.requestAnimationFrame(() => {
      categorySelectRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      categorySelectRef.current?.focus()
    })
  }

  const isApplied = useCallback((id: string) => appliedIds.has(id), [appliedIds])

  return (
    <div className="home-page">

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

      {/* ── Curated opportunities: same card rhythm ───────────── */}
      <section className="home-discovery">
        <div className="home-discovery__grid">
          <div className="home-discovery__card home-discovery__card--skill">
            <AdSlot slotId="header" />
          </div>
          <div className="home-discovery__card home-discovery__card--account">
            <div className="home-discovery-account__copy">
              {user ? (
                <>
                  <strong>Tình hình việc làm của tôi</strong>
                  <p>{`CV ${activityCounts.cv} · Ứng tuyển ${activityCounts.applications} · Tin nhắn ${activityCounts.messages} · Phỏng vấn ${activityCounts.interviews}`}</p>
                  <div className="home-discovery-account__actions">
                    <NavLink to="/ho-so" className="home-discovery-account__button">Xem hoạt động của tôi →</NavLink>
                  </div>
                </>
              ) : (
                <>
                  <strong>Chuẩn bị xin việc, quản lý ngay tại đây</strong>
                  <p>Tạo CV để theo dõi từ ứng tuyển đến phỏng vấn — tất cả ở một nơi.</p>
                  <div className="home-discovery-account__actions">
                    <NavLink to="/ho-so" state={{ openCvTab: true }} className="home-discovery-account__button">Tạo CV</NavLink>
                    <NavLink to="/ho-so" state={{ openApplicationsTab: true }} className="home-discovery-account__link">Xem tình trạng ứng tuyển →</NavLink>
                  </div>
                </>
              )}
            </div>
            <img src="/images/mascot-turtle-mint.webp" className="home-discovery-account__mascot" aria-hidden alt="" />
          </div>
        </div>
      </section>

      {/* ── Brands + Region: 독립된 60:40 compact 섹션 (브랜드/지역만) ── */}
      <div className="home-brands-region-grid">

        {/* LEFT 60%: 브랜드 로고 + 그 아래 붙인 광고 배너 2개 */}
        <div className="home-brands-left">
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

          {/* ── 기업 프로모션 카드: 브랜드 로고 목록 바로 아래 ── */}
          <div className="home-ad-cards">
            <AdSlot slotId="card1" />
            <AdSlot slotId="card2" />
          </div>
        </div>

        {/* RIGHT 40%: 지역 제목 + compact 지역 목록만 */}
        <div className="home-region-panel">
          <div className="home-region-panel__head">
            <h2 className="home-region-panel__title">Việc làm theo khu vực</h2>
            <button type="button" className="home-region-panel__all" onClick={() => handleRegionClick(null)}>Tất cả ›</button>
          </div>

          <div className="home-region-panel__top3">
            {rankedRegions.top3.map((p, i) => (
              <span key={p.id}>
                {i > 0 && <span className="home-region-panel__top3-sep"> · </span>}
                <button
                  type="button"
                  className={`home-region-panel__top3-btn${selectedCity === p.id ? ' is-active' : ''}`}
                  onClick={() => handleRegionClick(p.id)}
                >
                  {p.label}
                </button>
              </span>
            ))}
          </div>

          <div className="home-region-panel__rest">
            {rankedRegions.rest.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`home-region-panel__rest-btn${selectedCity === p.id ? ' is-active' : ''}`}
                onClick={() => handleRegionClick(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* ── 빠른 필터 카테고리 (알바몬 스타일 원형 아이콘 + 텍스트, 3열) ── */}
          <div className="home-quick-filters">
            <div className="home-quick-filters__list">
              <button type="button" className={`home-quick-filter${urgentOnly ? ' is-active' : ''}`} onClick={handleQuickUrgent}>
                <span className="home-quick-filter__icon" aria-hidden>⚡</span>
                <span className="home-quick-filter__label">Cần gấp</span>
              </button>
              <button type="button" className={`home-quick-filter${nearMe && userCoords ? ' is-active' : ''}`} onClick={handleQuickNearMe}>
                <span className="home-quick-filter__icon" aria-hidden>📍</span>
                <span className="home-quick-filter__label">Gần bạn</span>
              </button>
              <button type="button" className={`home-quick-filter${todayOnly ? ' is-active' : ''}`} onClick={handleQuickToday}>
                <span className="home-quick-filter__icon" aria-hidden>🗓️</span>
                <span className="home-quick-filter__label">Làm hôm nay</span>
              </button>
              <button type="button" className={`home-quick-filter${sortMode === 'recommended' ? ' is-active' : ''}`} onClick={handleQuickRecommended}>
                <span className="home-quick-filter__icon" aria-hidden>✨</span>
                <span className="home-quick-filter__label">Gợi ý cho bạn</span>
              </button>
              <button type="button" className={`home-quick-filter${sortMode === 'salary' ? ' is-active' : ''}`} onClick={handleQuickSalary}>
                <span className="home-quick-filter__icon" aria-hidden>💰</span>
                <span className="home-quick-filter__label">Lương cao</span>
              </button>
              <button type="button" className="home-quick-filter" onClick={handleQuickCategory}>
                <span className="home-quick-filter__icon" aria-hidden>🗂️</span>
                <span className="home-quick-filter__label">Theo ngành nghề</span>
              </button>
            </div>
            {geoErrorMsg && <p className="home-quick-filters__error">{geoErrorMsg}</p>}
          </div>
        </div>
      </div>

      </div>{/* /.home-top-bg */}

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
                    distanceKm={jobDistances[job.id]}
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
