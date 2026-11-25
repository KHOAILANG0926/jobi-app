import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { appendEmployerMessage, loadEmployerThreads, markReadByEmployer, subscribeMessages, type MessageThread } from '../../lib/messagesStorage'
import Conversation from '../inbox/Conversation'
import BizGate from './BizGate'
import { useBizData } from './useBizData'

// 기업 메시지함 — 웹 기업 대시보드 '메시지' 탭과 같은 자료·같은 함수(lib/messagesStorage). 공고 하나에 지원자별 대화가 여러 개.
function Messages({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const openId = params.get('thread')
  const { jobs, jobsLoading } = useBizData(userId)
  const jobIds = useMemo(() => jobs.map((j) => j.id), [jobs])
  const [threads, setThreads] = useState<MessageThread[] | null>(null)

  useEffect(() => {
    if (jobsLoading) return
    const sync = () => { loadEmployerThreads(jobIds).then(setThreads).catch(() => setThreads([])) }
    sync()
    return subscribeMessages(sync)
  }, [jobIds.join(','), jobsLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  const active = threads?.find((t) => t.id === openId) ?? null
  useEffect(() => { if (active) void markReadByEmployer(active.id) }, [active?.id, active?.messages.length]) // eslint-disable-line react-hooks/exhaustive-deps

  if (active) {
    return <Conversation title={active.seekerName || 'Ứng viên ẩn danh'} subtitle={active.jobTitle} messages={active.messages} mine="employer" otherName={active.seekerName || 'Ứng viên'}
      onBack={() => setParams({}, { replace: true })}
      onSend={async (body) => { const ok = await appendEmployerMessage(active.id, body); if (ok) loadEmployerThreads(jobIds).then(setThreads); return ok }} />
  }
  return (
    <div className="app-page" data-testid="app-biz-messages">
      <header className="app-pagebar"><button type="button" className="app-icon-btn" aria-label="Quay lại" onClick={() => navigate(-1)}><ChevronLeft size={24} aria-hidden /></button><h1 className="app-pagebar__title">Tin nhắn</h1></header>
      {threads === null ? <p className="app-state" role="status">Đang tải…</p>
        : threads.length === 0 ? <p className="app-state">Chưa có tin nhắn từ ứng viên nào.</p>
        : <ul className="app-applist">{threads.map((t) => (
            <li key={t.id}><button type="button" className="app-thread" onClick={() => setParams({ thread: t.id })}>
              <span><strong>{t.seekerName || 'Ứng viên ẩn danh'}</strong><small>{t.jobTitle}</small></span>{t.unreadByEmployer && <span className="app-dot" aria-label="Tin nhắn mới" />}</button></li>))}</ul>}
    </div>
  )
}

export default function BizMessagesScreen() { return <BizGate>{(userId) => <Messages userId={userId} />}</BizGate> }
