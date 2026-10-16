import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight, Flame, LocateFixed, MapPin, Menu, Search, SlidersHorizontal, Sparkles, Target, Timer, X, Zap } from 'lucide-react'
import { cardSalary, mainCardJobs } from '../../lib/mainJobCards'
import { groupDiscoveryJobs } from '../../lib/homeDiscovery'
import type { Job } from '../../types/job'
import type { HomeDiscoveryState } from './HomeMapExplorer'

function JobSummary({ job }: { job: Job }) {
  const salary = cardSalary(job)
  return <NavLink to={`/viec-lam/${job.id}`} className="discovery-job">
    <span className="discovery-job__company">{job.company}<span className="discovery-job__area"> · {job.location}</span></span>
    <strong className="discovery-job__title">{job.title}</strong>
    {salary && <span className="discovery-job__salary">{salary.label} <strong>{salary.text}</strong></span>}
  </NavLink>
}

function ThreeJobCarousel({ jobs }: { jobs: Job[] }) {
  const pages = groupDiscoveryJobs(mainCardJobs(jobs))
  const track = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const signature = pages.flat().map(job => job.id).join('|')
  useEffect(() => { setActive(0); track.current?.scrollTo({ left: 0, behavior: 'instant' }) }, [signature])
  const go = (index: number) => {
    const el = track.current
    const page = el?.children[index] as HTMLElement | undefined
    if (el && page) el.scrollTo({ left: page.offsetLeft - (el.children[0] as HTMLElement).offsetLeft, behavior: 'smooth' })
  }
  if (!pages.length) return null
  return <section className="discovery-featured" aria-label="Việc làm nổi bật">
    <div className="discovery-featured__caption"><Sparkles size={15} aria-hidden /><span>Khám phá <strong>việc làm đang tuyển</strong></span></div>
    <div className="discovery-carousel" ref={track} onScroll={() => {
      const el = track.current
      if (el?.children.length) {
        const first = (el.children[0] as HTMLElement).offsetLeft
        let closest = 0
        Array.from(el.children).forEach((page, index) => {
          if (Math.abs((page as HTMLElement).offsetLeft - first - el.scrollLeft) < Math.abs((el.children[closest] as HTMLElement).offsetLeft - first - el.scrollLeft)) closest = index
        })
        setActive(closest)
      }
    }}>
      {pages.map((page, index) => <div className="discovery-carousel__page" key={page[0].id} role="group" aria-label={`Nhóm ${index + 1} / ${pages.length}`}>
        {page.map(job => <JobSummary job={job} key={job.id} />)}
      </div>)}
    </div>
    <div className="discovery-carousel__paging">
      <div aria-label="Chọn nhóm công việc">{pages.map((page, index) => <button key={page[0].id} className={index === active ? 'is-active' : ''} aria-label={`Xem nhóm ${index + 1}`} aria-current={index === active ? 'true' : undefined} onClick={() => go(index)} />)}</div>
      <span aria-live="polite">{Math.min(active + 1, pages.length)}/{pages.length}</span>
    </div>
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

export function HomeDiscovery({ state }: { state: HomeDiscoveryState }) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [notice, setNotice] = useState(false)
  useEffect(() => { try { setNotice(sessionStorage.getItem('vgb:location-choice') !== 'dismissed') } catch { setNotice(true) } }, [])
  const dismissNotice = () => { setNotice(false); try { sessionStorage.setItem('vgb:location-choice', 'dismissed') } catch { /* optional */ } }
  return <>
    <div className="home-mobile-header">
      <button type="button" className="home-mobile-header__location" onClick={state.openLocation}><MapPin size={18} /><span>{state.originLabel}</span><span aria-hidden>⌄</span></button>
      <NavLink to="/viec-lam/tim-kiem" aria-label="Tìm kiếm việc làm"><Search size={21} /></NavLink>
      <button type="button" aria-label="Mở tất cả danh mục" onClick={() => setMenuOpen(true)}><Menu size={22} /></button>
    </div>
    {notice && <aside className="home-location-notice" aria-label="Chọn vị trí tìm việc">
      <div><strong>Tìm việc gần bạn hơn</strong><p>Dùng vị trí hiện tại hoặc tự chọn khu vực để bắt đầu.</p></div>
      <button className="home-location-notice__close" type="button" aria-label="Để sau" onClick={dismissNotice}><X size={17} /></button>
      <div className="home-location-notice__actions">
        <button type="button" onClick={() => { dismissNotice(); state.locate() }}><LocateFixed size={15} /><span>Dùng vị trí hiện tại</span></button>
        <button type="button" onClick={() => { dismissNotice(); state.openLocation() }}>Chọn khu vực</button>
      </div>
    </aside>}
    <div className="home-mobile-discovery">
      <h1 className="home-discovery-sr">Việc làm gần bạn</h1>
      <ThreeJobCarousel jobs={state.jobs} />
      <nav className="home-shortcuts" aria-label="Khám phá việc làm">
        <NavLink to="/viec-lam/tim-kiem?sort=recommended"><Zap /><span>Khám phá</span></NavLink>
        <button type="button" onClick={() => state.openFilters(2)}><Target /><span>Phù hợp</span></button>
        <button type="button" onClick={state.openLocation}><MapPin /><span>Khu vực</span></button>
        <NavLink to={'/viec-lam/tuyen-gap?duration=' + encodeURIComponent('Một ngày')}><Timer /><span>Ngắn hạn</span></NavLink>
        <NavLink to="/viec-lam/tuyen-gap"><Flame /><span>Tuyển gấp</span></NavLink>
      </nav>
      <div className="home-filter-rail" aria-label="Bộ lọc việc làm">
        <button type="button" aria-label="Bộ lọc" onClick={() => state.openFilters(0)}><SlidersHorizontal size={17} />{state.filterCount > 0 && <span>{state.filterCount}</span>}</button>
        <button type="button" onClick={() => state.openFilters(2)}>Ngành nghề<ChevronDown size={15} /></button>
        <button type="button" onClick={() => state.openFilters(1)}>Mức lương<ChevronDown size={15} /></button>
        <button type="button" onClick={() => state.openFilters(3)}>Ca làm<ChevronDown size={15} /></button>
        <button type="button" onClick={state.openLocation}>Khu vực<ChevronDown size={15} /></button>
        {state.filterCount > 0 && <button type="button" onClick={state.reset}>Đặt lại</button>}
      </div>
      {state.geoState === 'loading' && <p role="status" className="home-discovery-status">Đang xác định vị trí…</p>}
      {(state.geoState === 'denied' || state.geoState === 'unsupported') && <p role="status" className="home-discovery-status">Không lấy được vị trí. Bạn vẫn có thể <button type="button" onClick={state.openLocation}>chọn khu vực</button>.</p>}
      {!state.jobs.length && !state.loading && !state.jobsError && <div className="home-discovery-empty"><strong>Chưa có việc phù hợp</strong><p>Thử thay đổi khu vực hoặc điều kiện tìm kiếm.</p><button type="button" onClick={state.reset}>Đặt lại điều kiện</button><button type="button" onClick={() => navigate('/viec-lam/tim-kiem')}>Tìm theo khu vực</button></div>}
    </div>
    {menuOpen && <HomeMenu onClose={() => setMenuOpen(false)} />}
  </>
}

/** Sections consume the same real filtered records as the map. Empty sections vanish. */
export function HomeDiscoverySections({ jobs }: { jobs: Job[] }) {
  const cards = mainCardJobs(jobs)
  const sections = [
    { id: 'all', title: 'Đang tuyển dụng', jobs: cards, layout: 'horizontal' },
    { id: 'urgent', title: 'Đang tuyển gấp', jobs: cards.filter(job => job.urgent), layout: 'horizontal' },
    { id: 'direct', title: 'Doanh nghiệp đăng trực tiếp', jobs: cards.filter(job => !!job.employerId), layout: 'grid' },
  ].filter(section => section.jobs.length)
  return <div className="home-mobile-sections">{sections.map(section => <section key={section.id} className="home-discovery-section" data-section={section.id}>
    <div className="discovery-section-head"><h2><Flame size={20} aria-hidden />{section.title}</h2><span>{section.jobs.length} tin</span></div>
    <div className={`discovery-jobs discovery-jobs--${section.layout}`}>{section.jobs.map(job => <JobSummary key={job.id} job={job} />)}</div>
  </section>)}</div>
}

