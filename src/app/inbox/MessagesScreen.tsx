import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { appendSeekerMessage, loadThreads, markReadBySeeker, subscribeMessages, type MessageThread } from '../../lib/messagesStorage'
import Conversation from './Conversation'

// 구직자 메시지함 — 웹 마이페이지의 MessagesInbox와 같은 자료·같은 함수(lib/messagesStorage). 공고 하나당 대화 하나.
export default function MessagesScreen() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const openId = params.get('job')
  const [threads, setThreads] = useState<MessageThread[] | null>(null)
  const seeker = user?.role === 'seeker'

  useEffect(() => {
    if (!seeker) { setThreads([]); return }
    const sync = () => { loadThreads().then(setThreads).catch(() => setThreads([])) }
    sync()
    return subscribeMessages(sync)
  }, [seeker])

  const active = threads?.find((t) => t.jobId === openId) ?? null
  useEffect(() => { if (active) void markReadBySeeker(active.jobId) }, [active?.jobId, active?.messages.length]) // eslint-disable-line react-hooks/exhaustive-deps

  if (active) {
    return <Conversation title={active.jobTitle} subtitle={active.company} jobHref={`/viec-lam/${active.jobId}`} messages={active.messages} mine="seeker" otherName={active.company}
      onBack={() => setParams({}, { replace: true })}
      onSend={async (body) => { const ok = await appendSeekerMessage({ id: active.jobId, title: active.jobTitle, company: active.company, employerPhone: active.employerPhone ?? '' }, body, user?.name); if (ok) loadThreads().then(setThreads); return ok }} />
  }
  return (
    <div className="app-page" data-testid="app-messages">
      <header className="app-pagebar"><button type="button" className="app-icon-btn" aria-label="Quay lại" onClick={() => navigate(-1)}><ChevronLeft size={24} aria-hidden /></button><h1 className="app-pagebar__title">Tin nhắn</h1></header>
      {loading || threads === null ? <p className="app-state" role="status">Đang tải…</p>
        : !user ? <div className="app-menu__login"><p>Đăng nhập để xem tin nhắn với nhà tuyển dụng</p><div><Link className="app-btn app-btn--primary" to="/dang-nhap?redirect=%2Fho-so%2Ftin-nhan">Đăng nhập</Link></div></div>
        : threads.length === 0 ? <p className="app-state">Chưa có cuộc trò chuyện. Mở một tin tuyển dụng và chọn «Nhắn tin nhà tuyển dụng».</p>
        : <ul className="app-applist">{threads.map((t) => (
            <li key={t.jobId}><button type="button" className="app-thread" onClick={() => setParams({ job: t.jobId })}>
              <span><strong>{t.jobTitle}</strong><small>{t.company}</small></span>{t.unreadBySeeker && <span className="app-dot" aria-label="Tin nhắn mới" />}</button></li>))}</ul>}
    </div>
  )
}
