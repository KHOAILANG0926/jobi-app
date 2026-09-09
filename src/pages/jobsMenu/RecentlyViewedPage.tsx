import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useJobs } from '../../context/JobsContext'
import { clearViewHistory, loadViewHistory, removeFromViewHistory, type ViewHistoryEntry } from '../../lib/viewHistoryStorage'
import type { Job } from '../../types/job'

function formatViewedAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}

/**
 * 최근 본 공고 — 상세페이지를 실제로 연 기록만 표시한다(viewHistoryStorage.ts,
 * JobDetail.tsx에서 기록). 이 브라우저에만 30일·최대 100건 보관되며, 계정
 * 서버 동기화는 없다 — 그 사실을 화면에 그대로 안내한다.
 */
export default function RecentlyViewedPage() {
  const { jobs } = useJobs()
  const [history, setHistory] = useState<ViewHistoryEntry[]>(() => loadViewHistory())

  useEffect(() => {
    const sync = () => setHistory(loadViewHistory())
    sync()
    window.addEventListener('vgb:view-history', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('vgb:view-history', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const rows = useMemo(() => {
    return history.map((entry) => ({
      entry,
      job: jobs.find((j) => j.id === entry.id) as Job | undefined,
    }))
  }, [history, jobs])

  const handleRemove = (id: string) => {
    removeFromViewHistory(id)
    setHistory(loadViewHistory())
  }

  const handleClearAll = () => {
    clearViewHistory()
    setHistory([])
  }

  return (
    <div className="page jobs-menu-page">
      <header className="page-header">
        <h1 className="page-header__title">Việc làm đã xem</h1>
        <p className="page-header__lead">
          Lưu tối đa 100 tin gần nhất trong 30 ngày, chỉ trên trình duyệt này — không đồng bộ giữa các thiết bị.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="city-result__empty">
          <span>🕘</span>
          <p>Bạn chưa xem tin tuyển dụng nào gần đây.</p>
          <NavLink to="/">← Xem việc làm</NavLink>
        </div>
      ) : (
        <>
          <div className="jm-recent-toolbar">
            <span className="jm-result-count">{rows.length} tin đã xem</span>
            <button type="button" className="jm-recent-toolbar__clear" onClick={handleClearAll}>
              Xóa tất cả
            </button>
          </div>
          <ul className="saved-list">
            {rows.map(({ entry, job }) => (
              <li key={entry.id} className="saved-list__item">
                {job ? (
                  <Link to={`/viec-lam/${job.id}`} className="saved-list__link">
                    <span className="saved-list__title">{job.title}</span>
                    <span className="saved-list__meta">{job.company} · {job.location}</span>
                    <span className="saved-list__meta">Đã xem: {formatViewedAt(entry.viewedAt)}</span>
                  </Link>
                ) : (
                  <span className="saved-list__link">
                    <span className="saved-list__title">Tin đã gỡ hoặc ngừng đăng</span>
                    <span className="saved-list__meta">Đã xem: {formatViewedAt(entry.viewedAt)}</span>
                  </span>
                )}
                <button
                  type="button"
                  className="saved-list__remove"
                  aria-label="Xóa khỏi lịch sử"
                  onClick={() => handleRemove(entry.id)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
