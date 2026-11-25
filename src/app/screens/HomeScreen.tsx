import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, LocateFixed, MapPin, Timer, Zap, Star } from 'lucide-react'
import { useBrandsOptional } from '../../context/BrandsContext'
import { computeBrandCounts } from '../../data/brandDirectory'
import { brandImageUrl } from '../../lib/brandLogo'
import { cardCompanyParts, cardTitle } from '../../lib/cardText'
import { groupDiscoveryJobs } from '../../lib/homeDiscovery'
import { computePreferredCategories, DEFAULT_JOB_SEARCH_PARAMS, filterAndSortJobs } from '../../lib/jobSearch'
import { sortJobsForList } from '../../lib/jobListFilter'
import { cardSalary, mainCardJobs, PAY_LABELS } from '../../lib/mainJobCards'
import { shortArea } from '../../lib/shortArea'
import type { Job } from '../../types/job'
import { useAppliedJobIds, useAppJobs, useSavedJobIds } from '../data/useAppData'
import { useAppFilters } from '../filters/AppFilters'
import { applyAppFilters } from '../filters/applyFilters'
import AppJobCard from '../ui/AppJobCard'
import AppTopBar from '../ui/AppTopBar'
import FilterRail from '../ui/FilterRail'
import { useFilterSheets } from '../ui/useFilterSheets'
import MiniMap from '../map/MiniMap'

// 메인 홈(V3 최종, 지도 B안). 순서: 상단바 → 한국 일자리 → 추천 → 지도(추천 바로 아래) → 바로가기 5개 → 필터 칩 → 브랜드 → 최신 목록.
// 급구 가로 섹션은 두지 않는다(대표 결정 2026-11-25). 모든 값은 기존 lib 함수·실제 공고에서 만든다.
function RecSummary({ job }: { job: Job }) {
  const salary = cardSalary(job)
  const parts = cardCompanyParts(job.company, shortArea(job.location))
  return (
    <Link to={`/viec-lam/${job.id}`} className="app-rec__item">
      <span className="app-rec__company">{parts.name}{parts.place ? ` · ${parts.place}` : ''}</span>
      <strong className="app-rec__title">{cardTitle(job.title, job.company)}</strong>
      {salary && !salary.lines
        ? <span className="app-rec__salary">{(salary.kind ?? 'other') !== 'other' && <span className="app-pay-tag">{PAY_LABELS[salary.kind ?? 'other']}</span>}<span className="app-pay-amount">{salary.text}</span></span>
        : <span className="app-rec__salary app-rec__salary--note">{salary?.lines ? 'Lương theo vị trí — xem chi tiết' : 'Xem trong tin tuyển dụng'}</span>}
    </Link>
  )
}

function Recommended({ jobs }: { jobs: Job[] }) {
  const pages = useMemo(() => groupDiscoveryJobs(jobs.slice(0, 6)), [jobs])
  const track = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  if (!pages.length) return null
  return (
    <section className="app-section" aria-label="Gợi ý cho bạn">
      <div className="app-section__head"><h2>Gợi ý cho bạn</h2><Link to="/danh-sach/goi-y">Xem tất cả<ChevronRight size={14} aria-hidden /></Link></div>
      <div className="app-rec" ref={track} onScroll={() => { const el = track.current; if (el?.clientWidth) setActive(Math.round(el.scrollLeft / (el.clientWidth * 0.9))) }}>
        {pages.map((page, i) => <div className="app-rec__card" key={page[0].id} role="group" aria-label={`Nhóm ${i + 1} / ${pages.length}`}>{page.map((j) => <RecSummary job={j} key={j.id} />)}</div>)}
      </div>
      {pages.length > 1 && <div className="app-dots" aria-hidden>{pages.map((p, i) => <i key={p[0].id} className={i === active ? 'app-on' : ''} />)}</div>}
    </section>
  )
}

const SHORTCUTS = [
  { to: '/danh-sach/phu-hop', label: 'Phù hợp', icon: Star },
  { to: '/danh-sach/khu-vuc', label: 'Khu vực', icon: MapPin },
  { to: '/danh-sach/ngan-han', label: 'Ngắn hạn', icon: Timer },
  { to: '/danh-sach/tuyen-gap', label: 'Tuyển gấp', icon: Zap },
  { to: '/danh-sach/gan-toi', label: 'Gần tôi', icon: LocateFixed },
] as const

export default function HomeScreen() {
  const { jobs, loading: jobsLoading, jobsError, areas, areasReady } = useAppJobs()
  const loading = jobsLoading || !areasReady
  const { filters } = useAppFilters()
  const brands = useBrandsOptional()
  const saved = useSavedJobIds()
  const applied = useAppliedJobIds()
  const sheets = useFilterSheets(jobs)

  const cards = useMemo(() => mainCardJobs(jobs), [jobs])
  const recommended = useMemo(
    () => filterAndSortJobs(cards, { ...DEFAULT_JOB_SEARCH_PARAMS, sortMode: 'recommended' }, computePreferredCategories(jobs, saved.set, applied)),
    [cards, jobs, saved.set, applied],
  )
  const brandTiles = useMemo(() => computeBrandCounts(jobs, brands).sort((a, b) => b.count - a.count).slice(0, 10), [jobs, brands])
  const latest = useMemo(() => sortJobsForList(applyAppFilters(cards, filters, areas), 'newest'), [cards, filters, areas])

  return (
    <div className="app-page app-home" data-testid="app-home">
      <AppTopBar onRegion={sheets.openRegion} />
      <a className="app-kr" href="/viec-han-quoc" aria-label="Việc làm tại Hàn Quốc">
        <span className="app-kr__photo" aria-hidden />
        <span className="app-kr__text"><small>Dành cho người Việt</small><strong>Việc làm tại Hàn Quốc</strong><span>Khám phá cơ hội việc làm tại Hàn Quốc</span></span>
        <ChevronRight size={22} aria-hidden />
      </a>
      <Recommended jobs={recommended} />
      <MiniMap jobs={jobs} areas={areas} />
      <nav className="app-shortcuts" aria-label="Khám phá việc làm">
        {SHORTCUTS.map(({ to, label, icon: Icon }) => <Link key={to} to={to}><span className="app-shortcuts__icon"><Icon size={24} aria-hidden /></span>{label}</Link>)}
      </nav>
      <FilterRail onOpen={sheets.openFilter} />
      {brandTiles.length > 0 && (
        <section className="app-section" aria-label="Thương hiệu tuyển dụng">
          <div className="app-section__head"><h2>Thương hiệu tuyển dụng</h2><Link to="/danh-sach/thuong-hieu">Xem tất cả<ChevronRight size={14} aria-hidden /></Link></div>
          <div className="app-brands">
            {brandTiles.map((b) => {
              const logo = brandImageUrl(b)
              return (
                <Link key={b.id} to={`/danh-sach/thuong-hieu?brand=${encodeURIComponent(b.linkTo)}`} className="app-brand">
                  <span className="app-brand__logo" style={logo ? undefined : { background: b.color }}>{logo ? <img src={logo} alt="" loading="lazy" /> : b.initial}</span>
                  <span className="app-brand__name">{b.name}</span><small>{b.count} tin</small>
                </Link>
              )
            })}
          </div>
        </section>
      )}
      <section className="app-section" aria-label="Việc làm mới nhất">
        <div className="app-section__head"><h2>Việc làm mới nhất</h2><Link to="/danh-sach/moi-nhat">Xem tất cả<ChevronRight size={14} aria-hidden /></Link></div>
        {jobsError && latest.length === 0 && <p className="app-state" role="alert">Không tải được danh sách việc làm. Vui lòng thử lại sau.</p>}
        {loading && latest.length === 0 && <p className="app-state" role="status">Đang tải việc làm…</p>}
        {!loading && !jobsError && latest.length === 0 && <p className="app-state">Chưa có việc làm phù hợp với điều kiện hiện tại.</p>}
        {latest.slice(0, 10).map((j) => <AppJobCard key={j.id} job={j} saved={saved.set.has(j.id)} onToggleSave={saved.toggle} />)}
        {latest.length > 10 && <Link to="/danh-sach/moi-nhat" className="app-more">Xem thêm việc làm</Link>}
      </section>
      {sheets.sheets}
    </div>
  )
}
