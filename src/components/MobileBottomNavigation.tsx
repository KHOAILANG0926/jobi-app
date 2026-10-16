import { NavLink } from 'react-router-dom'
import { Bookmark, Home, MapPin, UserRound } from 'lucide-react'

export default function MobileBottomNavigation() {
  return <nav className="mobile-bottom-nav" aria-label="Điều hướng di động">
    <NavLink to="/" end><Home size={21} /><span>Trang chủ</span></NavLink>
    <NavLink to="/ban-do"><MapPin size={21} /><span>Bản đồ</span></NavLink>
    <NavLink to="/viec-lam/da-luu"><Bookmark size={21} /><span>Đã lưu</span></NavLink>
    <NavLink to="/ho-so"><UserRound size={21} /><span>Cá nhân</span></NavLink>
  </nav>
}
