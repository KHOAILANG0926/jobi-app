import { useEffect, useRef, useState, useCallback } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
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

interface MenuLink { label: string; to: string }
interface MenuCard { label: string; to: string; color: string; logo?: string; initial: string }
interface MenuItem {
  label: string
  to: string
  end?: boolean
  dropdown?: { heading: string; links: MenuLink[] }[]
  cards?: MenuCard[]
}

const MENU_ITEMS: MenuItem[] = [
  {
    label: 'Việc làm',
    to: '/',
    end: true,
    dropdown: [
      { heading: 'Phổ biến', links: [
        { label: 'Tất cả việc làm', to: '/' },
        { label: '🔥 Tuyển gấp', to: '/?urgent=1' },
        { label: '📍 Gần tôi', to: '/?near=1' },
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
    cards: [
      { label: 'Jollibee', to: '/?brand=Jollibee', color: '#ce1126', logo: 'https://www.google.com/s2/favicons?sz=64&domain=jollibee.com.vn', initial: 'J' },
      { label: 'The Orange Coffee', to: '/?brand=Orange Coffee', color: '#f97316', initial: 'O' },
      { label: "D'monter (Bingsu)", to: "/?brand=D'monter", color: '#ec4899', initial: 'D' },
      { label: 'Coca-Cola', to: '/?brand=Coca-Cola', color: '#e2231a', logo: 'https://www.google.com/s2/favicons?sz=64&domain=coca-cola.com', initial: 'C' },
    ],
  },
  {
    label: 'Công cụ',
    to: '/tinh-luong',
    dropdown: [
      { heading: 'Tiện ích', links: [
        { label: '🧮 Tính lương Gross ↔ Net', to: '/tinh-luong' },
        { label: '💬 Câu hỏi phỏng vấn', to: '/cau-hoi-phong-van' },
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
  const navigate = useNavigate()
  const location = useLocation()
  const [openMenu, setOpenMenu] = useState<number | null>(null)
  const navRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMenuEnter = useCallback((i: number) => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setOpenMenu(i)
  }, [])

  const handleMenuLeave = useCallback(() => {
    closeTimer.current = setTimeout(() => setOpenMenu(null), 120)
  }, [])

  useEffect(() => { setOpenMenu(null) }, [location])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
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
                : MENU_ITEMS.map((item, i) => (
                    <div
                      key={i}
                      className={`header-tab-wrap${openMenu === i ? ' header-tab-wrap--open' : ''}`}
                      onMouseEnter={() => handleMenuEnter(i)}
                      onMouseLeave={handleMenuLeave}
                    >
                      <button
                        type="button"
                        className={tabClass(location.pathname === item.to || (!!item.end && location.pathname === '/'))}
                        onClick={() => {
                          if (!item.dropdown && !item.cards) {
                            navigate(item.to)
                            return
                          }
                          setOpenMenu(openMenu === i ? null : i)
                        }}
                      >
                        {item.label}
                        {(item.dropdown || item.cards) && (
                          <svg className="header-tab__arrow" width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M2 3.5L5 6.5L8 3.5"/></svg>
                        )}
                      </button>

                      {item.dropdown && openMenu === i && (
                        <div className="mega-menu">
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
                                        onClick={() => { setOpenMenu(null); navigate(link.to) }}
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
                      )}

                      {item.cards && openMenu === i && (
                        <div className="mega-menu mega-menu--cards">
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
                      )}
                    </div>
                  ))
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
                <li><a href="/thong-bao">Thông báo</a></li>
                <li><a href="/lien-he">Liên hệ 1:1</a></li>
                <li><a href="/cau-hoi-thuong-gap">Câu hỏi thường gặp</a></li>
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
              <span className="footer-info__dot">·</span>
              <a href="/chinh-sach-quang-cao">Chính sách quảng cáo</a>
            </div>
            <p className="footer-info__copy">© {new Date().getFullYear()} Việt Gần Bạn. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Layout
