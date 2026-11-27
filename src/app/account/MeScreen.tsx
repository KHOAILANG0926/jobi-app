import { Link, useNavigate } from 'react-router-dom'
import { Bell, CalendarDays, ChevronRight, FileText, LogOut, MessageSquare, SlidersHorizontal, Menu as MenuIcon, Star, Briefcase } from 'lucide-react'
import type { ReactNode } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNotifications } from '../../context/NotificationContext'
import { loadViewHistory } from '../../lib/viewHistoryStorage'
import { useAppliedJobIds, useSavedJobIds } from '../data/useAppData'

function Row({ to, href, icon, children }: { to?: string; href?: string; icon: ReactNode; children: ReactNode }) {
  const inner = <><span className="app-menu__icon">{icon}</span><span>{children}</span><ChevronRight size={18} aria-hidden /></>
  return to ? <Link className="app-menu__row" to={to}>{inner}</Link> : <a className="app-menu__row" href={href}>{inner}</a>
}

// 마이 탭(구직자): 로그인 전에는 로그인 유도, 후에는 내 활동(지원·저장·최근 본)과 계정. CV 화면은 /ho-so/cv.
export default function MeScreen() {
  const { user, loading, logout } = useAuth()
  const { unreadCount } = useNotifications()
  const navigate = useNavigate()
  const applied = useAppliedJobIds()
  const saved = useSavedJobIds()
  const viewed = loadViewHistory().length
  const onLogout = async () => { await logout(); navigate('/', { replace: true }) }
  return (
    <div className="app-page" data-testid="app-me">
      <header className="app-pagebar"><h1 className="app-pagebar__title">Của tôi</h1><Link className="app-icon-btn" to="/menu" aria-label="Menu"><MenuIcon size={24} aria-hidden /></Link></header>
      {loading ? <p className="app-state" role="status">Đang tải…</p> : !user ? (
        <div className="app-menu__login"><p>Đăng nhập để ứng tuyển nhanh bằng CV đã lưu</p><div><Link className="app-btn app-btn--primary" to="/dang-nhap?redirect=%2Fho-so">Đăng nhập</Link><Link className="app-btn app-btn--ghost" to="/dang-ky?redirect=%2Fho-so">Đăng ký</Link></div></div>
      ) : (
        <div className="app-me__card" data-testid="app-me-card">
          <span className="app-me__avatar" aria-hidden>{(user.name || user.email || '?').trim().charAt(0).toUpperCase()}</span>
          <div><strong>{user.name || 'Người dùng'}</strong><span>{user.email}</span></div>
        </div>
      )}
      <div className="app-me__stats" data-testid="app-me-stats">
        <Link to="/ho-so/cv"><b>CV</b><span>CV của tôi</span></Link>
        <Link to="/ho-so/ung-tuyen"><b>{applied.size}</b><span>Đã ứng tuyển</span></Link>
        <Link to="/danh-sach/da-luu"><b>{saved.set.size}</b><span>Đã lưu</span></Link>
        <Link to="/danh-sach/da-xem"><b>{viewed}</b><span>Đã xem</span></Link>
      </div>
      <Row to="/ho-so/tin-nhan" icon={<MessageSquare size={20} aria-hidden />}>Tin nhắn</Row>
      <h2 className="app-menu__group">Tiện ích</h2>
      <Row to="/ho-so/thong-bao" icon={<Bell size={20} aria-hidden />}>Thông báo{unreadCount > 0 ? ` (${unreadCount} mới)` : ''}</Row>
      <Row to="/ho-so/phong-van" icon={<CalendarDays size={20} aria-hidden />}>Phỏng vấn sắp tới</Row>
      <Row to="/danh-sach/phu-hop" icon={<Star size={20} aria-hidden />}>Việc phù hợp với bạn</Row>
      <Row to="/ho-so/dieu-kien" icon={<SlidersHorizontal size={20} aria-hidden />}>Điều kiện tìm việc & thông báo</Row>
      {user?.role === 'employer' && <Row to="/biz" icon={<Briefcase size={20} aria-hidden />}>Trang nhà tuyển dụng</Row>}
      <h2 className="app-menu__group">Khác</h2>
      <Row to="/menu" icon={<FileText size={20} aria-hidden />}>Tất cả tiện ích</Row>
      {user && <button type="button" className="app-menu__row app-menu__row--btn" onClick={onLogout}><span className="app-menu__icon"><LogOut size={20} aria-hidden /></span><span>Đăng xuất</span></button>}
    </div>
  )
}
