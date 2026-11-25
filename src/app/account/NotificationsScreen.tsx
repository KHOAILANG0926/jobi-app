import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useNotifications } from '../../context/NotificationContext'
import { timeAgo } from '../community/communityView'

const TYPE_LABEL: Record<string, string> = { deadline: 'Sắp hết hạn', status_change: 'Trạng thái ứng tuyển', job_match: 'Tin phù hợp' }

// 알림 — 웹 알림 벨과 같은 자료(NotificationContext: 마감 임박·지원 상태 변화·서버 맞춤 알림)·같은 읽음/비우기 동작.
export default function NotificationsScreen() {
  const { notifications, unreadCount, markRead, markAllRead, clearAll } = useNotifications()
  const navigate = useNavigate()
  return (
    <div className="app-page" data-testid="app-notifications">
      <header className="app-pagebar"><button type="button" className="app-icon-btn" aria-label="Quay lại" onClick={() => navigate(-1)}><ChevronLeft size={24} aria-hidden /></button><h1 className="app-pagebar__title">Thông báo{unreadCount > 0 ? ` (${unreadCount})` : ''}</h1></header>
      {notifications.length === 0 ? <p className="app-state">Chưa có thông báo.</p> : (
        <>
          <div className="app-notif__bar"><button type="button" className="app-link-btn" disabled={unreadCount === 0} onClick={markAllRead}>Đánh dấu đã đọc</button><button type="button" className="app-link-btn" onClick={() => { if (window.confirm('Xoá tất cả thông báo?')) clearAll() }}>Xoá tất cả</button></div>
          <ul className="app-applist">
            {notifications.map((n) => (
              <li key={n.id} className={'app-notif' + (n.read ? '' : ' app-notif--unread')}>
                <Link to={`/viec-lam/${n.jobId}`} onClick={() => markRead(n.id)}>
                  <small>{TYPE_LABEL[n.type] ?? ''} · {timeAgo(n.createdAt)}</small><strong>{n.title}</strong><span>{n.body}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
