import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useJobs } from '../context/JobsContext'
import { useBrands } from '../context/BrandsContext'
import { computeBrandCounts, groupBrandsByCategory, type BrandDefinition, type BrandWithCount } from '../data/brandDirectory'
import { NotificationBell } from './NotificationBell'
import { ZaloIcon } from './ZaloIcon'

function BrandCardLogo({ color, logo, initial }: { color: string; logo?: string; initial: string }) {
  const [failed, setFailed] = useState(false)
  return (
    <span className="mega-menu__brand-card-logo" style={{ background: color }}>
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
  dropdown?: { heading: string; links: MenuLink[] }[]
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
                <BrandCardLogo color={b.color} logo={b.domain ? `https://www.google.com/s2/favicons?sz=64&domain=${b.domain}` : undefined} initial={b.initial} />
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
      { heading: 'Phổ biến', links: [
        { label: 'Tất cả việc làm', to: '/' },
        { label: '🔥 Tuyển gấp', to: '/viec-lam/tuyen-gap' },
        { label: '📍 Gần tôi', to: '/?near=1' },
      ]},
      { heading: 'Việc làm của tôi', links: [
        { label: '🔖 Việc làm đã lưu', to: '/viec-lam/da-luu' },
        { label: '🕘 Việc làm đã xem', to: '/viec-lam/da-xem' },
        { label: '🎯 Việc làm phù hợp', to: '/viec-lam/phu-hop' },
        { label: '💡 Gợi ý việc làm', to: '/viec-lam/goi-y' },
      ]},
      { heading: 'Theo khu vực', links: [
        { label: 'Hà Nội', to: '/?region=hanoi' },
        { label: 'TP. Hồ Chí Minh', to: '/?region=hcm' },
        { label: 'Bắc Ninh', to: '/?region=bacninh' },
        { label: 'Hải Phòng', to: '/?region=haiphong' },
        { label: 'Đà Nẵng', to: '/?region=danang' },
      ]},
      { heading: 'Theo ngành', links: [
        { label: '☕ Cà phê / Nhà hàng / F&B', to: '/?cat=cafe' },
        { label: '💼 Văn phòng / Part-time / Nhập liệu', to: '/?cat=office' },
        { label: '🛍️ Bán lẻ / Siêu thị / Cửa hàng', to: '/?cat=retail' },
        { label: '🏭 Nhà máy / Sản xuất / KCN', to: '/?cat=factory' },
        { label: '🛵 Giao hàng / Kho vận / Tài xế', to: '/?cat=delivery' },
        { label: '🧹 Vệ sinh / Giúp việc', to: '/?cat=cleaning' },
        { label: '🇰🇷 Lao động Hàn Quốc', to: '/viec-han-quoc' },
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
    label: 'Công cụ',
    to: '/tinh-luong',
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
    label: '🇰🇷 Làm việc tại Hàn Quốc',
    to: '/viec-han-quoc',
  },
]

export function Layout() {
  const { user, logout, loginWithZalo } = useAuth()
  const { jobs } = useJobs()
  const { brands } = useBrands()
  const navigate = useNavigate()
  const location = useLocation()
  const [openMenu, setOpenMenu] = useState<number | null>(null)
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

  useEffect(() => { setOpenMenu(null) }, [location])

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
          {import.meta.env.VITE_ZALO_APP_ID && (
            <button type="button" className="btn-zalo-header" onClick={loginWithZalo}>
              <ZaloIcon />
              <span>Zalo</span>
            </button>
          )}
          <NavLink to="/dang-nhap" className="header-tabs__login">Đăng nhập</NavLink>
          <NavLink to="/dang-ky" className="header-tabs__signup">Đăng ký</NavLink>
        </>
      )}
      <NavLink to="/ho-so?tab=cv" className="header-tabs__cv">Đăng CV</NavLink>
      <div className="header-tabs__post-wrap">
        <NavLink to="/dang-tin" className="header-tabs__post">Đăng tuyển</NavLink>
        <button
          type="button"
          className="header-tabs__post-arrow"
          onClick={() => navigate('/dang-tin')}
          aria-label="Mở menu đăng tuyển"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M2 3.5L5 6.5L8 3.5"/></svg>
        </button>
      </div>
    </div>
  )

  return (
    <div className="layout">
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
                          {item.dropdown.map((col, ci) => (
                            <div key={ci} className="mega-menu__col">
                              <h4 className="mega-menu__heading">{col.heading}</h4>
                              <ul className="mega-menu__list">
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
                        <button
                          type="button"
                          className={tabClass(location.pathname === item.to || (!!item.end && location.pathname === '/'))}
                          onClick={() => {
                            if (!item.dropdown && !item.cards && !item.brandMenu) {
                              navigate(item.to)
                              return
                            }
                            setOpenMenu(openMenu === i ? null : i)
                          }}
                        >
                          {item.label}
                          {(item.dropdown || item.cards || item.brandMenu) && (
                            <svg className="header-tab__arrow" width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M2 3.5L5 6.5L8 3.5"/></svg>
                          )}
                        </button>

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

      <footer className="layout__footer">
        {/* 고객센터 */}
        <div className="footer-top">
          <div className="footer-top__inner">
            <div className="footer-cs">
              <h4 className="footer-cs__title">Trung tâm hỗ trợ</h4>
              <ul className="footer-cs__links">
                <li><a href="mailto:support@viecganban.vn">Liên hệ 1:1</a></li>
              </ul>
            </div>

            <div className="footer-cs">
              <h4 className="footer-cs__title">Dịch vụ</h4>
              <ul className="footer-cs__links">
                <li><a href="/">Tìm việc làm</a></li>
                <li><a href="/dang-tin">Đăng tuyển</a></li>
                <li><a href="/cong-dong">Cộng đồng</a></li>
              </ul>
            </div>

            <div className="footer-sns">
              <h4 className="footer-cs__title">Kết nối</h4>
              <div className="footer-sns__icons">
                <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"/></svg>
                </a>
                <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                </a>
                <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" aria-label="YouTube">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* 회사 정보 */}
        <div className="footer-info">
          <div className="footer-info__inner">
            <p className="footer-info__company">
              <strong>Việt Gần Bạn</strong>
            </p>
            <p className="footer-info__contact">
              Email: support@viecganban.vn &nbsp;|&nbsp; Giờ làm việc: T2–T6, 09:00–18:00
            </p>
            <div className="footer-info__legal">
              <a href="/dieu-khoan">Điều khoản sử dụng</a>
              <span className="footer-info__dot">·</span>
              <a href="/chinh-sach-bao-mat">Chính sách bảo mật</a>
            </div>
            <p className="footer-info__copy">© {new Date().getFullYear()} Việt Gần Bạn. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Layout
