import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import JobsListToolbar from '../../components/JobsListToolbar'
import JobsStatusTabs, { type JobsStatusFilter } from '../../components/JobsStatusTabs'
import JobsTable, { type JobsTableRow } from '../../components/JobsTable'
import { useAuth } from '../../context/AuthContext'
import { useJobs } from '../../context/JobsContext'
import { loadSavedJobIds, toggleSavedJobId } from '../../lib/storage'
import { formatDeadlineVi } from '../../lib/jobUtils'
import { fetchKoreaJobs } from '../../lib/koreaJobsApi'
import { formatKoreaSalary, koreaJobDisplayLocation, koreaJobDisplayTitle, koreaSavedId, parseKoreaSavedId } from '../../lib/koreaJobFormat'
import { loadJobsViewMode, matchesDateRange, saveJobsViewMode, type DateRangeFilter, type JobsViewMode } from '../../lib/jobsListView'
import type { Job } from '../../types/job'
import type { KoreaJob } from '../../types/koreaJob'

function formatShortDate(iso: string | null | undefined) {
  if (!iso) return undefined
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return undefined
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

type SortValue = 'saved' | 'posted'
const SORT_OPTIONS = [
  { value: 'saved', label: 'Lưu gần đây nhất' },
  { value: 'posted', label: 'Đăng gần đây nhất' },
]

interface SavedRow {
  key: string
  status: 'open' | 'closed'
  postedAt?: string
  savedIndex: number
  tableRow: JobsTableRow
}

/**
 * 저장한 공고 — storage.ts의 계정별 scope(사용자 로그인 시 user.id, 아니면
 * 게스트 전역 키)로 분리된 저장 목록을 읽는다. jobs(useJobs())에 없는 id는
 * 공고가 내려갔거나 비활성화된 것으로 간주해 "Đã hết hạn" 탭에 포함한다.
 * 기기 간 동기화는 지원하지 않는다 — 이 브라우저(로그인 시 이 브라우저의
 * 이 계정)에만 저장됨.
 *
 * korea_jobs 저장분("kr-" 접두사, koreaJobFormat.ts 참고)은 local_jobs와
 * id 시퀀스가 겹칠 수 있어 별도로 구분해 읽지만, 화면에는 로컬/한국 구분
 * 없이 하나의 표에 섞어 보여준다(2026-09-20 두 번째 라운드 — 알바몬 "최근
 * 본 알바" 캡처 재지적: "섹션을 쌓지 말고 탭 하나로 표 전체를 필터링하는
 * 구조여야 한다"). 상태 탭(Tất cả/Đang tuyển/Đã hết hạn)이 그 구분을 대신한다.
 */
export default function SavedJobsPage() {
  const { user } = useAuth()
  const { jobs } = useJobs()
  const [savedIds, setSavedIds] = useState<string[]>(() => loadSavedJobIds(user?.id))
  const [koreaJobs, setKoreaJobs] = useState<KoreaJob[]>([])
  // fetchKoreaJobs()가 끝나기 전엔 koreaJobs가 빈 배열이라, 로딩 가드 없이
  // 바로 "찾음/삭제됨"을 가르면 저장된 공고가 실제로는 있는데도 fetch가
  // 끝나기 전 순간에 "삭제됨"으로 잘못 보이는 깜빡임이 생긴다(실제로 발견 —
  // 배포 직후 실사이트에서 저장 직후 새 탭으로 이동하면 재현됨).
  const [koreaLoading, setKoreaLoading] = useState(false)

  const [view, setView] = useState<JobsViewMode>(() => loadJobsViewMode())
  const [statusTab, setStatusTab] = useState<JobsStatusFilter>('all')
  const [dateRange, setDateRange] = useState<DateRangeFilter>('all')
  const [sortValue, setSortValue] = useState<SortValue>('saved')
  const [pageSize, setPageSize] = useState<number>(20)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const handleViewChange = (v: JobsViewMode) => { setView(v); saveJobsViewMode(v) }

  useEffect(() => {
    const sync = () => setSavedIds(loadSavedJobIds(user?.id))
    sync()
    window.addEventListener('vgb:saved-jobs', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('vgb:saved-jobs', sync)
      window.removeEventListener('storage', sync)
    }
  }, [user?.id])

  const localIds = useMemo(() => savedIds.filter((id) => parseKoreaSavedId(id) === null), [savedIds])
  const koreaSavedIds = useMemo(
    () => savedIds.map((id) => ({ raw: id, numericId: parseKoreaSavedId(id) })).filter((x) => x.numericId !== null),
    [savedIds],
  )

  useEffect(() => {
    if (koreaSavedIds.length === 0) { setKoreaJobs([]); setKoreaLoading(false); return }
    let cancelled = false
    setKoreaLoading(true)
    fetchKoreaJobs().then((data) => {
      if (cancelled) return
      setKoreaJobs(data)
      setKoreaLoading(false)
    })
    return () => { cancelled = true }
  }, [koreaSavedIds.length])

  const { resolved, missingIds } = useMemo(() => {
    const found: Job[] = []
    const missing: string[] = []
    for (const id of localIds) {
      const j = jobs.find((job) => job.id === id)
      if (j) found.push(j)
      else missing.push(id)
    }
    return { resolved: found, missingIds: missing }
  }, [localIds, jobs])

  const { koreaResolved, koreaMissingIds } = useMemo(() => {
    const found: KoreaJob[] = []
    const missing: string[] = []
    for (const { raw, numericId } of koreaSavedIds) {
      const j = koreaJobs.find((job) => job.id === numericId)
      if (j) found.push(j)
      else missing.push(raw)
    }
    return { koreaResolved: found, koreaMissingIds: missing }
  }, [koreaSavedIds, koreaJobs])

  const todayStr = new Date().toISOString().slice(0, 10)

  const handleUnsave = (id: string) => {
    toggleSavedJobId(id, user?.id)
    setSavedIds(loadSavedJobIds(user?.id))
    setSelectedIds((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  // 저장 목록 전체를 지역/공고 출처 구분 없이 상태 탭 하나로 합쳐 다루기
  // 위한 통합 행 — 한국 채용/삭제된 공고까지 전부 여기서 한 배열로 모인다.
  const combinedRows = useMemo<SavedRow[]>(() => {
    const rows: SavedRow[] = []
    for (const job of resolved) {
      const isOpen = !job.applicationDeadline || job.applicationDeadline >= todayStr
      rows.push({
        key: job.id,
        status: isOpen ? 'open' : 'closed',
        postedAt: job.postedAt,
        savedIndex: savedIds.indexOf(job.id),
        tableRow: {
          id: job.id,
          href: `/viec-lam/${job.id}`,
          region: job.location,
          title: job.title,
          company: job.company,
          salary: job.salary,
          hours: job.hours,
          dateLabel: isOpen ? formatShortDate(job.postedAt) : `Hạn nộp: ${formatDeadlineVi(job.applicationDeadline)}`,
        },
      })
    }
    for (const id of missingIds) {
      rows.push({
        key: id,
        status: 'closed',
        savedIndex: savedIds.indexOf(id),
        tableRow: { id, title: 'Tin đã gỡ hoặc ngừng đăng' },
      })
    }
    for (const job of koreaResolved) {
      const isOpen = !job.deadline || job.deadline >= todayStr
      const sid = koreaSavedId(job.id)
      rows.push({
        key: sid,
        status: isOpen ? 'open' : 'closed',
        postedAt: job.posted_at ?? undefined,
        savedIndex: savedIds.indexOf(sid),
        tableRow: {
          id: sid,
          href: `/viec-han-quoc/${job.id}`,
          region: koreaJobDisplayLocation(job) ?? undefined,
          title: koreaJobDisplayTitle(job) ?? '',
          company: job.company ?? undefined,
          salary: formatKoreaSalary(job) || 'Thỏa thuận',
          hours: job.working_hours ?? undefined,
          dateLabel: isOpen ? formatShortDate(job.posted_at) : job.deadline ? `Hạn nộp: ${formatShortDate(job.deadline)}` : undefined,
        },
      })
    }
    for (const id of koreaMissingIds) {
      rows.push({
        key: id,
        status: 'closed',
        savedIndex: savedIds.indexOf(id),
        tableRow: { id, title: 'Tin đã gỡ hoặc hết hạn' },
      })
    }
    return rows
  }, [resolved, missingIds, koreaResolved, koreaMissingIds, savedIds, todayStr])

  const filteredRows = useMemo(() => {
    return combinedRows
      .filter((r) => statusTab === 'all' || r.status === statusTab)
      .filter((r) => matchesDateRange(r.postedAt, dateRange))
  }, [combinedRows, statusTab, dateRange])

  const sortedRows = useMemo(() => {
    const list = [...filteredRows]
    if (sortValue === 'posted') {
      list.sort((a, b) => (b.postedAt ?? '').localeCompare(a.postedAt ?? ''))
    } else {
      list.sort((a, b) => b.savedIndex - a.savedIndex)
    }
    return list
  }, [filteredRows, sortValue])

  const visibleRows = sortedRows.slice(0, pageSize)

  const handleDeleteSelected = () => {
    for (const id of selectedIds) toggleSavedJobId(id, user?.id)
    setSavedIds(loadSavedJobIds(user?.id))
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

  const visibleIds = visibleRows.map((r) => r.key)
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
        <h1 className="page-header__title">Việc làm đã lưu</h1>
        <p className="page-header__lead">
          {user
            ? 'Danh sách này chỉ hiển thị trên trình duyệt này khi bạn đăng nhập tài khoản hiện tại — chưa đồng bộ giữa các thiết bị.'
            : 'Bạn đang xem với tư cách khách — danh sách lưu chỉ tồn tại trên trình duyệt này. Đăng nhập để tách riêng danh sách theo từng tài khoản.'}
        </p>
      </header>

      {combinedRows.length === 0 ? (
        <div className="city-result__empty">
          <span>🔖</span>
          <p>Chưa có tin nào được lưu.</p>
          <NavLink to="/">← Xem việc làm</NavLink>
        </div>
      ) : (
        <>
          <JobsStatusTabs value={statusTab} onChange={setStatusTab} />
          <JobsListToolbar
            count={filteredRows.length}
            countLabel="tin đã lưu"
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
          {koreaLoading && <p className="empty-state empty-state--inline">Đang tải việc làm Hàn Quốc...</p>}

          {visibleRows.length === 0 ? (
            <div className="city-result__empty">
              <span>🔍</span>
              <p>Không có tin nào phù hợp với bộ lọc hiện tại.</p>
            </div>
          ) : view === 'table' ? (
            <JobsTable
              rows={visibleRows.map((r) => r.tableRow)}
              dateColumnLabel="Ngày đăng"
              selectable
              selectedIds={selectedIds}
              onToggleRow={toggleRow}
              onToggleAll={toggleAllVisible}
              allSelected={allVisibleSelected}
            />
          ) : (
            <ul className="saved-list">
              {visibleRows.map(({ tableRow }) => (
                <li key={tableRow.id} className="saved-list__item">
                  {tableRow.href ? (
                    <Link to={tableRow.href} className="saved-list__link">
                      <span className="saved-list__title">{tableRow.title}</span>
                      <span className="saved-list__meta">{tableRow.company} · {tableRow.region}</span>
                      <span className="saved-list__meta">{tableRow.salary || tableRow.dateLabel}</span>
                    </Link>
                  ) : (
                    <span className="saved-list__link">
                      <span className="saved-list__title">{tableRow.title}</span>
                      <span className="saved-list__meta">Mã tin: {tableRow.id}</span>
                    </span>
                  )}
                  <button
                    type="button"
                    className="saved-list__remove"
                    aria-label={`Bỏ lưu: ${tableRow.title}`}
                    onClick={() => handleUnsave(tableRow.id)}
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
