import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import JobsListToolbar from '../../components/JobsListToolbar'
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

/**
 * 저장한 공고 — storage.ts의 계정별 scope(사용자 로그인 시 user.id, 아니면
 * 게스트 전역 키)로 분리된 저장 목록을 읽는다. jobs(useJobs())에 없는 id는
 * 공고가 내려갔거나 비활성화된 것으로 간주해 별도 섹션에 "삭제됨"으로 안내
 * 한다(재구현하지 않고 그대로 목록에서만 제거 가능하게 함). 기기 간 동기화는
 * 지원하지 않는다 — 이 브라우저(로그인 시 이 브라우저의 이 계정)에만 저장됨.
 *
 * korea_jobs 저장분("kr-" 접두사, koreaJobFormat.ts 참고)은 local_jobs와
 * id 시퀀스가 겹칠 수 있어 별도로 구분해 읽고, 별도 섹션(아래)에 표시한다.
 *
 * 2026-09-20 사용자 지시(알바몬 "찜한 공고함" 캡처, "이렇게 표기해줘" +
 * "여기(저장/본/맞춤/추천 4개)에 다 적용 가능해") — 표 뷰(JobsTable)를
 * 추가하고, 체크박스로 여러 건을 한 번에 선택해 삭제(=저장 해제)하는
 * 기능을 신설한다. 선택 상태는 이 페이지의 모든 구간(진행중/마감/한국/
 * 삭제된 공고)에 걸쳐 공유된다 — "저장 해제"는 어느 구간의 항목이든 같은
 * handleUnsave(id) 한 함수로 동일하게 처리되기 때문.
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
  const [dateRange, setDateRange] = useState<DateRangeFilter>('all')
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
  const allOpenJobs = resolved.filter((j) => !j.applicationDeadline || j.applicationDeadline >= todayStr)
  const closedJobs = resolved.filter((j) => j.applicationDeadline && j.applicationDeadline < todayStr)

  const openJobs = useMemo(
    () => allOpenJobs.filter((j) => matchesDateRange(j.postedAt, dateRange)).slice(0, pageSize),
    [allOpenJobs, dateRange, pageSize],
  )
  const openJobsTotal = useMemo(
    () => allOpenJobs.filter((j) => matchesDateRange(j.postedAt, dateRange)).length,
    [allOpenJobs, dateRange],
  )

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

  const jobRow = (job: Job): JobsTableRow => ({
    id: job.id,
    href: `/viec-lam/${job.id}`,
    region: job.location,
    title: job.title,
    company: job.company,
    salary: job.salary,
    hours: job.hours,
    dateLabel: formatShortDate(job.postedAt),
  })

  const koreaRow = (job: KoreaJob): JobsTableRow => ({
    id: koreaSavedId(job.id),
    href: `/viec-han-quoc/${job.id}`,
    region: koreaJobDisplayLocation(job) ?? undefined,
    title: koreaJobDisplayTitle(job) ?? '',
    company: job.company ?? undefined,
    salary: formatKoreaSalary(job) || 'Thỏa thuận',
    hours: job.working_hours ?? undefined,
    dateLabel: formatShortDate(job.posted_at),
  })

  const missingRow = (id: string, label: string): JobsTableRow => ({
    id,
    title: label,
  })

  const allSelectableIds = [
    ...allOpenJobs.map((j) => j.id),
    ...closedJobs.map((j) => j.id),
    ...koreaResolved.map((j) => koreaSavedId(j.id)),
    ...koreaMissingIds,
    ...missingIds,
  ]
  const allSelected = allSelectableIds.length > 0 && allSelectableIds.every((id) => selectedIds.has(id))
  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(allSelectableIds))
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

      {resolved.length === 0 && missingIds.length === 0 && koreaSavedIds.length === 0 ? (
        <div className="city-result__empty">
          <span>🔖</span>
          <p>Chưa có tin nào được lưu.</p>
          <NavLink to="/">← Xem việc làm</NavLink>
        </div>
      ) : (
        <>
          <JobsListToolbar
            count={openJobsTotal}
            countLabel="tin đang tuyển đã lưu"
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            view={view}
            onViewChange={handleViewChange}
            selectedCount={selectedIds.size}
            onDeleteSelected={handleDeleteSelected}
          />
          {allSelectableIds.length > 0 && (
            <label className="jm-select-all-row">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              Chọn tất cả
            </label>
          )}

          <section className="jm-saved-section">
            <h2 className="home-section__title">Đang tuyển ({openJobsTotal})</h2>
            {openJobs.length === 0 ? (
              <p className="empty-state empty-state--inline">Không có tin đang tuyển trong danh sách đã lưu.</p>
            ) : view === 'table' ? (
              <JobsTable
                rows={openJobs.map(jobRow)}
                dateColumnLabel="Ngày đăng"
                selectable
                selectedIds={selectedIds}
                onToggleRow={toggleRow}
              />
            ) : (
              <ul className="saved-list">
                {openJobs.map((job) => (
                  <li key={job.id} className="saved-list__item">
                    <Link to={`/viec-lam/${job.id}`} className="saved-list__link">
                      <span className="saved-list__title">{job.title}</span>
                      <span className="saved-list__meta">{job.company} · {job.location}</span>
                      <span className="saved-list__meta">{job.salary}</span>
                    </Link>
                    <button
                      type="button"
                      className="saved-list__remove"
                      aria-label={`Bỏ lưu: ${job.title}`}
                      onClick={() => handleUnsave(job.id)}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {closedJobs.length > 0 && (
            <section className="jm-saved-section">
              <h2 className="home-section__title">Đã hết hạn ({closedJobs.length})</h2>
              {view === 'table' ? (
                <JobsTable
                  rows={closedJobs.map((job) => ({
                    ...jobRow(job),
                    dateLabel: `Hạn nộp: ${formatDeadlineVi(job.applicationDeadline)}`,
                  }))}
                  dateColumnLabel="Hạn nộp"
                  selectable
                  selectedIds={selectedIds}
                  onToggleRow={toggleRow}
                />
              ) : (
                <ul className="saved-list">
                  {closedJobs.map((job) => (
                    <li key={job.id} className="saved-list__item saved-list__item--closed">
                      <Link to={`/viec-lam/${job.id}`} className="saved-list__link">
                        <span className="saved-list__title">{job.title}</span>
                        <span className="saved-list__meta">
                          {job.company} · Hạn nộp: {formatDeadlineVi(job.applicationDeadline)}
                        </span>
                      </Link>
                      <button
                        type="button"
                        className="saved-list__remove"
                        aria-label={`Bỏ lưu: ${job.title}`}
                        onClick={() => handleUnsave(job.id)}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {koreaSavedIds.length > 0 && koreaLoading && (
            <section className="jm-saved-section">
              <h2 className="home-section__title">Việc làm Hàn Quốc</h2>
              <p className="empty-state empty-state--inline">Đang tải...</p>
            </section>
          )}

          {!koreaLoading && koreaResolved.length > 0 && (
            <section className="jm-saved-section">
              <h2 className="home-section__title">Việc làm Hàn Quốc ({koreaResolved.length})</h2>
              {view === 'table' ? (
                <JobsTable
                  rows={koreaResolved.map(koreaRow)}
                  dateColumnLabel="Ngày đăng"
                  selectable
                  selectedIds={selectedIds}
                  onToggleRow={toggleRow}
                />
              ) : (
                <ul className="saved-list">
                  {koreaResolved.map((job) => (
                    <li key={job.id} className="saved-list__item">
                      <Link to={`/viec-han-quoc/${job.id}`} className="saved-list__link">
                        <span className="saved-list__title">{koreaJobDisplayTitle(job)}</span>
                        <span className="saved-list__meta">{job.company} · {koreaJobDisplayLocation(job)}</span>
                        <span className="saved-list__meta">{formatKoreaSalary(job) || 'Thỏa thuận'}</span>
                      </Link>
                      <button
                        type="button"
                        className="saved-list__remove"
                        aria-label={`Bỏ lưu: ${koreaJobDisplayTitle(job)}`}
                        onClick={() => handleUnsave(koreaSavedId(job.id))}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {!koreaLoading && koreaMissingIds.length > 0 && (
            <section className="jm-saved-section">
              <h2 className="home-section__title">Tin Hàn Quốc không còn tồn tại ({koreaMissingIds.length})</h2>
              <p className="empty-state empty-state--inline">
                Các tin dưới đây đã bị gỡ hoặc hết hạn — chỉ có thể bỏ lưu, không thể xem lại chi tiết.
              </p>
              {view === 'table' ? (
                <JobsTable
                  rows={koreaMissingIds.map((id) => missingRow(id, 'Tin đã gỡ hoặc hết hạn'))}
                  dateColumnLabel="—"
                  selectable
                  selectedIds={selectedIds}
                  onToggleRow={toggleRow}
                />
              ) : (
                <ul className="saved-list">
                  {koreaMissingIds.map((id) => (
                    <li key={id} className="saved-list__item saved-list__item--closed">
                      <span className="saved-list__link">
                        <span className="saved-list__title">Tin đã gỡ hoặc hết hạn</span>
                        <span className="saved-list__meta">Mã tin: {id}</span>
                      </span>
                      <button
                        type="button"
                        className="saved-list__remove"
                        aria-label="Bỏ lưu"
                        onClick={() => handleUnsave(id)}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {missingIds.length > 0 && (
            <section className="jm-saved-section">
              <h2 className="home-section__title">Không còn tồn tại ({missingIds.length})</h2>
              <p className="empty-state empty-state--inline">
                Các tin dưới đây đã bị gỡ hoặc ngừng đăng — chỉ có thể bỏ lưu, không thể xem lại chi tiết.
              </p>
              {view === 'table' ? (
                <JobsTable
                  rows={missingIds.map((id) => missingRow(id, 'Tin đã gỡ hoặc ngừng đăng'))}
                  dateColumnLabel="—"
                  selectable
                  selectedIds={selectedIds}
                  onToggleRow={toggleRow}
                />
              ) : (
                <ul className="saved-list">
                  {missingIds.map((id) => (
                    <li key={id} className="saved-list__item saved-list__item--closed">
                      <span className="saved-list__link">
                        <span className="saved-list__title">Tin đã gỡ hoặc ngừng đăng</span>
                        <span className="saved-list__meta">Mã tin: {id}</span>
                      </span>
                      <button
                        type="button"
                        className="saved-list__remove"
                        aria-label="Bỏ lưu"
                        onClick={() => handleUnsave(id)}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}
