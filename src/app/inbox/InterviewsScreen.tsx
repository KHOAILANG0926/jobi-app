import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarDays, ChevronLeft, MapPin } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { loadSeekerInterviews, subscribeInterviews, type InterviewSlot } from '../../lib/interviewStorage'

export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'short' })
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

// 구직자 면접 일정 — 웹 마이페이지 '다가오는 면접'과 같은 자료(lib/interviewStorage.loadSeekerInterviews)와 같은 기준(지금 이후 일정).
export default function InterviewsScreen() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [slots, setSlots] = useState<InterviewSlot[] | null>(null)
  useEffect(() => {
    if (!user?.id || user.role !== 'seeker') { setSlots([]); return }
    const sync = () => { loadSeekerInterviews(user.id).then(setSlots).catch(() => setSlots([])) }
    sync()
    return subscribeInterviews(sync)
  }, [user?.id, user?.role])
  const upcoming = (slots ?? []).filter((s) => new Date(s.datetime) > new Date())
  return (
    <div className="app-page" data-testid="app-interviews">
      <header className="app-pagebar"><button type="button" className="app-icon-btn" aria-label="Quay lại" onClick={() => navigate(-1)}><ChevronLeft size={24} aria-hidden /></button><h1 className="app-pagebar__title">Phỏng vấn sắp tới</h1></header>
      {loading || slots === null ? <p className="app-state" role="status">Đang tải…</p>
        : !user ? <div className="app-menu__login"><p>Đăng nhập để xem lịch phỏng vấn</p><div><Link className="app-btn app-btn--primary" to="/dang-nhap?redirect=%2Fho-so%2Fphong-van">Đăng nhập</Link></div></div>
        : upcoming.length === 0 ? <p className="app-state">Chưa có lịch phỏng vấn sắp tới.</p>
        : <ul className="app-applist">{upcoming.map((s) => (
            <li key={s.id} className="app-appcard"><div className="app-appcard__main"><strong>{s.jobTitle}</strong><span>{s.company}</span>
              <small><CalendarDays size={12} aria-hidden /> {fmtDate(s.datetime)} · {fmtTime(s.datetime)}</small>
              <small><MapPin size={12} aria-hidden /> {s.location}</small>{s.notes && <small>💬 {s.notes}</small>}</div></li>))}</ul>}
    </div>
  )
}
