import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink, useNavigate, useSearchParams } from 'react-router-dom'
import ApplyModal from '../components/ApplyModal'
import JobCard from '../components/JobCard'
import { useApply } from '../components/useApply'
import { useAuth } from '../context/AuthContext'
import { useJobs } from '../context/JobsContext'
import { ALL_CATEGORIES, CATEGORY_LABELS } from '../data/categories'
import { REGION_MACRO_TABS, type JobRegionId } from '../data/jobRegions'
import { SUBCATEGORY_LABELS } from '../data/subcategories'
import { computePreferredCategories, filterAndSortJobs, type JobSearchParams } from '../lib/jobSearch'
import { buildRepresentativePageCopy, isRepresentativeCandidate, normalizeSearchQuery } from '../lib/representativeSearchPages'
import { loadApplications } from '../lib/applicationsStorage'
import { loadSavedJobIds, toggleSavedJobId } from '../lib/storage'
import type { Job, JobCategory } from '../types/job'

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const
const ALL_REGIONS = REGION_MACRO_TABS.flatMap((t) => t.provinces)

/**
 * 공개 검색 전용 페이지 — 2026-09-22 사용자 지시("일반 알바 검색 노출...
 * 기존 검색 로직을 재사용하는 공개 검색 전용 경로... 홈 전체 SSR은
 * 필수 아님"). Home.tsx의 히어로/브랜드 캐러셀/광고 슬롯 등 마케팅성
 * 섹션은 그대로 두고(그 부분까지 SSR할 필요는 없다는 지시), 실제 검색
 * 결과 목록만 [src/lib/jobSearch.ts](../lib/jobSearch.ts)의 공유 함수로
 * 뽑아내 이 페이지와 entry-server.tsx 양쪽에서 그대로 재사용한다 — Home.tsx도
 * 이미 같은 공유 함수를 쓰도록 리팩터링됐으므로, 필터 로직 자체는 두
 * 화면이 완전히 같다. URL 쿼리스트링 파라미터명은 Home.tsx가 이미 쓰던
 * ?q=/?cat=/?region=/?urgent=/?sort= 관례를 그대로 따른다(헤더 메가메뉴
 * 링크 등 기존 딥링크와 어휘를 맞추기 위함).
 */
export function JobSearchPage() {
  const { jobs } = useJobs()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { status, job: applyJob, profile, openApply, confirm, close, retry } = useApply()
  const [searchParams, setSearchParams] = useSearchParams()

  const [search, setSearch] = useState(() => searchParams.get('q') ?? '')
  const [category, setCategory] = useState<JobCategory | 'all'>(
    () => (searchParams.get('cat') as JobCategory | null) ?? 'all',
  )
  const [subcategory, setSubcategory] = useState(() => searchParams.get('sub') ?? '')
  const [selectedCity, setSelectedCity] = useState<JobRegionId | null>(
    () => (searchParams.get('region') as JobRegionId | null) ?? null,
  )
  const [brandFilter, setBrandFilter] = useState<string | null>(() => searchParams.get('brand') ?? null)
  const [urgentOnly, setUrgentOnly] = useState(() => searchParams.get('urgent') === '1')
  const [todayOnly, setTodayOnly] = useState(() => searchParams.get('today') === '1')
  const [sortMode, setSortMode] = useState<'none' | 'salary' | 'recommended'>(() => {
    const s = searchParams.get('sort')
    return s === 'salary' || s === 'recommended' ? s : 'none'
  })
  const [pageSize, setPageSize] = useState<number>(() => {
    const n = Number(searchParams.get('pageSize'))
    return PAGE_SIZE_OPTIONS.includes(n as (typeof PAGE_SIZE_OPTIONS)[number]) ? n : 20
  })
  const [page, setPage] = useState<number>(() => {
    const n = Number(searchParams.get('page'))
    return Number.isInteger(n) && n > 0 ? n : 1
  })

  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set(loadSavedJobIds(user?.id)))
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (!user?.id) { setAppliedIds(new Set()); return }
    let cancelled = false
    loadApplications().then((apps) => {
      if (cancelled) return
      setAppliedIds(new Set(apps.filter((a) => a.seekerId === user.id).map((a) => a.jobId)))
    })
    return () => { cancelled = true }
  }, [user?.id])

  // 필터가 바뀌면 페이지 번호를 1로 되돌린다(다른 조건으로 바뀐 목록에서
  // 이전 페이지 번호가 그대로 유지되면 빈 페이지를 보게 될 수 있음).
  const updateFilter = useCallback(<T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(1) }, [])

  // URL 동기화(useEffect)와 대표 페이지 H1 판정(아래) 둘 다 "지금 필터
  // 상태를 쿼리스트링으로" 필요해서 하나로 합쳤다 — api/ssr.js의
  // normalizeSearchQuery()가 sort/page/pageSize를 무시하고 cat=/region=
  // 단일 조건만 보는 것과 동일한 입력을 만들어야 서버(대표 페이지 title/
  // meta)와 클라이언트(H1)가 같은 케이스를 같은 것으로 판정한다.
  const currentSearchString = useMemo(() => {
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    if (category !== 'all') params.set('cat', category)
    if (subcategory) params.set('sub', subcategory)
    if (selectedCity) params.set('region', selectedCity)
    if (brandFilter) params.set('brand', brandFilter)
    if (urgentOnly) params.set('urgent', '1')
    if (todayOnly) params.set('today', '1')
    if (sortMode !== 'none') params.set('sort', sortMode)
    if (pageSize !== 20) params.set('pageSize', String(pageSize))
    if (page !== 1) params.set('page', String(page))
    return params.toString()
  }, [search, category, subcategory, selectedCity, brandFilter, urgentOnly, todayOnly, sortMode, pageSize, page])

  useEffect(() => {
    setSearchParams(new URLSearchParams(currentSearchString), { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSearchString])

  const handleToggleSave = useCallback((job: Job) => {
    toggleSavedJobId(job.id, user?.id)
    setSavedIds(new Set(loadSavedJobIds(user?.id)))
  }, [user?.id])
  const handleApply = useCallback((job: Job) => {
    if (!user) { navigate('/dang-nhap'); return }
    openApply(job)
  }, [user, navigate, openApply])
  const isApplied = useCallback((id: string) => appliedIds.has(id), [appliedIds])

  const preferredCategories = useMemo(() => computePreferredCategories(jobs, savedIds, appliedIds), [jobs, savedIds, appliedIds])

  const searchParamsObj: JobSearchParams = { search, category, subcategory, urgentOnly, todayOnly, selectedCity, brandFilter, sortMode }
  const filtered = useMemo(
    () => filterAndSortJobs(jobs, searchParamsObj, preferredCategories),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [jobs, search, category, subcategory, urgentOnly, todayOnly, selectedCity, brandFilter, sortMode, preferredCategories],
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const clampedPage = Math.min(page, totalPages)
  const visible = useMemo(
    () => filtered.slice((clampedPage - 1) * pageSize, clampedPage * pageSize),
    [filtered, clampedPage, pageSize],
  )

  const clearFilters = () => {
    setSearch(''); setCategory('all'); setSubcategory(''); setSelectedCity(null)
    setBrandFilter(null); setUrgentOnly(false); setTodayOnly(false); setSortMode('none'); setPage(1)
  }
  const activeFilterCount = (search ? 1 : 0) + (category !== 'all' ? 1 : 0) + (subcategory ? 1 : 0)
    + (selectedCity ? 1 : 0) + (brandFilter ? 1 : 0) + (urgentOnly ? 1 : 0) + (todayOnly ? 1 : 0) + (sortMode !== 'none' ? 1 : 0)

  // 2026-09-22 지시 — 대표 업직종/지역 페이지는 H1을 실제 필터명+실제
  // 결과 수로 개별화한다. api/ssr.js가 <title>/<meta description>에
  // 쓰는 것과 완전히 같은 buildRepresentativePageCopy()라 SSR과 hydration
  // 후 값이 어긋나지 않는다(둘 다 "지금 이 URL의 대표 조건 + filtered.length"
  // 라는 같은 입력으로 계산). 대표 후보가 아니면(기본 페이지, 비대표
  // 조합) null이라 기존 공통 문구 그대로 쓴다.
  const normalizedQuery = normalizeSearchQuery(currentSearchString)
  const representativeCopy = isRepresentativeCandidate(normalizedQuery)
    ? buildRepresentativePageCopy(normalizedQuery, filtered.length)
    : null

  return (
    <div className="page jobs-menu-page">
      <header className="page-header">
        <h1 className="page-header__title">{representativeCopy?.h1 ?? 'Tìm việc làm'}</h1>
        <p className="page-header__lead">
          Tìm kiếm và lọc toàn bộ tin tuyển dụng đang hoạt động trên Việt Gần Bạn.
        </p>
      </header>

      <div className="jm-filter-row" style={{ marginBottom: 16 }}>
        <input
          type="text"
          className="jm-filter-dropdown__search"
          placeholder="Tìm theo tên công việc, công ty, khu vực..."
          value={search}
          onChange={(e) => updateFilter(setSearch)(e.target.value)}
          style={{ maxWidth: 420 }}
        />
      </div>

      <div className="jm-urgent-filters">
        <select
          className="home-category-panel__select"
          value={category}
          onChange={(e) => { updateFilter(setCategory)(e.target.value as JobCategory | 'all'); setSubcategory('') }}
          aria-label="Ngành nghề"
        >
          <option value="all">Tất cả ngành nghề</option>
          {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
        </select>
        {category !== 'all' && SUBCATEGORY_LABELS[category] && (
          <select
            className="home-category-panel__select"
            value={subcategory}
            onChange={(e) => updateFilter(setSubcategory)(e.target.value)}
            aria-label="Phân loại chi tiết"
          >
            <option value="">Tất cả phân loại chi tiết</option>
            {Object.entries(SUBCATEGORY_LABELS[category]!).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        )}
        <select
          className="home-category-panel__select"
          value={selectedCity ?? ''}
          onChange={(e) => updateFilter(setSelectedCity)((e.target.value || null) as JobRegionId | null)}
          aria-label="Khu vực"
        >
          <option value="">Tất cả khu vực</option>
          {ALL_REGIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
        <select
          className="home-category-panel__select"
          value={sortMode}
          onChange={(e) => updateFilter(setSortMode)(e.target.value as 'none' | 'salary' | 'recommended')}
          aria-label="Sắp xếp"
        >
          <option value="none">Mới nhất</option>
          <option value="salary">Lương cao</option>
          <option value="recommended">Gợi ý cho bạn</option>
        </select>
        <label className="jm-workhour-exclude">
          <input type="checkbox" checked={urgentOnly} onChange={(e) => updateFilter(setUrgentOnly)(e.target.checked)} />
          Chỉ tuyển gấp
        </label>
        <label className="jm-workhour-exclude">
          <input type="checkbox" checked={todayOnly} onChange={(e) => updateFilter(setTodayOnly)(e.target.checked)} />
          Làm hôm nay
        </label>
      </div>

      <div className="jm-urgent-toolbar">
        <p className="jm-result-count">
          Tổng {filtered.length} việc làm
          {activeFilterCount > 0 && (
            <button type="button" className="jm-clear-filters" onClick={clearFilters}>Xóa hết bộ lọc</button>
          )}
        </p>
        <div className="jm-urgent-toolbar__controls">
          <select
            className="jm-urgent-toolbar__select"
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
            aria-label="Số lượng hiển thị"
          >
            {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n} tin/trang</option>)}
          </select>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="city-result__empty">
          <span>🔍</span>
          <p>Không tìm thấy việc làm phù hợp với bộ lọc hiện tại.</p>
          <NavLink to="/viec-lam/tim-kiem">← Xem tất cả việc làm</NavLink>
        </div>
      ) : (
        <>
          <div className="home-jobs-grid">
            {visible.map((job) => (
              <NavLink key={job.id} className="home-card-wrap" to={`/viec-lam/${job.id}`}>
                <JobCard job={job} isApplied={isApplied(job.id)} onApply={handleApply} isSaved={savedIds.has(job.id)} onToggleSave={handleToggleSave} />
              </NavLink>
            ))}
          </div>
          {totalPages > 1 && (
            <nav className="jm-urgent-toolbar" aria-label="Phân trang" style={{ justifyContent: 'center', gap: 8 }}>
              <button type="button" className="btn btn--sm btn--ghost" disabled={clampedPage <= 1} onClick={() => setPage(clampedPage - 1)}>← Trước</button>
              <span>Trang {clampedPage} / {totalPages}</span>
              <button type="button" className="btn btn--sm btn--ghost" disabled={clampedPage >= totalPages} onClick={() => setPage(clampedPage + 1)}>Sau →</button>
            </nav>
          )}
        </>
      )}

      <ApplyModal status={status} job={applyJob} profile={profile} onConfirm={confirm} onClose={close} onRetry={retry} />
    </div>
  )
}

export default JobSearchPage
