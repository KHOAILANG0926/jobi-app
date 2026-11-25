import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarDays, ChevronRight, ClipboardList, LogOut, MessageSquare } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { loadEmployerInterviews, subscribeInterviews, type InterviewSlot } from '../../lib/interviewStorage'
import { countUnreadForEmployer, subscribeMessages } from '../../lib/messagesStorage'
import { fmtDate, fmtTime } from '../inbox/InterviewsScreen'
import BizGate from './BizGate'
import { useBizData } from './useBizData'

// 기업 계정 화면 — 계정 정보·메시지(안 읽은 수)·예정된 면접·로그아웃. 회사 소개 같은 별도 기업 정보 저장소는 지금 DB에 없어 만들지 않았다(대표 결정 필요).
function Company({ userId }: { userId: string }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { jobs, jobsLoading, applications } = useBizData(userId)
  const jobIds = useMemo(() => jobs.map((j) => j.id), [jobs])
  const [unread, setUnread] = useState(0)
  const [slots, setSlots] = useState<InterviewSlot[]>([])

  useEffect(() => {
    if (jobsLoading) return
    const sync = () => { countUnreadForEmployer(jobIds).then(setUnread).catch(() => {}) }
    sync()
    return subscribeMessages(sync)
  }, [jobIds.join(','), jobsLoading]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const sync = () => { loadEmployerInterviews(userId).then(setSlots).catch(() => {}) }
    sync()
    return subscribeInterviews(sync)
  }, [userId])
  const upcoming = slots.filter((s) => new Date(s.datetime) > new Date())
  const onLogout = async () => { await logout(); navigate('/', { replace: true }) }

  return (
    <div className="app-page" data-testid="app-biz-company">
      <header className="app-pagebar"><h1 className="app-pagebar__title">Doanh nghiệp</h1></header>
      <div className="app-me__card"><span className="app-me__avatar" aria-hidden>{(user?.name || user?.email || '?').trim().charAt(0).toUpperCase()}</span><div><strong>{user?.name || 'Nhà tuyển dụng'}</strong><span>{user?.email}</span></div></div>
      <Link className="app-menu__row" to="/biz/tin-nhan"><span className="app-menu__icon"><MessageSquare size={20} aria-hidden /></span><span>Tin nhắn{unread > 0 ? ` (${unread} mới)` : ''}</span><ChevronRight size={18} aria-hidden /></Link>
      <Link className="app-menu__row" to="/biz/quan-ly-tin"><span className="app-menu__icon"><ClipboardList size={20} aria-hidden /></span><span>Tin đã đăng ({jobs.length}) · Ứng viên ({applications.length})</span><ChevronRight size={18} aria-hidden /></Link>
      <h2 className="app-menu__group">Lịch phỏng vấn sắp tới</h2>
      {upcoming.length === 0 ? <p className="app-state">Chưa có lịch phỏng vấn.</p>
        : <ul className="app-applist">{upcoming.map((s) => (
            <li key={s.id} className="app-appcard"><div className="app-appcard__main"><strong>{s.seekerName || 'Ứng viên'}</strong><span>{s.jobTitle}</span>
              <small><CalendarDays size={12} aria-hidden /> {fmtDate(s.datetime)} · {fmtTime(s.datetime)} · {s.location}</small></div></li>))}</ul>}
      <button type="button" className="app-menu__row app-menu__row--btn" onClick={onLogout}><span className="app-menu__icon"><LogOut size={20} aria-hidden /></span><span>Đăng xuất</span></button>
    </div>
  )
}

export default function BizCompanyScreen() { return <BizGate>{(userId) => <Company userId={userId} />}</BizGate> }
