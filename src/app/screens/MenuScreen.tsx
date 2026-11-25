import { Link, useNavigate } from 'react-router-dom'
import { Briefcase, Calculator, Check, ChevronRight, Clock, FileText, MapPin, MessageSquare, Phone, Star, UserRound, X, Zap, Bookmark, Map as MapIcon, Store, Flag } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import type { ReactNode } from 'react'

// 전체 메뉴(V3): 로그인 유도 → 내 활동 4칸 → 기능 묶음. 모든 항목은 이미 있는 화면으로 간다 — 앱에 아직 없는 화면(고객센터·약관·계산기·면접 질문)은
// 기존 웹 페이지를 그대로 연다(앱 안으로 옮기는 건 해당 단계에서).
function Row({ to, href, icon, children }: { to?: string; href?: string; icon: ReactNode; children: ReactNode }) {
  const inner = <><span className="app-menu__icon">{icon}</span><span>{children}</span><ChevronRight size={18} aria-hidden /></>
  return to ? <Link className="app-menu__row" to={to}>{inner}</Link> : <a className="app-menu__row" href={href}>{inner}</a>
}

export default function MenuScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()
  return (
    <div className="app-page" data-testid="app-menu">
      <header className="app-pagebar"><h1 className="app-pagebar__title">Menu</h1><button type="button" className="app-icon-btn" aria-label="Đóng" onClick={() => navigate(-1)}><X size={24} aria-hidden /></button></header>
      {!user && (
        <div className="app-menu__login"><p>Đăng nhập để ứng tuyển nhanh bằng CV đã lưu</p><div><Link className="app-btn app-btn--primary" to="/dang-nhap">Đăng nhập</Link><Link className="app-btn app-btn--ghost" to="/dang-ky">Đăng ký</Link></div></div>
      )}
      <div className="app-menu__quick">
        <Link to="/ho-so"><span><Check size={22} aria-hidden /></span>Đã ứng tuyển</Link>
        <Link to="/danh-sach/da-luu"><span><Bookmark size={22} aria-hidden /></span>Đã lưu</Link>
        <Link to="/danh-sach/da-xem"><span><Clock size={22} aria-hidden /></span>Đã xem</Link>
        <Link to="/ho-so"><span><UserRound size={22} aria-hidden /></span>CV của tôi</Link>
      </div>
      <h2 className="app-menu__group">Tìm việc</h2>
      <Row to="/danh-sach/tuyen-gap" icon={<Zap size={20} aria-hidden />}>Việc tuyển gấp</Row>
      <Row to="/danh-sach/phu-hop" icon={<Star size={20} aria-hidden />}>Việc phù hợp với bạn</Row>
      <Row to="/danh-sach/khu-vuc" icon={<MapPin size={20} aria-hidden />}>Việc làm theo khu vực</Row>
      <Row to="/ban-do" icon={<MapIcon size={20} aria-hidden />}>Bản đồ việc làm</Row>
      <Row to="/danh-sach/thuong-hieu" icon={<Store size={20} aria-hidden />}>Thương hiệu tuyển dụng</Row>
      <Row href="/viec-han-quoc" icon={<Flag size={20} aria-hidden />}>Việc làm tại Hàn Quốc</Row>
      <h2 className="app-menu__group">Công cụ</h2>
      <Row href="/tinh-luong" icon={<Calculator size={20} aria-hidden />}>Tính lương Gross ↔ Net</Row>
      <Row href="/cau-hoi-phong-van" icon={<MessageSquare size={20} aria-hidden />}>Câu hỏi phỏng vấn</Row>
      <h2 className="app-menu__group">Cộng đồng · Hỗ trợ</h2>
      <Row to="/cong-dong" icon={<MessageSquare size={20} aria-hidden />}>Cộng đồng Việc gần Bạn</Row>
      <Row href="/ho-tro" icon={<Phone size={20} aria-hidden />}>Hỗ trợ</Row>
      <Row href="/dieu-khoan" icon={<FileText size={20} aria-hidden />}>Điều khoản · Chính sách bảo mật</Row>
      <h2 className="app-menu__group">Dành cho nhà tuyển dụng</h2>
      <Row to="/biz" icon={<Briefcase size={20} aria-hidden />}>Đăng tin tuyển dụng · Quản lý tin</Row>
    </div>
  )
}
