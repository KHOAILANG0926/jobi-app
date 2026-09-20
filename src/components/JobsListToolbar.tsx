import { LayoutGrid, List } from 'lucide-react'
import type { DateRangeFilter, JobsViewMode } from '../lib/jobsListView'

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const
export const SHOW_ALL_PAGE_SIZE = Number.MAX_SAFE_INTEGER

interface JobsListToolbarProps {
  count: number
  countLabel: string
  dateRange: DateRangeFilter
  onDateRangeChange: (v: DateRangeFilter) => void
  pageSize: number
  onPageSizeChange: (v: number) => void
  view: JobsViewMode
  onViewChange: (v: JobsViewMode) => void
  /** 넘기면(저장한 공고/최근 본 공고) 선택 삭제 버튼도 같이 보여준다 —
   *  맞춤/추천 공고는 저장된 목록이 아니라 조건으로 매번 계산되는 결과라
   *  "삭제"할 대상 자체가 없으므로 이 prop을 안 넘긴다. */
  selectedCount?: number
  onDeleteSelected?: () => void
}

export default function JobsListToolbar({
  count,
  countLabel,
  dateRange,
  onDateRangeChange,
  pageSize,
  onPageSizeChange,
  view,
  onViewChange,
  selectedCount,
  onDeleteSelected,
}: JobsListToolbarProps) {
  return (
    <div className="jm-urgent-toolbar">
      <p className="jm-result-count">
        Tổng {count} {countLabel}
      </p>
      <div className="jm-urgent-toolbar__controls">
        <select
          className="jm-urgent-toolbar__select"
          value={dateRange}
          onChange={(e) => onDateRangeChange(e.target.value as DateRangeFilter)}
          aria-label="Lọc theo ngày đăng"
        >
          <option value="all">Ngày đăng: Tất cả</option>
          <option value="today">Hôm nay</option>
          <option value="7d">7 ngày qua</option>
          <option value="30d">30 ngày qua</option>
        </select>
        <select
          className="jm-urgent-toolbar__select"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          aria-label="Số lượng hiển thị"
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n} tin/trang
            </option>
          ))}
          <option value={SHOW_ALL_PAGE_SIZE}>Tất cả</option>
        </select>
        <div className="jm-view-toggle" role="group" aria-label="Kiểu hiển thị">
          <button
            type="button"
            className={`jm-view-toggle__btn${view === 'grid' ? ' is-active' : ''}`}
            onClick={() => onViewChange('grid')}
            aria-label="Xem dạng lưới"
            aria-pressed={view === 'grid'}
          >
            <LayoutGrid size={16} />
          </button>
          <button
            type="button"
            className={`jm-view-toggle__btn${view === 'table' ? ' is-active' : ''}`}
            onClick={() => onViewChange('table')}
            aria-label="Xem dạng danh sách"
            aria-pressed={view === 'table'}
          >
            <List size={16} />
          </button>
        </div>
        {onDeleteSelected && (
          <button
            type="button"
            className="jm-urgent-toolbar__delete"
            disabled={!selectedCount}
            onClick={onDeleteSelected}
          >
            Xóa{selectedCount ? ` (${selectedCount})` : ''}
          </button>
        )}
      </div>
    </div>
  )
}
