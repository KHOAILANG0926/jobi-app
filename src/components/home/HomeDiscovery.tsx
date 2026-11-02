import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Briefcase, ChevronLeft, ChevronRight, Flame, MapPin, Menu, Search, SlidersHorizontal, Timer, X } from 'lucide-react'
import { cardSalary, mainCardJobs, PAY_LABELS } from '../../lib/mainJobCards'
import { groupDiscoveryJobs } from '../../lib/homeDiscovery'
import { mobileHomeSections } from '../../lib/mobileHomeSections'
import { shortArea } from '../../lib/shortArea'
import { cardCompany, cardTitle } from '../../lib/cardText'
import { CompanyLogo } from '../JobCard'
import { brandLogoFor } from '../../lib/brandLogo'
import { companyLogoUrl } from '../../lib/companyLogo'
import { useBrandsOptional } from '../../context/BrandsContext'
import { CATEGORY_SHORT } from '../../data/categories'
import type { Job } from '../../types/job'
import type { HomeDiscoveryState } from './HomeMapExplorer'

// 2026-11-02 Lee "알바몬 구성": 모바일 카드도 로고 자리를 둔다 — 위쪽 밀기 칸은 카드 위(top), 아래 목록은 오른쪽(side).
// 로고 자리 채우는 순서·코드는 PC와 같다(브랜드 로고 → 포스터 → 업종 사진 → 회사 이름 글자, JobCard CompanyLogo + cardPhoto.ts).
// 회사 이름이 없으면(아웃소싱 등) 회사 줄을 비우지 않고 업종 이름을 쓴다.
function JobSummary({ job, logo = 'side' }: { job: Job; logo?: 'top' | 'side' }) {
  const salary = cardSalary(job)
  const brands = useBrandsOptional()
  const imageUrl = brandLogoFor(job, brands) ?? companyLogoUrl(job.imageUrl)
  const company = cardCompany(job.company, shortArea(job.location)) || CATEGORY_SHORT[job.category] || ''
  const logoBox = <span className={`discovery-job__logo discovery-job__logo--${logo}`} aria-hidden>
    <CompanyLogo company={job.company} imageUrl={imageUrl} category={job.category} subcategory={job.subcategory} text={`${job.company} ${job.title} ${job.description ?? ''}`} />
  </span>
  return <NavLink to={`/viec-lam/${job.id}`} className={`discovery-job discovery-job--logo-${logo}`}>
    {logo === 'top' && logoBox}
    <span className="discovery-job__body">
      <span className="discovery-job__company">{company}</span>
      <strong className="discovery-job__title">{cardTitle(job.title, job.company)}</strong>
      <span className="discovery-job__meta"><MapPin size={12} aria-hidden />{shortArea(job.location)}</span>
      <span className="discovery-job__salary">
        {salary && !salary.lines
          ? <span className="discovery-job__pay">{(salary.kind ?? 'other') !== 'other' && <><span className={`pay-label pay-label--${salary.kind}`}>{PAY_LABELS[salary.kind ?? 'other']}</span> </>}<strong className="pay-amount">{salary.text}</strong></span>
          : <span className="pay-none">₫ {salary?.lines ? 'Xem lương theo vị trí' : 'Xem trong tin tuyển dụng'}</span>}
      </span>
    </span>
    {logo === 'side' && logoBox}
  </NavLink>
}

// 2026-11-02 Lee: 모바일 칸은 모두 옆으로 넘긴다(아래로 끝없이 길어지지 않게, 알바몬 모바일 방식).
// 카드형 칸 = 한 면 2열×3줄, 로고는 카드 위. 목록형 칸 = 한 면 5개, 로고는 오른쪽.
export function JobCarousel({ id, title, jobs, layout, moreTo }: { id: string; title: string; jobs: Job[]; layout: 'cards' | 'list' | 'top3'; moreTo?: string }) {
  const pages = groupDiscoveryJobs(jobs, layout === 'cards' ? 6 : layout === 'top3' ? 3 : 5)
  const track = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const signature = pages.flat().map(job => job.id).join('|')
  useEffect(() => { setActive(0); track.current?.scrollTo({ left: 0, behavior: 'instant' }) }, [signature])
  const go = (index: number) => track.current?.scrollTo({ left: index * track.current.clientWidth, behavior: 'smooth' })
  if (!pages.length) return null
  return <section className={`discovery-featured discovery-featured--${layout}`} aria-label={title} data-section={id}>
    <div className="discovery-section-head"><h2>{title}</h2><span>{pages.length > 1 ? `${active + 1}/${pages.length}` : `${jobs.length} tin`}</span></div>
    <div className="discovery-carousel" ref={track} onScroll={() => {
      const el = track.current
      if (el?.clientWidth) setActive(Math.round(el.scrollLeft / el.clientWidth))
    }}>
      {pages.map((page, index) => <div className={`discovery-carousel__page discovery-carousel__page--${layout}`} key={page[0].id} role="group" aria-label={`Nhóm ${index + 1} / ${pages.length}`}>
        {page.map(job => <JobSummary job={job} key={job.id} logo={layout === 'cards' ? 'top' : 'side'} />)}
      </div>)}
    </div>
    {pages.length > 1 && <div className="discovery-carousel__paging">
      <button type="button" aria-label="Nhóm công việc trước" disabled={active === 0} onClick={() => go(active - 1)}><ChevronLeft size={18} /></button>
      <div aria-label="Chọn nhóm công việc">{pages.map((page, index) => <button key={page[0].id} className={index === active ? 'is-active' : ''} aria-label={`Xem nhóm ${index + 1}`} aria-current={index === active ? 'true' : undefined} onClick={() => go(index)} />)}</div>
      <span aria-live="polite">{Math.min(active + 1, pages.length)}/{pages.length}</span>
      <button type="button" aria-label="Nhóm công việc tiếp theo" disabled={active >= pages.length - 1} onClick={() => go(active + 1)}><ChevronRight size={18} /></button>
    </div>}
    {moreTo && <NavLink className="discovery-more" to={moreTo}>Xem tất cả việc làm<ChevronRight size={16} aria-hidden /></NavLink>}
  </section>
}

const MENU_GROUPS = [
  { title: 'Tìm việc', links: [['Tất cả việc làm', '/'], ['Tìm kiếm', '/viec-lam/tim-kiem'], ['Bản đồ', '/ban-do'], ['Tuyển gấp', '/viec-lam/tuyen-gap'], ['Thương hiệu', '/franchise-jobs'], ['Việc làm tại Hàn Quốc', '/viec-han-quoc']] },
  { title: 'Việc của tôi', links: [['Đã lưu', '/viec-lam/da-luu'], ['Đã xem', '/viec-lam/da-xem'], ['Hồ sơ · Tin nhắn', '/ho-so'], ['Công cụ', '/cong-cu']] },
  { title: 'Khám phá', links: [['Cộng đồng', '/cong-dong'], ['Đăng tuyển', '/dang-tin'], ['Đăng nhập', '/dang-nhap']] },
]

function HomeMenu({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close() }, [])
  return <dialog ref={ref} className="discovery-menu" onClose={onClose} aria-label="Tất cả danh mục">
    <div className="discovery-section-head"><h2>Danh mục</h2><button type="button" aria-label="Đóng danh mục" onClick={onClose}><X /></button></div>
    {MENU_GROUPS.map(group => <section key={group.title}><h3>{group.title}</h3>{group.links.map(([label, to]) => <NavLink key={to} to={to} onClick={onClose}>{label}<ChevronRight size={16} /></NavLink>)}</section>)}
  </dialog>
}

// 2026-11-02 Lee: 모바일 메인 순서 — 배너 → 지도(조건 검색 상자를 없앤 자리) → 급여 높은 공고 → 아이콘·필터 줄 → 실시간 공고.
// 위치 안내 상자는 없앴다(헤더 위치 버튼·"Gần tôi"와 같은 기능). 위치를 안 정했으면 헤더 위치 버튼을 주황색으로 강조.
export function HomeDiscovery({ state }: { state: HomeDiscoveryState }) {
  const [menuOpen, setMenuOpen] = useState(false)
  return <>
    <div className="home-mobile-header">
      <button type="button" className={`home-mobile-header__location${state.originLabel === 'Chọn khu vực' ? ' is-unset' : ''}`} onClick={state.openLocation}><MapPin size={18} /><span>{state.originLabel}</span><span aria-hidden>⌄</span></button>
      <NavLink to="/viec-lam/tim-kiem" aria-label="Tìm kiếm việc làm"><Search size={21} /></NavLink>
      <button type="button" aria-label="Mở tất cả danh mục" onClick={() => setMenuOpen(true)}><Menu size={22} /></button>
    </div>
    {menuOpen && <HomeMenu onClose={() => setMenuOpen(false)} />}
  </>
}

/** 지도 바로 아래: 급여 높은 공고 칸, 아이콘 줄, 필터 줄, 위치·빈 결과 안내. */
export function HomeDiscoveryBody({ state }: { state: HomeDiscoveryState }) {
  const navigate = useNavigate()
  return <>
    <div className="home-mobile-discovery">
      <h1 className="home-discovery-sr">Việc làm gần bạn</h1>
      {/* 2026-11-02 Lee: 지도가 위로 올라가서 급여 높은 공고는 알바몬처럼 2열 카드(한 면 2열×3줄). */}
      <JobCarousel id="high-pay" title="Việc làm lương cao" jobs={mobileHomeSections(mainCardJobs(state.jobs)).highPay} layout="cards" />
      <nav className="home-shortcuts" aria-label="Khám phá việc làm">
        <button type="button" onClick={state.showMap}><MapPin /><span>Gần tôi</span></button>
        <button type="button" onClick={() => state.openFilters(2)}><Briefcase /><span>Ngành nghề</span></button>
        <NavLink to={'/?duration=' + encodeURIComponent('Một ngày') + '#home-job-filters'}><Timer /><span>Ngắn hạn</span></NavLink>
        <NavLink to="/viec-lam/tuyen-gap"><Flame /><span>Tuyển gấp</span></NavLink>
        <NavLink to="/viec-han-quoc"><span className="home-shortcuts__flag" aria-hidden>🇰🇷</span><span>Hàn Quốc</span></NavLink>
      </nav>
      <div className="home-filter-rail" aria-label="Bộ lọc việc làm">
        <button type="button" onClick={() => state.openFilters(0)}><SlidersHorizontal size={16} />Bộ lọc{state.filterCount > 0 && ` · ${state.filterCount}`}</button>
        <button type="button" onClick={state.openLocation}>Khu vực · Bán kính</button>
        <button type="button" onClick={() => state.openFilters(2)}>Ngành nghề</button>
        <button type="button" onClick={() => state.openFilters(1)}>Mức lương</button>
        <button type="button" onClick={() => state.openFilters(3)}>Ca làm · Phúc lợi</button>
        {state.filterCount > 0 && <button type="button" onClick={state.reset}>Đặt lại</button>}
      </div>
      {state.geoState === 'loading' && <p role="status" className="home-discovery-status">Đang xác định vị trí…</p>}
      {(state.geoState === 'denied' || state.geoState === 'unsupported') && <p role="status" className="home-discovery-status">Không lấy được vị trí. Bạn vẫn có thể <button type="button" onClick={state.openLocation}>chọn khu vực</button>.</p>}
      {!state.jobs.length && !state.loading && !state.jobsError && <div className="home-discovery-empty"><strong>Chưa có việc phù hợp</strong><p>Thử thay đổi khu vực hoặc điều kiện tìm kiếm.</p><button type="button" onClick={state.reset}>Đặt lại điều kiện</button><button type="button" onClick={() => navigate('/viec-lam/tim-kiem')}>Tìm theo khu vực</button></div>}
    </div>
  </>
}

/** 2026-11-02 Lee: 모바일 메인 칸 ② 특별한 공고 ③ 실시간 공고(규칙: src/lib/mobileHomeSections.ts). ①은 지도 아래 HomeDiscoveryBody. 빈 칸은 숨김. */
export function HomeDiscoverySections({ jobs }: { jobs: Job[] }) {
  const { special, live } = mobileHomeSections(mainCardJobs(jobs))
  return <div className="home-mobile-sections">
    <JobCarousel id="special" title="Việc làm đặc biệt" jobs={special} layout="list" />
    <JobCarousel id="live" title="Việc làm mới nhất" jobs={live} layout="list" moreTo="/viec-lam/tim-kiem" />
  </div>
}
