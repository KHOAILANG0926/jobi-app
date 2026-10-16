import { NavLink, useLocation } from 'react-router-dom'
import { Home, MapPin, MessageCircle, UserRound, UsersRound } from 'lucide-react'

export default function MobileBottomNavigation() {
  const location = useLocation()
  const messagesOpen = new URLSearchParams(location.search).get('tab') === 'messages'
  return <nav className="mobile-bottom-nav" aria-label="Điều hướng di động">
    <NavLink to="/" end><Home size={21} /><span>Trang chủ</span></NavLink>
    <NavLink to="/cong-dong"><UsersRound size={21} /><span>Cộng đồng</span></NavLink>
    <NavLink to="/ban-do"><MapPin size={21} /><span>Bản đồ</span></NavLink>
    <NavLink to="/ho-so?tab=messages" className={({ isActive }) => isActive && messagesOpen ? 'active' : ''}><MessageCircle size={21} /><span>Tin nhắn</span></NavLink>
    <NavLink to="/ho-so?tab=info" end className={({ isActive }) => isActive && !messagesOpen ? 'active' : ''}><UserRound size={21} /><span>MY</span></NavLink>
  </nav>
}
