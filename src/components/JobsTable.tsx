import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

// 2026-09-20 사용자 지시(알바몬 "찜한 공고함" 캡처 — "이렇게 표기해줘",
// "스타일은 알바몬하고 최대한 동일하게") — UrgentJobsPage.tsx가 이미 쓰고
// 있던 .jm-urgent-table* 표 스타일(지역/제목+기업명/급여/근무시간/등록일
// 열, 알바몬 톤)을 그대로 재사용해 "Việc làm của tôi" 4개 페이지에서도
// 공유하는 표 렌더러. 새 CSS 패턴을 발명하지 않고 기존 표 스타일을 확장.

export interface JobsTableRow {
  id: string
  /** 내부 링크(상세페이지). 없으면 내려갔거나 참조할 상세가 없는 공고
   *  (예: 저장했지만 지금은 목록에 없는 공고) — 링크 없이 제목만 보여준다. */
  href?: string
  region?: string
  title: string
  company?: string
  salary?: string
  hours?: string
  /** 이미 포맷된 날짜 문자열 — 페이지마다 의미가 달라서("등록일" vs "đã xem
   *  lúc") 호출 쪽에서 직접 포맷해 넘긴다. */
  dateLabel?: string
  badge?: string
  externalUrl?: string
  /** 마지막 열(지원 버튼/저장 별 등) — showTrailingColumn이 true일 때만 렌더. */
  trailing?: ReactNode
}

interface JobsTableProps {
  rows: JobsTableRow[]
  dateColumnLabel: string
  selectable?: boolean
  selectedIds?: Set<string>
  onToggleRow?: (id: string) => void
  onToggleAll?: () => void
  allSelected?: boolean
  showTrailingColumn?: boolean
}

export default function JobsTable({
  rows,
  dateColumnLabel,
  selectable,
  selectedIds,
  onToggleRow,
  onToggleAll,
  allSelected,
  showTrailingColumn,
}: JobsTableProps) {
  return (
    <div className="admin-table-wrap jm-urgent-table-wrap">
      <table className="admin-table jm-urgent-table">
        <thead>
          <tr>
            {selectable && (
              <th>
                {onToggleAll && (
                  <input
                    type="checkbox"
                    checked={!!allSelected}
                    onChange={onToggleAll}
                    aria-label="Chọn tất cả"
                  />
                )}
              </th>
            )}
            <th>Khu vực</th>
            <th>Tin tuyển dụng</th>
            <th>Lương</th>
            <th>Thời gian làm việc</th>
            <th>{dateColumnLabel}</th>
            {showTrailingColumn && <th aria-label="Thao tác" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {selectable && (
                <td>
                  <input
                    type="checkbox"
                    checked={selectedIds?.has(row.id) ?? false}
                    onChange={() => onToggleRow?.(row.id)}
                    aria-label={`Chọn: ${row.title}`}
                  />
                </td>
              )}
              <td className="jm-urgent-table__region">{row.region || '—'}</td>
              <td>
                {row.badge && <span className="jm-urgent-table__badge">{row.badge}</span>}
                {row.href ? (
                  <NavLink to={row.href} className="jm-urgent-table__title">
                    {row.title}
                  </NavLink>
                ) : (
                  <span className="jm-urgent-table__title jm-urgent-table__title--muted">{row.title}</span>
                )}
                {row.company && <p className="jm-urgent-table__company">{row.company}</p>}
              </td>
              <td className="jm-urgent-table__salary">{row.salary || '—'}</td>
              <td>{row.hours || '—'}</td>
              <td>
                {row.dateLabel || '—'}
                {row.externalUrl && (
                  <a
                    href={row.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="jm-urgent-table__external"
                    aria-label="Xem tin gốc"
                    title="Xem tin gốc"
                  >
                    ↗
                  </a>
                )}
              </td>
              {showTrailingColumn && <td>{row.trailing}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
