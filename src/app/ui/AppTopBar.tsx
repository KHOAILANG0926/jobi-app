import { Link } from 'react-router-dom'
import { ChevronDown, MapPin, Menu, Search } from 'lucide-react'
import { useAppFilters } from '../filters/AppFilters'
import { shortProvince } from './RegionSheet'

// 상단바(V3): 왼쪽 지역 선택, 오른쪽 검색·메뉴.
export default function AppTopBar({ onRegion }: { onRegion: () => void }) {
  const { filters } = useAppFilters()
  return (
    <header className="app-topbar">
      <button type="button" className="app-topbar__region" onClick={onRegion} aria-label="Chọn khu vực">
        <MapPin size={20} aria-hidden /><span>{filters.province ? shortProvince(filters.province) : 'Toàn quốc'}</span><ChevronDown size={18} aria-hidden />
      </button>
      <Link to="/tim-kiem" className="app-icon-btn" aria-label="Tìm kiếm việc làm"><Search size={24} aria-hidden /></Link>
      <Link to="/menu" className="app-icon-btn" aria-label="Mở tất cả danh mục"><Menu size={24} aria-hidden /></Link>
    </header>
  )
}
