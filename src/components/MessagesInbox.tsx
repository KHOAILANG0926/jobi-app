import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  appendSeekerMessage,
  loadThreads,
  subscribeMessages,
  type MessageThread,
} from '../lib/messagesStorage'

export function MessagesInbox() {
  const [threads, setThreads] = useState<MessageThread[]>(() => loadThreads())
  const [activeId, setActiveId] = useState<string | null>(() => loadThreads()[0]?.jobId ?? null)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    const sync = () => {
      const next = loadThreads()
      setThreads(next)
      setActiveId((cur) => {
        if (cur && next.some((t) => t.jobId === cur)) return cur
        return next[0]?.jobId ?? null
      })
    }
    sync()
    return subscribeMessages(sync)
  }, [])

  const active = useMemo(
    () => threads.find((t) => t.jobId === activeId) ?? null,
    [threads, activeId],
  )

  const send = () => {
    if (!active || !draft.trim()) return
    appendSeekerMessage(
      {
        id: active.jobId,
        title: active.jobTitle,
        company: active.company,
        employerPhone: active.employerPhone ?? '',
      },
      draft,
    )
    setDraft('')
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
        <ul className="messages-inbox__list">
          {threads.map((t) => (
            <li key={t.jobId}>
              <button
                type="button"
                className={`messages-inbox__thread${t.jobId === activeId ? ' messages-inbox__thread--active' : ''}`}
                onClick={() => setActiveId(t.jobId)}
              >
                <span className="messages-inbox__thread-title">{t.jobTitle}</span>
                <span className="messages-inbox__thread-meta">{t.company}</span>
              </button>
            </li>
          ))}
        </ul>
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
                  <p>{m.body}</p>
                  <time dateTime={m.sentAt}>
                    {new Date(m.sentAt).toLocaleString('vi-VN', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                </div>
              ))}
            </div>
            <div className="messages-inbox__composer">
              <textarea
                className="field__input field__textarea messages-inbox__input"
                rows={2}
                placeholder="Nhập tin nhắn..."
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <button type="button" className="btn btn--primary btn--sm" onClick={send}>
                Gửi
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
