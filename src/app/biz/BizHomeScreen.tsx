import { Link } from 'react-router-dom'
import { ChevronRight, ClipboardList, PlusCircle, Users } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { APPLICATION_STATUS_META } from '../../lib/applicationsStorage'
import BizGate from './BizGate'
import { recentApplications } from './bizView'
import { useBizData } from './useBizData'

const fmt = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('vi-VN') }

function Home({ userId }: { userId: string }) {
  const { user } = useAuth()
  const data = useBizData(userId)
  const recent = recentApplications(data.applications, 5)
  return (
    <div className="app-page" data-testid="app-biz-home">
      <header className="app-pagebar"><h1 className="app-pagebar__title">Nhà tuyển dụng</h1></header>
      <p className="app-biz__hello">Xin chào, <strong>{user?.name || 'bạn'}</strong></p>
      <section className="app-biz__stats" aria-label="Thống kê nhanh">
        <div><b>{data.jobsLoading ? '–' : data.jobs.length}</b><span>Tin đang đăng</span></div>
        <div><b>{data.applications.length}</b><span>Tổng ứng viên</span></div>
        <div className="app-biz__stat--alert"><b>{data.pending.length}</b><span>Chờ xét duyệt</span></div>
      </section>
      <div className="app-biz__cta"><Link className="app-btn app-btn--primary app-btn--block" to="/biz/dang-tin"><PlusCircle size={18} aria-hidden />Đăng tin mới</Link></div>
      <h2 className="app-menu__group">Ứng viên mới</h2>
      {recent.length === 0 ? <p className="app-state">{data.jobs.length === 0 ? 'Đăng tin để nhận ứng viên.' : 'Chưa có ứng viên nào.'}</p> : (
        <ul className="app-applist">{recent.map((a) => (
          <li key={a.id ?? a.appliedAt} className="app-appcard"><Link to="/biz/quan-ly-tin?tab=ung-vien" className="app-appcard__main"><strong>{a.seekerName ?? 'Ẩn danh'}</strong><span>{a.jobTitle}</span><small>{fmt(a.appliedAt)}</small></Link>
            <div className="app-appcard__side"><span className={'app-astatus app-astatus--' + a.status}>{APPLICATION_STATUS_META[a.status]?.labelVi ?? a.status}</span></div></li>
        ))}</ul>
      )}
      <h2 className="app-menu__group">Quản lý</h2>
      <Link className="app-menu__row" to="/biz/quan-ly-tin"><span className="app-menu__icon"><ClipboardList size={20} aria-hidden /></span><span>Tin tuyển dụng của tôi</span><ChevronRight size={18} aria-hidden /></Link>
      <Link className="app-menu__row" to="/biz/quan-ly-tin?tab=ung-vien"><span className="app-menu__icon"><Users size={20} aria-hidden /></span><span>Ứng viên{data.pending.length > 0 ? ` (${data.pending.length} chờ)` : ''}</span><ChevronRight size={18} aria-hidden /></Link>
    </div>
  )
}

export default function BizHomeScreen() { return <BizGate>{(userId) => <Home userId={userId} />}</BizGate> }
