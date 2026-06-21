import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { NotificationBell } from './NotificationBell'

const navClass = ({ isActive }: { isActive: boolean }) =>
  `layout__nav-link${isActive ? ' layout__nav-link--active' : ''}`

export function Layout() {
  const { user, logout } = useAuth()
  return (
    <div className="layout">
      <header className="layout__header">
        <div className="layout__header-inner">
          <NavLink to="/" className="layout__brand">
            <span className="layout__logo" aria-hidden>
              <img src="/logo.png" alt="logo" style={{ height: '36px' }} />
            </span>
            <span className="layout__title">Việc gần Bạn</span>
          </NavLink>
          <nav className="layout__nav" aria-label="Điều hướng chính">
            {user?.role === 'employer' ? (
              <>
                <NavLink to="/bang-dieu-khien" className={navClass}>Bảng điều khiển</NavLink>
                <NavLink to="/dang-tin" className={navClass}>Đăng tin</NavLink>
                <NavLink to="/cong-dong" className={navClass}>Cộng đồng</NavLink>
                <NavLink to="/ho-so" className={navClass}>Hồ sơ</NavLink>
              </>
            ) : (
              <>
                <NavLink to="/" className={navClass} end>Trang chủ</NavLink>
                <NavLink to="/viec-han-quoc" className={navClass}>🇰🇷 Hàn Quốc</NavLink>
                <NavLink to="/cong-dong" className={navClass}>Cộng đồng</NavLink>
                <NavLink to="/ho-so" className={navClass}>Hồ sơ</NavLink>
              </>
            )}
            {user ? (
              <>
                <NotificationBell />
                <span className="layout__user">{user.name}</span>
                <button
                  className="layout__nav-link"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e53e3e' }}
                  onClick={logout}
                >
                  Đăng xuất
                </button>
              </>
            ) : (
              <NavLink to="/dang-nhap" className={navClass}>Đăng nhập</NavLink>
<NavLink to="/dang-ky" className={navClass}>Đăng ký</NavLink>
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

export default Layout