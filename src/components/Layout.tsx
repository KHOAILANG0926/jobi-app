import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { formatPhoneDisplay } from '../lib/authStorage'
import { NotificationBell } from './NotificationBell'

const navClass = ({ isActive }: { isActive: boolean }) =>
  `layout__nav-link${isActive ? ' layout__nav-link--active' : ''}`

export function Layout() {
  const { user } = useAuth()

  return (
    <div className="layout">
      <header className="layout__header">
        <div className="layout__header-inner">
          <NavLink to="/" className="layout__brand">
            <span className="layout__logo" aria-hidden><img src="/logo.png.png" alt="logo" style="height:36px">
              <img src="/logo.png.png" alt="logo" style="height:36px" /><svg viewBox="0 0 48 48" role="img" style="display:none">
                <rect x="6" y="11" width="28" height="30" rx="8" fill="#E53935" />
                <path
                  d="M15 11.5h10c0-.8-.2-1.5-.7-2-.4-.4-1.1-.7-2-.7h-4.6c-.9 0-1.6.3-2 .7-.5.5-.7 1.2-.7 2z"
                  fill="#E53935"
                />
                <rect x="15" y="8" width="10" height="4.8" rx="2.2" fill="#ffffff" />
                <rect x="8.5" y="16" width="23" height="14" rx="2.8" fill="#ffffff" />
                <circle cx="35.5" cy="33.5" r="6.5" fill="#FFD600" />
                <path
                  d="M32.9 33.4l1.8 1.8 3.7-3.9"
                  fill="none"
                  stroke="#E53935"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M13.6 20.9h12.8v2.5H13.6zM13.6 24.9h9.3v2.2h-9.3z" fill="#E53935" />
              </svg>
            </span>
            <span className="layout__title">Việc gần Bạn</span>
          </NavLink>
          <nav className="layout__nav" aria-label="Điều hướng chính">
            {user?.role === 'employer' ? (
              <>
                <NavLink to="/bang-dieu-khien" className={navClass}>
                  Bảng điều khiển
                </NavLink>
                <NavLink to="/dang-tin" className={navClass}>
                  Đăng tin
                </NavLink>
                <NavLink to="/cong-dong" className={navClass}>
                  Cộng đồng
                </NavLink>
                <NavLink to="/ho-so" className={navClass}>
                  Hồ sơ
                </NavLink>
              </>
            ) : (
              <>
                <NavLink to="/" className={navClass} end>
                  Trang chủ
                </NavLink>
                <NavLink to="/cong-dong" className={navClass}>
                  Cộng đồng
                </NavLink>
                <NavLink to="/ho-so" className={navClass}>
                  Hồ sơ
                </NavLink>
              </>
            )}
            {user ? (
              <>
                <NotificationBell />
                <span className="layout__user" title={formatPhoneDisplay(user.phone)}>
                  {user.name}
                </span>
              </>
            ) : (
              <NavLink to="/dang-nhap" className={navClass}>
                Đăng nhập
              </NavLink>
            )}
          </nav>
        </div>
      </header>
      <main className="layout__main">
        <Outlet />
      </main>
      <footer className="layout__footer">
        <p>© {new Date().getFullYear()} Việc gần Bạn — Việc làm bán thời gian uy tín.</p>
      </footer>
    </div>
  )
}
