import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useJobs } from '../../context/JobsContext'
import { loadSavedJobIds, toggleSavedJobId } from '../../lib/storage'
import { formatDeadlineVi } from '../../lib/jobUtils'
import { fetchKoreaJobs } from '../../lib/koreaJobsApi'
import { formatKoreaSalary, koreaJobDisplayLocation, koreaJobDisplayTitle, koreaSavedId, parseKoreaSavedId } from '../../lib/koreaJobFormat'
import type { Job } from '../../types/job'
import type { KoreaJob } from '../../types/koreaJob'

/**
 * 저장한 공고 — storage.ts의 계정별 scope(사용자 로그인 시 user.id, 아니면
 * 게스트 전역 키)로 분리된 저장 목록을 읽는다. jobs(useJobs())에 없는 id는
 * 공고가 내려갔거나 비활성화된 것으로 간주해 별도 섹션에 "삭제됨"으로 안내
 * 한다(재구현하지 않고 그대로 목록에서만 제거 가능하게 함). 기기 간 동기화는
 * 지원하지 않는다 — 이 브라우저(로그인 시 이 브라우저의 이 계정)에만 저장됨.
 *
 * korea_jobs 저장분("kr-" 접두사, koreaJobFormat.ts 참고)은 local_jobs와
 * id 시퀀스가 겹칠 수 있어 별도로 구분해 읽고, 별도 섹션(아래)에 표시한다.
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
  const openJobs = resolved.filter((j) => !j.applicationDeadline || j.applicationDeadline >= todayStr)
  const closedJobs = resolved.filter((j) => j.applicationDeadline && j.applicationDeadline < todayStr)

  const handleUnsave = (id: string) => {
    toggleSavedJobId(id, user?.id)
    setSavedIds(loadSavedJobIds(user?.id))
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
          <section className="jm-saved-section">
            <h2 className="home-section__title">Đang tuyển ({openJobs.length})</h2>
            {openJobs.length === 0 ? (
              <p className="empty-state empty-state--inline">Không có tin đang tuyển trong danh sách đã lưu.</p>
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
            </section>
          )}

          {!koreaLoading && koreaMissingIds.length > 0 && (
            <section className="jm-saved-section">
              <h2 className="home-section__title">Tin Hàn Quốc không còn tồn tại ({koreaMissingIds.length})</h2>
              <p className="empty-state empty-state--inline">
                Các tin dưới đây đã bị gỡ hoặc hết hạn — chỉ có thể bỏ lưu, không thể xem lại chi tiết.
              </p>
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
            </section>
          )}

          {missingIds.length > 0 && (
            <section className="jm-saved-section">
              <h2 className="home-section__title">Không còn tồn tại ({missingIds.length})</h2>
              <p className="empty-state empty-state--inline">
                Các tin dưới đây đã bị gỡ hoặc ngừng đăng — chỉ có thể bỏ lưu, không thể xem lại chi tiết.
              </p>
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
            </section>
          )}
        </>
      )}
    </div>
  )
}
