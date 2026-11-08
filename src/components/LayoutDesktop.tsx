import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { brandImageUrl } from '../lib/brandLogo'
import { REGION_MENU_LINKS } from '../data/regionMenuLinks'
import { createPortal } from 'react-dom'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useJobs } from '../context/JobsContext'
import { useBrands } from '../context/BrandsContext'
import { computeBrandCounts, groupBrandsByCategory, type BrandDefinition, type BrandWithCount } from '../data/brandDirectory'
import { NotificationBell } from './NotificationBell'
import { SiteFooter } from './SiteFooter'

function BrandCardLogo({ color, logo, initial }: { color: string; logo?: string; initial: string }) {
  const [failed, setFailed] = useState(false)
  return (
    // 2026-11-01 Lee: 로고는 흰 바탕에 크게(브랜드 색 바탕 위에서는 McDonald's·Shopee 로고가 묻혀 안 보였음).
    <span className={`mega-menu__brand-card-logo${logo && !failed ? ' mega-menu__brand-card-logo--img' : ''}`} style={logo && !failed ? undefined : { background: color }}>
      {logo && !failed
        ? <img src={logo} alt="" aria-hidden onError={() => setFailed(true)} />
        : <span className="mega-menu__brand-card-initial">{initial}</span>
      }
    </span>
  )
}

/** state — Profile.tsx가 이미 읽는 location.state 플래그(openCvTab/
 *  openApplicationsTab)를 그대로 전달할 때만 쓴다. 새 라우팅 규칙을 만들지
 *  않고 기존 탭 진입 방식에 얹는다. */
interface MenuLink { label: string; to: string; state?: Record<string, unknown> }
interface MenuCard { label: string; to: string; color: string; logo?: string; initial: string }
interface MenuItem {
  label: string
  to: string
  end?: boolean
  dropdown?: { heading: string; links: MenuLink[]; inline?: boolean; col?: number }[]
  cards?: MenuCard[]
  /** "Thương hiệu" 전용 — 업종→브랜드 2단 메가메뉴(BrandMegaMenu)로 렌더링한다.
   *  실제 활성 공고 데이터로 매번 다시 계산되므로 여기엔 정적 목록을 두지 않는다. */
  brandMenu?: true
}

const BRAND_COLUMN_COUNT = 3

/** 업종 그룹을 N개 column에 균형 배치한다(그룹은 쪼개지 않고 통째로 한
 *  column에 배치) — 가장 무거운(브랜드 수 많은) 그룹부터 그때그때 가장 가벼운
 *  column에 채우는 greedy bin-packing. groups 자체는 이미 실제 useJobs()
 *  데이터로 매 렌더마다 다시 계산된 값이라, 이 배치도 데이터가 바뀌면 자동으로
 *  다시 계산된다 — column 구성을 하드코딩하지 않는다. */
function distributeIntoColumns<T extends { brands: unknown[] }>(groups: T[], columnCount: number): T[][] {
  const order = groups.map((g, i) => ({ g, i })).sort((a, b) => b.g.brands.length - a.g.brands.length)
  const columns: { items: { g: T; i: number }[]; weight: number }[] = Array.from({ length: columnCount }, () => ({ items: [], weight: 0 }))
  order.forEach(({ g, i }) => {
    const target = columns.reduce((min, c) => (c.weight < min.weight ? c : min), columns[0])
    target.items.push({ g, i })
    target.weight += g.brands.length + 1
  })
  return columns.map((c) => c.items.sort((a, b) => a.i - b.i).map((e) => e.g))
}

/** 2026-09-10 재설계(사용자 지시, 알바몬 "브랜드 알바" 정보 구조 참고) —
 *  왼쪽 "Thương hiệu theo ngành"은 업종별 브랜드를 카드가 아닌 가벼운 텍스트
 *  링크로 한 화면에 전부 펼친다(세로 탭 없음, 클릭 없이도 다 보임, 공고 수
 *  배지 없음 — 숫자가 주인공이 되지 않게). 오른쪽 "Thương hiệu nổi bật"은
 *  실제 공고가 2건 이상인 "대표 브랜드"만 낮고 납작한 카드로 보여준다(1건뿐인
 *  브랜드도 왼쪽 텍스트 목록에는 그대로 남아있음 — 대표 카드에서만 빠짐).
 *  이 컷오프도 실제 useJobs() 데이터로 매 렌더마다 다시 계산되므로 하드코딩된
 *  브랜드명 목록이 아니다 — 공고가 늘거나 줄면 대표 브랜드 구성도 자동으로
 *  바뀐다.
 *  2026-09-10 2차 수정(사용자 지시, 알바몬 캡처 기준 재조정): 왼쪽 목록을
 *  한 줄로 쭉 흘리지 않고 3개 column으로 균형 배치하고, 메가메뉴 자체를
 *  탭 위치가 아니라 헤더 콘텐츠 영역(.header-tabs__inner)에 맞춰 정렬해
 *  화면 오른쪽 경계를 벗어나던 문제를 고친다(아래 .mega-menu--brand
 *  CSS 참고, position 기준 변경은 JSX의 header-tab-wrap--static 클래스로
 *  처리).
 *  2026-09-11 재수정(사용자 지시, 브랜드 DB 전환): 브랜드 목록은 더 이상
 *  하드코딩(brandDirectory.ts의 BRAND_DIRECTORY)이 아니라 useBrands()로 관리자
 *  승인 브랜드를 가져온다. "대표 브랜드" 선정도 예전엔 count>=2 자동 임계값
 *  이었지만, 이제는 관리자가 /admin에서 직접 지정한 featured 플래그를 그대로
 *  쓴다(공고 수 자동 계산 아님) — 마이그레이션 시 예전 임계값 결과와 동일하게
 *  8개 브랜드에 featured=true를 심어 화면은 그대로 유지된다. */
function BrandMegaMenu({ jobs, brands, onNavigate }: { jobs: import('../types/job').Job[]; brands: BrandDefinition[]; onNavigate: (to: string) => void }) {
  const groups = useMemo(() => groupBrandsByCategory(computeBrandCounts(jobs, brands)), [jobs, brands])
  const columns = useMemo(() => distributeIntoColumns(groups, BRAND_COLUMN_COUNT), [groups])
  const featured = useMemo(
    () => groups.flatMap((g) => g.brands).filter((b) => b.featured).sort((a, b) => b.count - a.count),
    [groups],
  )

  if (groups.length === 0) {
    return <p className="mega-menu__brand-empty">Chưa có thương hiệu nào đang tuyển.</p>
  }

  return (
    <>
      <div className="mega-menu__brand-layout2">
        <div className="mega-menu__brand-byindustry">
          <h4 className="mega-menu__heading">Thương hiệu theo ngành</h4>
          <div className="mega-menu__brand-columns">
            {columns.map((col, ci) => (
              <div key={ci} className="mega-menu__brand-column">
                {col.map((g) => (
                  <div key={g.id} className="mega-menu__brand-industry-group">
                    <h5 className="mega-menu__brand-industry-label">{g.label}</h5>
                    <div className="mega-menu__brand-industry-links">
                      {g.brands.map((b) => (
                        <button
                          key={b.name}
                          type="button"
                          className="mega-menu__brand-link"
                          onClick={() => onNavigate(`/?brand=${encodeURIComponent(b.linkTo)}`)}
                        >
                          {b.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="mega-menu__brand-featured">
          <h4 className="mega-menu__heading">Thương hiệu nổi bật</h4>
          <div className="mega-menu__brand-featured-grid">
            {featured.map((b: BrandWithCount) => (
              <button
                key={b.name}
                type="button"
                className="mega-menu__brand-mini-card"
                onClick={() => onNavigate(`/?brand=${encodeURIComponent(b.linkTo)}`)}
              >
                <BrandCardLogo color={b.color} logo={brandImageUrl(b)} initial={b.initial} />
                <span className="mega-menu__brand-mini-card-label">{b.name}</span>
                <span className="mega-menu__brand-mini-card-count">{b.count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="mega-menu__brand-footer">
        <button type="button" className="mega-menu__brand-all" onClick={() => onNavigate('/franchise-jobs')}>
          Tất cả thương hiệu →
        </button>
      </div>
    </>
  )
}

const MENU_ITEMS: MenuItem[] = [
  {
    label: 'Việc làm',
    to: '/',
    end: true,
    dropdown: [
      { heading: 'Phổ biến', col: 0, links: [
        { label: 'Tất cả việc làm', to: '/' },
        { label: 'Việc làm theo khu vực', to: '/viec-lam/khu-vuc' },
        { label: 'Gần tôi', to: '/ban-do' },
      ]},
      { heading: 'Việc làm của tôi', col: 0, links: [
        { label: 'Việc làm đã lưu', to: '/viec-lam/da-luu' },
        { label: 'Việc làm đã xem', to: '/viec-lam/da-xem' },
        { label: 'Việc làm phù hợp', to: '/viec-lam/phu-hop' },
        { label: 'Gợi ý việc làm', to: '/viec-lam/goi-y' },
      ]},
      { heading: 'Theo khu vực', col: 1, inline: true, links: REGION_MENU_LINKS },
      { heading: 'Theo ngành', col: 2, links: [
        { label: 'Cà phê / Nhà hàng / F&B', to: '/?cat=am_thuc_do_uong' },
        { label: 'Văn phòng / Part-time / Nhập liệu', to: '/?cat=van_phong' },
        { label: 'Bán lẻ / Siêu thị / Cửa hàng', to: '/?cat=quan_ly_ban_hang' },
        { label: 'Nhà máy / Sản xuất / KCN', to: '/?cat=san_xuat_xay_dung' },
        { label: 'Giao hàng / Kho vận / Tài xế', to: '/?cat=lai_xe_giao_hang' },
        { label: 'Vệ sinh / Giúp việc', to: '/?cat=dich_vu' },
        { label: 'Lao động Hàn Quốc', to: '/viec-han-quoc' },
      ]},
      // 2026-09-20 사용자 지시("헤더 메가메뉴 탐색축 세분화", 알바몬
      // "기간별 알바정보"/"근무조건별 알바정보" 참고) — 알바몬처럼 축마다
      // 전용 진입점을 헤더에 둔다. job_duration은 PostJob.tsx 직접등록
      // 전용이라 값이 아직 적을 수 있음(job_duration.ts와 동일한 7구간
      // 라벨 그대로 사용), pledge는 이번 세션에 새로 추가한 자가서약
      // 필터(JobSearchPage의 pledgeOnly)로 실제 연결된다 — 둘 다 가짜
      // 링크가 아니라 실제 필터 상태를 URL로 프리셋하는 진짜 기능.
      { heading: 'Theo thời gian', col: 2, links: [
        { label: 'Một ngày', to: '/?duration=' + encodeURIComponent('Một ngày') + '#home-job-filters' },
        { label: 'Dưới 1 tuần', to: '/?duration=' + encodeURIComponent('Dưới 1 tuần') + '#home-job-filters' },
        { label: '1 - 3 tháng', to: '/?duration=' + encodeURIComponent('1 - 3 tháng') + '#home-job-filters' },
        { label: 'Trên 1 năm', to: '/?duration=' + encodeURIComponent('Trên 1 năm') + '#home-job-filters' },
      ]},
      { heading: 'Theo điều kiện', col: 3, links: [
        { label: 'Lương cao', to: '/?sort=salary' },
        { label: 'Có cam kết hợp đồng / BHXH', to: '/?pledge=1#home-job-filters' },
      ]},
      // Lee 2026-11-08 승인: 알바몬 '테마 채용관'처럼 주제별 목록(/chu-de/:slug, ServicePages.THEMES와 같은 8개)
      { heading: 'Theo chủ đề', col: 3, links: [
        { label: 'Có ký túc xá', to: '/chu-de/ky-tuc-xa' },
        { label: 'Có xe đưa đón', to: '/chu-de/xe-dua-don' },
        { label: 'Có bao ăn', to: '/chu-de/bao-an' },
        { label: 'Việc ngắn hạn', to: '/chu-de/ngan-han' },
        { label: 'Việc part-time', to: '/chu-de/part-time' },
        { label: 'Làm ca đêm', to: '/chu-de/ca-dem' },
        { label: 'Đi làm ngay', to: '/chu-de/di-lam-ngay' },
        { label: 'Việc trong KCN', to: '/chu-de/khu-cong-nghiep' },
      ]},
    ],
  },
  {
    label: 'Thương hiệu',
    to: '/franchise-jobs',
    brandMenu: true,
  },
  /** 2026-09-11 재설계(사용자 지시, 알바몬 "개인서비스" 정보 구조 참고) — 실제
   *  존재하는 구직자 기능만 4개 영역으로 나열한다. 없는 기능(예: "Quản lý CV"는
   *  Profile.tsx에 "Tạo CV" 탭 하나뿐이라 별도 화면이 아님, "Cài đặt tài khoản"은
   *  아예 존재하지 않음)은 넣지 않는다 — 가짜 링크·"Coming soon" 금지. 로그인
   *  필요 화면(/ho-so)은 기존 auth 규칙 그대로(별도 redirect 로직 추가 안 함) —
   *  Profile.tsx가 이미 처리하는 location.state.openCvTab/openApplicationsTab에
   *  얹어서 해당 탭으로 바로 연다. "Việc đã lưu"/"Việc đã xem"은 Profile.tsx
   *  내부 탭 대신 Việc làm 메뉴와 동일한 기존 전용 라우트를 그대로 재사용한다. */
  {
    // 2026-09-20 사용자 지시 — 알바몬 6개 상단 탭을 전부 클릭해보니 예외 없이
    // 각자 전용 페이지로 이동했다("Công cụ"만 특별한 게 아니라 이게 알바몬
    // 전체 원칙). 이전엔 급여계산기(/tinh-luong) 하나로만 점프해서 드롭다운의
    // 나머지 3개 그룹(이력서/지원현황/계정)은 드롭다운을 열어야만 보였다 —
    // 4개 그룹을 한눈에 보여주는 허브 페이지(ToolsHub.tsx, /cong-cu) 신설.
    label: 'Công cụ',
    to: '/cong-cu',
    dropdown: [
      { heading: 'Hồ sơ xin việc', links: [
        { label: 'Hồ sơ của tôi', to: '/ho-so' },
        { label: 'Tạo CV', to: '/ho-so', state: { openCvTab: true } },
      ]},
      { heading: 'Hoạt động ứng tuyển', links: [
        { label: 'Việc đã ứng tuyển', to: '/ho-so', state: { openApplicationsTab: true } },
        { label: 'Việc làm đã lưu', to: '/viec-lam/da-luu' },
        { label: 'Việc làm đã xem', to: '/viec-lam/da-xem' },
      ]},
      { heading: 'Công cụ việc làm', links: [
        { label: 'Tính lương Gross ↔ Net', to: '/tinh-luong' },
        { label: 'Câu hỏi phỏng vấn', to: '/cau-hoi-phong-van' },
      ]},
      { heading: 'Tài khoản', links: [
        { label: 'Thông tin cá nhân', to: '/ho-so' },
      ]},
    ],
  },
  {
    label: 'Cộng đồng',
    to: '/cong-dong',
  },
  {
    label: 'Làm việc tại Hàn Quốc',
    to: '/viec-han-quoc',
  },
]

export function Layout() {
  const { user, logout } = useAuth()
  const { jobs } = useJobs()
  const { brands } = useBrands()
  const navigate = useNavigate()
  const location = useLocation()
  const [openMenu, setOpenMenu] = useState<number | null>(null)
  const [employerMenuOpen, setEmployerMenuOpen] = useState(false)
  const [headerQuery, setHeaderQuery] = useState('')
  const employerMenuRef = useRef<HTMLDivElement>(null)
  const employerArrowRef = useRef<HTMLButtonElement>(null)
  const navRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRefs = useRef<(HTMLDivElement | null)[]>([])
  const dropdownRef = useRef<HTMLDivElement>(null)
  // 모바일(<=640px)에서는 .header-tabs__nav에 가로 스크롤용 overflow-x:auto가
  // 걸려 있는데, CSS overflow 스펙상 한쪽 축이 visible이 아니면 다른 축도
  // auto로 강제된다 — 그 결과 이 nav 안에 있던 절대위치(.mega-menu) 드롭다운이
  // 세로로 잘려 화면에 실질적으로 보이지 않는 결함이 있었다(2026-09-09 실기기
  // 터치 환경 재현·확인). 모바일에서만 드롭다운을 document.body로 포탈해
  // nav의 overflow 클리핑 밖으로 꺼내고, 위치는 탭 줄 하단(고정 헤더 기준)
  // 좌표를 계산해 고정폭 패널로 띄운다 — 데스크톱은 기존 position:absolute
  // 그대로 유지(포탈 미사용, 회귀 위험 없음).
  const [mobileDropdownTop, setMobileDropdownTop] = useState<number | null>(null)

  const isMobileNav = () =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches

  const handleMenuEnter = useCallback((i: number) => {
    if (isMobileNav()) return // 모바일은 클릭으로만 열고 닫는다(hover 이벤트 미사용)
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setOpenMenu(i)
  }, [])

  const handleMenuLeave = useCallback(() => {
    if (isMobileNav()) return
    closeTimer.current = setTimeout(() => setOpenMenu(null), 120)
  }, [])

  useEffect(() => { setOpenMenu(null); setEmployerMenuOpen(false) }, [location])

  useEffect(() => {
    if (openMenu === null || !isMobileNav()) {
      setMobileDropdownTop(null)
      return
    }
    const wrap = wrapRefs.current[openMenu]
    if (wrap) setMobileDropdownTop(wrap.getBoundingClientRect().bottom)
  }, [openMenu])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (navRef.current?.contains(target)) return
      if (dropdownRef.current?.contains(target)) return
      setOpenMenu(null)
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  useEffect(() => {
    if (!employerMenuOpen) return
    const closeOutside = (event: MouseEvent) => {
      if (!employerMenuRef.current?.contains(event.target as Node)) setEmployerMenuOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setEmployerMenuOpen(false)
        employerArrowRef.current?.focus()
      }
    }
    document.addEventListener('click', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('click', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [employerMenuOpen])

  const tabClass = (isActive: boolean) =>
    `header-tab${isActive ? ' header-tab--active' : ''}`

  const headerActions = (
    <div className="header-tabs__actions">
      {user ? (
        <>
          <NotificationBell />
          <NavLink to="/ho-so" className="header-tabs__login">{user.name}</NavLink>
          <button className="header-tabs__logout" onClick={logout}>Đăng xuất</button>
        </>
      ) : (
        <>
          <NavLink to="/dang-nhap" className="header-tabs__login">Đăng nhập / Đăng ký</NavLink>
        </>
      )}
      <NavLink to="/ho-so?tab=cv" className="header-tabs__cv">Đăng CV</NavLink>
      <div className="header-tabs__employer" ref={employerMenuRef}>
        <div className="header-tabs__post-wrap">
          <NavLink to="/dang-tin" className="header-tabs__post">Nhà tuyển dụng</NavLink>
          <button
            type="button"
            className="header-tabs__post-arrow"
            ref={employerArrowRef}
            onClick={() => { setEmployerMenuOpen((open) => !open); setOpenMenu(null) }}
            aria-label="Mở menu nhà tuyển dụng"
            aria-expanded={employerMenuOpen}
            aria-controls="employer-header-menu"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M2 3.5L5 6.5L8 3.5"/></svg>
          </button>
        </div>
        {employerMenuOpen && (
          <div id="employer-header-menu" className="mega-menu mega-menu--employer">
            <div className="mega-menu__inner">
              <ul className="mega-menu__list">
                {[
                  ['+ Đăng tin mới', '/dang-tin'],
                  ['Tin đã đăng', '/bang-dieu-khien?tab=jobs'],
                  ['Quản lý ứng viên', '/bang-dieu-khien?tab=applicants'],
                  ['Tin nhắn', '/bang-dieu-khien?tab=messages'],
                  ['Làm poster tuyển dụng', '/lam-poster'],
                ].map(([label, to]) => (
                  <li key={to}><NavLink className="mega-menu__link" to={to} onClick={() => setEmployerMenuOpen(false)}>{label}</NavLink></li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="layout layout--d">
      <header className="layout__header">
        {/* Row 1: Brand */}
        <div className="header-top">
          <div className="header-top__inner">
            <NavLink to="/" className="header-top__brand">
              <img src="/logo.png" alt="logo" className="header-top__logo" />
              <span className="header-top__brand-copy">
                <span className="header-top__title">Việcganban</span>
                <span className="header-top__tagline">Kết nối cơ hội, vươn xa tương lai</span>
              </span>
            </NavLink>
            {/* Lee 2026-11-08 "촌스럽다 → 지금 바꿔": 알바몬처럼 로고 옆 검색 칸. 사용자·등록 버튼은 원래 자리(첫 줄 오른쪽) — 로그인하면 버튼이 늘어 메뉴 줄에 두면 넘침 */}
            <form className="header-search" role="search" onSubmit={(e) => { e.preventDefault(); const q = headerQuery.trim(); navigate(q ? `/viec-lam/tim-kiem?q=${encodeURIComponent(q)}` : '/viec-lam/tim-kiem') }}>
              <input className="header-search__input" value={headerQuery} onChange={(e) => setHeaderQuery(e.target.value)}
                placeholder="Tìm việc theo tên công việc, công ty..." aria-label="Tìm việc làm" />
              {/* type="button": 다른 화면(로그인 등)의 제출 단추와 겹치지 않게 — 입력 칸 Enter는 그대로 검색 */}
              <button type="button" className="header-search__btn" aria-label="Tìm" onClick={(e) => e.currentTarget.form?.requestSubmit()}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" strokeLinecap="round" /></svg>
              </button>
            </form>
            {headerActions}
          </div>
        </div>

        {/* Row 2: Tabs + Actions */}
        <div className="header-tabs">
          <div className="header-tabs__inner">
            <nav className="header-tabs__nav" ref={navRef} aria-label="Điều hướng chính">
              {(user?.role === 'employer'
                ? [
                    { label: 'Bảng điều khiển', to: '/bang-dieu-khien' },
                    { label: 'Đăng tin', to: '/dang-tin' },
                    // 2026-09-20 사용자 지시 — 기업 계정 로그인 시 구직자용
                    // "Việc làm" 메뉴 전체가 사라져서 급구 페이지 등에
                    // URL 직접 입력 없이는 접근할 방법이 없었음(세션에서
                    // 실제로 겪은 문제). 전체 메가메뉴는 그대로 안 쓰고,
                    // 홈(전체 공고 탐색 진입점)으로 가는 링크 하나만 추가.
                    { label: 'Việc làm', to: '/' },
                  ].map((item, i) => (
                    <NavLink key={i} to={item.to} className={({ isActive }) => tabClass(isActive)}>
                      {item.label}
                    </NavLink>
                  ))
                : MENU_ITEMS.map((item, i) => {
                    const isOpen = openMenu === i
                    const isMobilePortal = isOpen && mobileDropdownTop !== null
                    const dropdownBody = item.dropdown ? (
                      <div
                        className={`mega-menu${isMobilePortal ? ' mega-menu--mobile' : ''}`}
                        ref={isMobilePortal ? dropdownRef : undefined}
                        style={isMobilePortal ? { top: mobileDropdownTop } : undefined}
                      >
                        <div className="mega-menu__inner">
                          {/* Lee 2026-11-08 "무슨 배열이 이래?": 알바몬처럼 정해진 세로 칸(col)에 묶음을 위아래로 쌓는다. col 없는 메뉴는 묶음마다 한 칸. */}
                          {Object.values(item.dropdown.reduce<Record<number, NonNullable<MenuItem['dropdown']>>>((acc, g, gi) => { const k = g.col ?? gi; (acc[k] ??= []).push(g); return acc }, {})).map((stack, si) => (
                          <div key={si} className="mega-menu__stack">
                          {stack.map((col, ci) => (
                            <div key={ci} className="mega-menu__col">
                              <h4 className="mega-menu__heading">{col.heading}</h4>
                              <ul className={`mega-menu__list${col.inline ? ' mega-menu__list--inline' : ''}`}>
                                {col.links.map((link, li) => (
                                  <li key={li}>
                                    <button
                                      type="button"
                                      className="mega-menu__link"
                                      onClick={() => { setOpenMenu(null); navigate(link.to, link.state ? { state: link.state } : undefined) }}
                                    >
                                      {link.label}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                          </div>
                          ))}
                        </div>
                      </div>
                    ) : item.cards ? (
                      <div
                        className={`mega-menu mega-menu--cards${isMobilePortal ? ' mega-menu--mobile' : ''}`}
                        ref={isMobilePortal ? dropdownRef : undefined}
                        style={isMobilePortal ? { top: mobileDropdownTop } : undefined}
                      >
                        <div className="mega-menu__brand-grid">
                          {item.cards.map((card, ci) => (
                            <button
                              key={ci}
                              type="button"
                              className="mega-menu__brand-card"
                              onClick={() => { setOpenMenu(null); navigate(card.to) }}
                            >
                              <BrandCardLogo color={card.color} logo={card.logo} initial={card.initial} />
                              <span className="mega-menu__brand-card-label">{card.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : item.brandMenu ? (
                      <div
                        className={`mega-menu mega-menu--brand${isMobilePortal ? ' mega-menu--mobile' : ''}`}
                        ref={isMobilePortal ? dropdownRef : undefined}
                        style={isMobilePortal ? { top: mobileDropdownTop } : undefined}
                      >
                        <BrandMegaMenu jobs={jobs} brands={brands} onNavigate={(to) => { setOpenMenu(null); navigate(to) }} />
                      </div>
                    ) : null

                    return (
                      <div
                        key={i}
                        ref={(el) => { wrapRefs.current[i] = el }}
                        className={`header-tab-wrap${isOpen ? ' header-tab-wrap--open' : ''}${item.brandMenu ? ' header-tab-wrap--static' : ''}`}
                        onMouseEnter={() => handleMenuEnter(i)}
                        onMouseLeave={handleMenuLeave}
                      >
                        {item.dropdown || item.cards || item.brandMenu ? (
                          // 2026-09-20 사용자 지시("알바몬은 탭 눌러도 개별
                          // 페이지로 넘어가는데 우리는 안 넘어가잖아") — 드롭다운이
                          // 있는 탭도 라벨을 누르면 그 섹션의 대표 페이지(item.to)로
                          // 실제 이동해야 한다(알바몬 "채용정보" 클릭 시 /jobs/home
                          // 이동과 동일). 지금까지는 라벨 클릭이 드롭다운 토글
                          // 전용이라 탭 자체가 링크로 동작하지 않았다. 데스크톱은
                          // 이미 hover로 드롭다운이 열리므로(handleMenuEnter)
                          // 라벨을 순수 네비게이션 링크로 바꿔도 드롭다운 접근성이
                          // 안 줄어들지만, 모바일은 hover가 없어(isMobileNav) 화살표
                          // 버튼을 라벨과 분리해 토글 전용으로 남겨야 드롭다운
                          // 항목에 계속 접근할 수 있다.
                          <div className={`${tabClass(location.pathname === item.to || (!!item.end && location.pathname === '/'))} header-tab--split`}>
                            <button type="button" className="header-tab__label" onClick={() => navigate(item.to)}>
                              {item.label}
                            </button>
                            <button
                              type="button"
                              className="header-tab__arrow-btn"
                              aria-label={`Mở danh mục ${item.label}`}
                              aria-expanded={isOpen}
                              onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === i ? null : i) }}
                            >
                              <svg className="header-tab__arrow" width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M2 3.5L5 6.5L8 3.5"/></svg>
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className={tabClass(location.pathname === item.to || (!!item.end && location.pathname === '/'))}
                            onClick={() => navigate(item.to)}
                          >
                            {item.label}
                          </button>
                        )}

                        {isOpen && dropdownBody && (isMobilePortal ? createPortal(dropdownBody, document.body) : dropdownBody)}
                      </div>
                    )
                  })
              )}
            </nav>
          </div>
        </div>
      </header>

      <main className="layout__main">
        <Outlet />
      </main>

      <SiteFooter />
    </div>
  )
}

export default Layout
