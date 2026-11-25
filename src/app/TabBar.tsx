import { NavLink, useLocation } from 'react-router-dom'
import { Building2, ClipboardList, Home, Map as MapIcon, MessagesSquare, PlusSquare, Sparkles, User } from 'lucide-react'
import type { ReactElement } from 'react'
import { tabsForPath, type AppTabIcon } from './tabs'

const ICONS: Record<AppTabIcon, ReactElement> = {
  home: <Home size={22} aria-hidden />,
  sparkles: <Sparkles size={22} aria-hidden />,
  map: <MapIcon size={22} aria-hidden />,
  community: <MessagesSquare size={22} aria-hidden />,
  user: <User size={22} aria-hidden />,
  manage: <ClipboardList size={22} aria-hidden />,
  post: <PlusSquare size={22} aria-hidden />,
  company: <Building2 size={22} aria-hidden />,
}

export default function TabBar() {
  const { pathname } = useLocation()
  const tabs = tabsForPath(pathname)
  return (
    <nav className="app-tabbar" aria-label="Điều hướng chính" data-testid="app-tabbar" data-tab-count={tabs.length}>
      {tabs.map((tab) => (
        <NavLink key={tab.key} to={tab.to} end={tab.end} className={({ isActive }) => 'app-tab' + (isActive ? ' app-tab--active' : '')}>
          {ICONS[tab.icon]}
          <span className="app-tab__label">{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
