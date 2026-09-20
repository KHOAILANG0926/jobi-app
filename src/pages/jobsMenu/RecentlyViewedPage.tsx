import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import JobsListToolbar from '../../components/JobsListToolbar'
import JobsTable, { type JobsTableRow } from '../../components/JobsTable'
import { useJobs } from '../../context/JobsContext'
import { clearViewHistory, loadViewHistory, removeFromViewHistory, type ViewHistoryEntry } from '../../lib/viewHistoryStorage'
import { loadJobsViewMode, matchesDateRange, saveJobsViewMode, type DateRangeFilter, type JobsViewMode } from '../../lib/jobsListView'
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
 *
 * 2026-09-20 사용자 지시(알바몬 표 뷰를 "Việc làm của tôi" 4곳에 전부 적용) —
 * 표 뷰(JobsTable) + 체크박스 다중선택 삭제 추가. "등록일" 필터는 공고 자체의
 * 게시일(job.postedAt) 기준이고, 표의 마지막 열(언제 봤는지)과는 별개 축이다
 * — 혼동하지 않도록 열 이름을 "Đã xem lúc"으로 명확히 구분한다.
 */
export default function RecentlyViewedPage() {
  const { jobs } = useJobs()
  const [history, setHistory] = useState<ViewHistoryEntry[]>(() => loadViewHistory())

  const [view, setView] = useState<JobsViewMode>(() => loadJobsViewMode())
  const [dateRange, setDateRange] = useState<DateRangeFilter>('all')
  const [pageSize, setPageSize] = useState<number>(20)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const handleViewChange = (v: JobsViewMode) => { setView(v); saveJobsViewMode(v) }

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

  const filteredRows = useMemo(
    () => rows.filter(({ job }) => matchesDateRange(job?.postedAt, dateRange)),
    [rows, dateRange],
  )
  const visibleRows = filteredRows.slice(0, pageSize)

  const handleRemove = (id: string) => {
    removeFromViewHistory(id)
    setHistory(loadViewHistory())
    setSelectedIds((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  const handleClearAll = () => {
    clearViewHistory()
    setHistory([])
    setSelectedIds(new Set())
  }

  const handleDeleteSelected = () => {
    for (const id of selectedIds) removeFromViewHistory(id)
    setHistory(loadViewHistory())
    setSelectedIds(new Set())
  }

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const tableRows: JobsTableRow[] = visibleRows.map(({ entry, job }) =>
    job
      ? {
          id: entry.id,
          href: `/viec-lam/${job.id}`,
          region: job.location,
          title: job.title,
          company: job.company,
          salary: job.salary,
          hours: job.hours,
          dateLabel: `Đã xem: ${formatViewedAt(entry.viewedAt)}`,
        }
      : {
          id: entry.id,
          title: 'Tin đã gỡ hoặc ngừng đăng',
          dateLabel: `Đã xem: ${formatViewedAt(entry.viewedAt)}`,
        },
  )

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
          <JobsListToolbar
            count={filteredRows.length}
            countLabel="tin đã xem"
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            view={view}
            onViewChange={handleViewChange}
            selectedCount={selectedIds.size}
            onDeleteSelected={handleDeleteSelected}
          />
          <div className="jm-recent-toolbar">
            {visibleRows.length > 0 && (
              <label className="jm-select-all-row">
                <input
                  type="checkbox"
                  checked={visibleRows.every(({ entry }) => selectedIds.has(entry.id))}
                  onChange={() => {
                    const ids = visibleRows.map(({ entry }) => entry.id)
                    const allSelected = ids.every((id) => selectedIds.has(id))
                    setSelectedIds(allSelected ? new Set() : new Set(ids))
                  }}
                />
                Chọn tất cả
              </label>
            )}
            <button type="button" className="jm-recent-toolbar__clear" onClick={handleClearAll}>
              Xóa tất cả
            </button>
          </div>
          {view === 'table' ? (
            <JobsTable
              rows={tableRows}
              dateColumnLabel="Đã xem lúc"
              selectable
              selectedIds={selectedIds}
              onToggleRow={toggleRow}
            />
          ) : (
            <ul className="saved-list">
              {visibleRows.map(({ entry, job }) => (
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
          )}
        </>
      )}
    </div>
  )
}
