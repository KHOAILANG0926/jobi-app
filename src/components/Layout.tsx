import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { NotificationBell } from './NotificationBell'

const MENU_ITEMS = [
  {
    label: 'Việc làm',
    to: '/',
    end: true,
    dropdown: [
      { heading: 'Việc làm phổ biến', links: [
        { label: 'Tất cả việc làm', to: '/' },
        { label: 'Tuyển gấp', to: '/?urgent=1' },
        { label: 'Gần tôi', to: '/?near=1' },
      ]},
      { heading: 'Theo khu vực', links: [
        { label: 'Hà Nội', to: '/?region=ha-noi' },
        { label: 'TP. HCM', to: '/?region=tp-hcm' },
        { label: 'Đà Nẵng', to: '/?region=da-nang' },
        { label: 'Bình Dương', to: '/?region=binh-duong' },
      ]},
      { heading: 'Theo ngành', links: [
        { label: 'Nhà máy', to: '/?cat=factory' },
        { label: 'Nhà hàng', to: '/?cat=restaurant' },
        { label: 'Giao hàng', to: '/?cat=delivery' },
        { label: 'Bán lẻ', to: '/?cat=retail' },
      ]},
    ],
  },
  {
    label: 'Thương hiệu',
    to: '/?view=brands',
    dropdown: [
      { heading: 'Thương hiệu nổi bật', links: [
        { label: 'GrabFood', to: '/?q=Grab' },
        { label: 'Highlands Coffee', to: '/?q=Highlands' },
        { label: 'WinMart', to: '/?q=WinMart' },
        { label: 'Circle K', to: '/?q=Circle' },
        { label: 'FamilyMart', to: '/?q=Family' },
        { label: "McDonald's", to: '/?q=McDonald' },
      ]},
      { heading: 'Theo loại hình', links: [
        { label: 'Nhà hàng · Quán ăn', to: '/?cat=restaurant' },
        { label: 'Cà phê · Trà sữa', to: '/?cat=restaurant' },
        { label: 'Siêu thị · Cửa hàng', to: '/?cat=retail' },
        { label: 'Giao hàng · Vận chuyển', to: '/?cat=delivery' },
      ]},
    ],
  },
  {
    label: 'Cộng đồng',
    to: '/cong-dong',
    dropdown: [
      { heading: 'Cộng đồng', links: [
        { label: 'Đánh giá công ty', to: '/cong-dong?cat=review' },
        { label: 'Mẹo hay', to: '/cong-dong?cat=tip' },
        { label: 'Hỏi đáp', to: '/cong-dong?cat=question' },
      ]},
    ],
  },
  {
    label: 'Hồ sơ',
    to: '/ho-so',
    dropdown: [
      { heading: 'Dịch vụ cá nhân', links: [
        { label: 'Hồ sơ của tôi', to: '/ho-so' },
        { label: 'Tạo CV', to: '/ho-so?tab=cv' },
        { label: 'Việc đã lưu', to: '/ho-so?tab=saved' },
        { label: 'Đơn ứng tuyển', to: '/ho-so?tab=applied' },
      ]},
    ],
  },
]

export function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [query, setQuery] = useState('')
  const [openMenu, setOpenMenu] = useState<number | null>(null)
  const navRef = useRef<HTMLDivElement>(null)

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (q) navigate(`/?q=${encodeURIComponent(q)}`)
  }

  const tabClass = (isActive: boolean) =>
    `header-tab${isActive ? ' header-tab--active' : ''}`

  return (
    <div className="layout">
      <header className="layout__header">
        {/* Row 1: Logo + Search */}
        <div className="header-top">
          <div className="header-top__inner">
            <NavLink to="/" className="header-top__brand">
              <img src="/logo.png" alt="logo" className="header-top__logo" />
              <span className="header-top__title">Việt Gần Bạn</span>
            </NavLink>

            <form className="header-search" onSubmit={handleSearch}>
              <input
                className="header-search__input"
                type="text"
                placeholder="Bạn muốn tìm việc gì?"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              <button className="header-search__btn" type="submit" aria-label="Tìm kiếm">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </button>
            </form>
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
                    { label: 'Cộng đồng', to: '/cong-dong' },
                    { label: 'Hồ sơ', to: '/ho-so' },
                  ].map((item, i) => (
                    <NavLink key={i} to={item.to} className={({ isActive }) => tabClass(isActive)}>
                      {item.label}
                    </NavLink>
                  ))
                : MENU_ITEMS.map((item, i) => (
                    <div
                      key={i}
                      className={`header-tab-wrap${openMenu === i ? ' header-tab-wrap--open' : ''}`}
                      onMouseEnter={() => setOpenMenu(i)}
                      onMouseLeave={() => setOpenMenu(null)}
                    >
                      <button
                        type="button"
                        className={tabClass(location.pathname === item.to || (!!item.end && location.pathname === '/'))}
                        onClick={() => {
                          setOpenMenu(openMenu === i ? null : i)
                        }}
                      >
                        {item.label}
                        <svg className="header-tab__arrow" width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M2 3.5L5 6.5L8 3.5"/></svg>
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
                                      <NavLink
                                        to={link.to}
                                        className="mega-menu__link"
                                        onClick={() => setOpenMenu(null)}
                                      >
                                        {link.label}
                                      </NavLink>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
              )}
            </nav>

            <div className="header-tabs__actions">
              {user ? (
                <>
                  <NotificationBell />
                  <span className="header-tabs__user">{user.name}</span>
                  <button className="header-tabs__logout" onClick={logout}>Đăng xuất</button>
                </>
              ) : (
                <>
                  <NavLink to="/dang-nhap" className="header-tabs__login">Đăng nhập</NavLink>
                  <NavLink to="/dang-ky" className="header-tabs__signup">Đăng ký</NavLink>
                </>
              )}
              {user?.role === 'employer' ? null : (
                <NavLink to="/dang-tin" className="header-tabs__post">Đăng tuyển</NavLink>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="layout__main">
        <Outlet />
      </main>

      <footer className="layout__footer">
        <p>© {new Date().getFullYear()} Việt Gần Bạn — Việc làm bán thời gian uy tín.</p>
      </footer>
    </div>
  )
}

export default Layout
