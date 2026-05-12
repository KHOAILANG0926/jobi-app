import { useEffect, useRef, useState } from 'react'
import { useNotifications } from '../context/NotificationContext'

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'Vừa xong'
  if (m < 60) return `${m} phút trước`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} giờ trước`
  const d = Math.floor(h / 24)
  return `${d} ngày trước`
}

export function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead, clearAll } = useNotifications()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="notif-bell" ref={rootRef}>
      <button
        className="notif-bell__btn"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Thông báo${unreadCount > 0 ? ` — ${unreadCount} chưa đọc` : ''}`}
        aria-expanded={open}
      >
        <svg
          className="notif-bell__icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="notif-bell__badge" aria-hidden="true">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="notif-panel" role="dialog" aria-label="Thông báo">
          <div className="notif-panel__header">
            <span className="notif-panel__title">Thông báo</span>
            <div className="notif-panel__actions">
              {unreadCount > 0 && (
                <button className="notif-panel__action-btn" onClick={markAllRead}>
                  Đọc tất cả
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  className="notif-panel__action-btn notif-panel__action-btn--muted"
                  onClick={clearAll}
                >
                  Xóa tất cả
                </button>
              )}
            </div>
          </div>

          <ul className="notif-panel__list" role="list">
            {notifications.length === 0 ? (
              <li className="notif-panel__empty">Không có thông báo nào</li>
            ) : (
              notifications.map((n) => (
                <li
                  key={n.id}
                  className={`notif-item${n.read ? '' : ' notif-item--unread'}`}
                  role="listitem"
                  onClick={() => !n.read && markRead(n.id)}
                >
                  <span className="notif-item__icon" aria-hidden="true">
                    {n.type === 'deadline' ? '⏰' : '📋'}
                  </span>
                  <div className="notif-item__body">
                    <p className="notif-item__title">{n.title}</p>
                    <p className="notif-item__text">{n.body}</p>
                    <p className="notif-item__time">{relativeTime(n.createdAt)}</p>
                  </div>
                  {!n.read && <span className="notif-item__dot" aria-hidden="true" />}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
