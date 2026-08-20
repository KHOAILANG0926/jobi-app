import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  appendSeekerMessage,
  loadThreads,
  markReadBySeeker,
  subscribeMessages,
  type MessageThread,
} from '../lib/messagesStorage'

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('vi-VN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function MessagesInbox() {
  const { user } = useAuth()
  const [threads, setThreads] = useState<MessageThread[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [typing, setTyping] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const sync = () => {
      loadThreads().then((next) => {
        setThreads(next)
        setActiveId((cur) => {
          if (cur && next.some((t) => t.jobId === cur)) return cur
          return next[0]?.jobId ?? null
        })
      })
    }
    sync()
    return subscribeMessages(sync)
  }, [])

  const active = useMemo(
    () => threads.find((t) => t.jobId === activeId) ?? null,
    [threads, activeId],
  )

  // Auto-scroll to bottom when messages or typing changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [active?.messages.length, typing])

  // Show typing indicator while waiting for employer auto-reply
  useEffect(() => {
    if (!active) { setTyping(false); return }
    const msgs = active.messages
    if (!msgs.length) { setTyping(false); return }
    setTyping(msgs[msgs.length - 1].from === 'seeker')
  }, [active?.messages.length])

  // Mark thread read when it becomes active or gets new messages
  useEffect(() => {
    if (activeId) markReadBySeeker(activeId)
  }, [activeId, active?.messages.length])

  const handleSelectThread = (jobId: string) => {
    setActiveId(jobId)
    markReadBySeeker(jobId)
  }

  const send = async () => {
    if (!active || !draft.trim()) return
    const body = draft
    setDraft('')
    textareaRef.current?.focus()
    await appendSeekerMessage(
      {
        id: active.jobId,
        title: active.jobTitle,
        company: active.company,
        employerPhone: active.employerPhone ?? '',
      },
      body,
      user?.name,
    )
    loadThreads().then(setThreads)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  if (threads.length === 0) {
    return (
      <div className="profile-card messages-inbox messages-inbox--empty">
        <p className="empty-state empty-state--inline">
          Chưa có cuộc trò chuyện. Mở một tin tuyển dụng và chọn «Nhắn tin nhà tuyển dụng».
        </p>
      </div>
    )
  }

  return (
    <div className="profile-card messages-inbox">
      <div className="messages-inbox__layout">
        {/* Thread list */}
        <ul className="messages-inbox__list">
          {threads.map((t) => (
            <li key={t.jobId}>
              <button
                type="button"
                className={`messages-inbox__thread${t.jobId === activeId ? ' messages-inbox__thread--active' : ''}`}
                onClick={() => handleSelectThread(t.jobId)}
              >
                <span className="messages-inbox__thread-top">
                  <span className="messages-inbox__thread-title">{t.jobTitle}</span>
                  {t.unreadBySeeker && (
                    <span className="messages-inbox__unread-dot" aria-label="Tin nhắn mới" />
                  )}
                </span>
                <span className="messages-inbox__thread-meta">{t.company}</span>
              </button>
            </li>
          ))}
        </ul>

        {/* Conversation panel */}
        {active ? (
          <div className="messages-inbox__panel">
            <div className="messages-inbox__panel-head">
              <h3 className="messages-inbox__panel-title">{active.jobTitle}</h3>
              <Link to={`/viec-lam/${active.jobId}`} className="text-link">
                Xem tin
              </Link>
            </div>

            <div className="messages-inbox__stream">
              {active.messages.map((m) => (
                <div
                  key={m.id}
                  className={`messages-inbox__bubble messages-inbox__bubble--${m.from}`}
                >
                  <span className="messages-inbox__bubble-sender">
                    {m.from === 'seeker' ? 'Bạn' : active.company}
                  </span>
                  <p>{m.body}</p>
                  <time dateTime={m.sentAt}>{formatTime(m.sentAt)}</time>
                </div>
              ))}

              {typing && (
                <div className="messages-inbox__typing" aria-label="Đang nhập...">
                  <span />
                  <span />
                  <span />
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            <div className="messages-inbox__composer">
              <textarea
                ref={textareaRef}
                className="field__input field__textarea messages-inbox__input"
                rows={2}
                placeholder="Nhập tin nhắn... (Enter gửi, Shift+Enter xuống dòng)"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKeyDown}
              />
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={send}
                disabled={!draft.trim()}
              >
                Gửi
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
