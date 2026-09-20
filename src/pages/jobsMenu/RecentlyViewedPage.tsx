import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import JobsListToolbar from '../../components/JobsListToolbar'
import JobsStatusTabs, { type JobsStatusFilter } from '../../components/JobsStatusTabs'
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

type SortValue = 'viewed' | 'posted'
const SORT_OPTIONS = [
  { value: 'viewed', label: 'Xem gần đây nhất' },
  { value: 'posted', label: 'Đăng gần đây nhất' },
]

interface HistoryRow {
  entry: ViewHistoryEntry
  job: Job | undefined
  status: 'open' | 'closed'
  tableRow: JobsTableRow
}

/**
 * 최근 본 공고 — 상세페이지를 실제로 연 기록만 표시한다(viewHistoryStorage.ts,
 * JobDetail.tsx에서 기록). 이 브라우저에만 30일·최대 100건 보관되며, 계정
 * 서버 동기화는 없다 — 그 사실을 화면에 그대로 안내한다.
 *
 * 2026-09-20 두 번째 라운드(알바몬 "최근 본 알바" 캡처 재지적 — "이렇게
 * 만들어 달라니까.... 구성을") — 1차 버전은 표 뷰만 추가하고 상태 구분은
 * 안 했는데, 알바몬은 표 하나를 상태 탭(전체/게재중/마감)으로 필터링하는
 * 구조였다. 탭 + "최근본순"/"등록일" 정렬 드롭다운을 추가한다.
 */
export default function RecentlyViewedPage() {
  const { jobs } = useJobs()
  const [history, setHistory] = useState<ViewHistoryEntry[]>(() => loadViewHistory())

  const [view, setView] = useState<JobsViewMode>(() => loadJobsViewMode())
  const [statusTab, setStatusTab] = useState<JobsStatusFilter>('all')
  const [dateRange, setDateRange] = useState<DateRangeFilter>('all')
  const [sortValue, setSortValue] = useState<SortValue>('viewed')
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

  const todayStr = new Date().toISOString().slice(0, 10)

  const combinedRows = useMemo<HistoryRow[]>(() => {
    return history.map((entry) => {
      const job = jobs.find((j) => j.id === entry.id)
      const isOpen = !!job && (!job.applicationDeadline || job.applicationDeadline >= todayStr)
      return {
        entry,
        job,
        status: isOpen ? 'open' : 'closed',
        tableRow: job
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
      }
    })
  }, [history, jobs, todayStr])

  const filteredRows = useMemo(() => {
    return combinedRows
      .filter((r) => statusTab === 'all' || r.status === statusTab)
      .filter((r) => matchesDateRange(r.job?.postedAt, dateRange))
  }, [combinedRows, statusTab, dateRange])

  const sortedRows = useMemo(() => {
    const list = [...filteredRows]
    if (sortValue === 'posted') {
      list.sort((a, b) => (b.job?.postedAt ?? '').localeCompare(a.job?.postedAt ?? ''))
    } else {
      list.sort((a, b) => b.entry.viewedAt.localeCompare(a.entry.viewedAt))
    }
    return list
  }, [filteredRows, sortValue])

  const visibleRows = sortedRows.slice(0, pageSize)

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

  const visibleIds = visibleRows.map((r) => r.entry.id)
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id))
  const toggleAllVisible = () => {
    setSelectedIds((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev)
        for (const id of visibleIds) next.delete(id)
        return next
      }
      return new Set([...prev, ...visibleIds])
    })
  }

  return (
    <div className="page jobs-menu-page">
      <header className="page-header">
        <h1 className="page-header__title">Việc làm đã xem</h1>
        <p className="page-header__lead">
          Lưu tối đa 100 tin gần nhất trong 30 ngày, chỉ trên trình duyệt này — không đồng bộ giữa các thiết bị.
        </p>
      </header>

      {combinedRows.length === 0 ? (
        <div className="city-result__empty">
          <span>🕘</span>
          <p>Bạn chưa xem tin tuyển dụng nào gần đây.</p>
          <NavLink to="/">← Xem việc làm</NavLink>
        </div>
      ) : (
        <>
          <JobsStatusTabs value={statusTab} onChange={setStatusTab} />
          <JobsListToolbar
            count={filteredRows.length}
            countLabel="tin đã xem"
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            sortOptions={SORT_OPTIONS}
            sortValue={sortValue}
            onSortChange={(v) => setSortValue(v as SortValue)}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            view={view}
            onViewChange={handleViewChange}
            selectedCount={selectedIds.size}
            onDeleteSelected={handleDeleteSelected}
          />
          <div className="jm-recent-toolbar">
            <button type="button" className="jm-recent-toolbar__clear" onClick={handleClearAll}>
              Xóa tất cả lịch sử
            </button>
          </div>

          {visibleRows.length === 0 ? (
            <div className="city-result__empty">
              <span>🔍</span>
              <p>Không có tin nào phù hợp với bộ lọc hiện tại.</p>
            </div>
          ) : view === 'table' ? (
            <JobsTable
              rows={visibleRows.map((r) => r.tableRow)}
              dateColumnLabel="Đã xem lúc"
              selectable
              selectedIds={selectedIds}
              onToggleRow={toggleRow}
              onToggleAll={toggleAllVisible}
              allSelected={allVisibleSelected}
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
