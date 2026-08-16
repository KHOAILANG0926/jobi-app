import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CompanyReviews } from '../components/CompanyReviews'
import JobLocationMap from '../components/JobLocationMap'
import { MessageEmployerModal } from '../components/MessageEmployerModal'
import { Toast } from '../components/Toast'
import { useAuth } from '../context/AuthContext'
import { CATEGORY_LABELS } from '../data/categories'
import { useJobs } from '../context/JobsContext'
import { addApplication, hasAppliedToJob } from '../lib/applicationsStorage'
import { formatDeadlineVi, zaloMeUrl } from '../lib/jobUtils'
import { withJobCoordinates } from '../lib/jobCoords'
import { isJobSaved, toggleSavedJobId } from '../lib/storage'

function BookmarkGlyph({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden className="btn-bookmark__icon">
      <path
        d="M7 3.5h10a2 2 0 012 2v16.5l-7-4.25L5 22V5.5a2 2 0 012-2z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function JobDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { jobs } = useJobs()
  const [saved, setSaved] = useState(() => (id ? isJobSaved(id) : false))
  const [messageOpen, setMessageOpen] = useState(false)
  const [toastOpen, setToastOpen] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const [applied, setApplied] = useState(() => (id ? hasAppliedToJob(id, user?.id) : false))

  const job = useMemo(() => jobs.find((j) => j.id === id), [jobs, id])
  const coords = useMemo(() => (job ? withJobCoordinates(job) : null), [job])

  useEffect(() => {
    if (job) setApplied(hasAppliedToJob(job.id, user?.id))
  }, [job?.id, user?.id])

  if (!id || !job) {
    return (
      <div className="page page--narrow not-found">
        <h1>Không tìm thấy tin tuyển dụng</h1>
        <p>Tin có thể đã gỡ hoặc liên kết không đúng.</p>
        <Link to="/" className="btn btn--primary">
          Về trang chủ
        </Link>
      </div>
    )
  }

  const onToggleSave = () => {
    setSaved(toggleSavedJobId(job.id))
  }

  const zaloHref = zaloMeUrl(job.employerPhone)
  const showMessageCta = user?.role !== 'employer'

  const onOneClickApply = () => {
    if (!user) {
      navigate('/dang-nhap', { state: { from: `/viec-lam/${job.id}` } })
      return
    }
    if (hasAppliedToJob(job.id, user.id)) {
      setToastMsg('Bạn đã ứng tuyển tin này trước đó.')
      setToastOpen(true)
      return
    }
    const res = addApplication({
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
      seekerId: user.id,
    })
    if (res.ok) {
      setApplied(true)
      setToastMsg('Đã ứng tuyển thành công!')
      setToastOpen(true)
    }
  }

  return (
    <div className="page job-detail">
      <button type="button" className="back-link" onClick={() => navigate(-1)}>
        ← Quay lại
      </button>

      <header className="job-detail__header">
        <div className="job-detail__badges">
          <span className="job-detail__badge">{CATEGORY_LABELS[job.category]}</span>
          {job.urgent ? <span className="job-detail__urgent">Tuyển gấp</span> : null}
        </div>
        <h1 className="job-detail__title">{job.title}</h1>
        <p className="job-detail__company">{job.company}</p>
        {(job.companyVerified || job.companyFoundedYear || job.hireCount) && (
          <div className="trust-badges">
            {job.companyVerified && <span className="trust-badge trust-badge--verified">✔ Đã xác minh</span>}
            {job.companyFoundedYear && (
              <span className="trust-badge">
                Thành lập {job.companyFoundedYear} · năm thứ {new Date().getFullYear() - job.companyFoundedYear}
              </span>
            )}
            {job.hireCount !== undefined && <span className="trust-badge">Đã tuyển {job.hireCount} lần</span>}
          </div>
        )}
        <p className="job-detail__deadline">Hạn nộp: {formatDeadlineVi(job.applicationDeadline)}</p>
        <time className="job-detail__date" dateTime={job.postedAt}>
          Đăng ngày{' '}
          {new Date(job.postedAt).toLocaleDateString('vi-VN', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </time>
      </header>

      <div className="detail-grid">
        <div className="detail-panel">

          {/* ── 1. 근무조건 ── */}
          <div className="info-section">
            <div className="info-section__head">
              <span className="info-section__icon">💼</span>
              <span className="info-section__num">1.</span>
              <span className="info-section__title">Điều kiện làm việc</span>
            </div>
            <dl className="info-section__body">
              <div className="info-row">
                <dt>Mức lương</dt>
                <dd className="info-row--salary">{job.salary}</dd>
              </div>
              <div className="info-row">
                <dt>Địa điểm</dt>
                <dd>{job.location}</dd>
              </div>
              {job.company && (
                <div className="info-row">
                  <dt>Công ty</dt>
                  <dd>{job.company}</dd>
                </div>
              )}
              {job.hours && (
                <div className="info-row">
                  <dt>Giờ làm việc</dt>
                  <dd>{job.hours}</dd>
                </div>
              )}
              {job.workDays && (
                <div className="info-row">
                  <dt>Ngày làm việc</dt>
                  <dd>{job.workDays}</dd>
                </div>
              )}
              {job.workPeriod && (
                <div className="info-row">
                  <dt>Hình thức</dt>
                  <dd>{job.workPeriod}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* ── 2. 모집조건 ── */}
          <div className="info-section">
            <div className="info-section__head">
              <span className="info-section__icon">👥</span>
              <span className="info-section__num">2.</span>
              <span className="info-section__title">Điều kiện tuyển dụng</span>
            </div>
            <dl className="info-section__body">
              <div className="info-row">
                <dt>Hạn nộp hồ sơ</dt>
                <dd>{formatDeadlineVi(job.applicationDeadline)}</dd>
              </div>
              <div className="info-row">
                <dt>Số lượng tuyển</dt>
                <dd>{job.numHires || 'Chưa cập nhật'}</dd>
              </div>
              <div className="info-row">
                <dt>Học vấn</dt>
                <dd>{job.education || 'Không yêu cầu'}</dd>
              </div>
              <div className="info-row">
                <dt>Kinh nghiệm</dt>
                <dd>{job.preference || 'Không yêu cầu'}</dd>
              </div>
            </dl>
          </div>

          {/* ── 3. 모집요강 ── */}
          <div className="info-section">
            <div className="info-section__head">
              <span className="info-section__icon">📋</span>
              <span className="info-section__num">3.</span>
              <span className="info-section__title">Mô tả công việc</span>
            </div>
            <div className="info-section__body" style={{ padding: '1rem 1.25rem' }}>
              {job.imageUrl && job.source !== 'vieclam24h' && (
                <>
                  <img
                    src={job.imageUrl}
                    alt={job.title}
                    style={{ width: '100%', borderRadius: '8px', marginBottom: '1rem', objectFit: 'contain', maxHeight: '600px', background: '#f9fafb' }}
                  />
                  {job.images && job.images.filter((u: string) => u !== job.imageUrl).map((url: string, i: number) => (
                    <img
                      key={i}
                      src={url}
                      alt={`${job.title} ${i + 2}`}
                      style={{ width: '100%', borderRadius: '8px', marginBottom: '12px', objectFit: 'contain', maxHeight: '600px', background: '#f9fafb' }}
                    />
                  ))}
                </>
              )}
              {job.description && job.source !== 'vieclam24h' && (
                <p style={{ whiteSpace: 'pre-line', margin: 0, lineHeight: 1.8 }}>{job.description}</p>
              )}
              {job.source === 'vieclam24h' && job.description && (
                <a href={job.description} target="_blank" rel="noopener noreferrer" className="btn btn--ghost">
                  Xem chi tiết tại vieclam24h ↗
                </a>
              )}
            </div>
          </div>

          {/* ── 4. 근무지역 ── */}
          {coords && (
            <div className="info-section">
              <div className="info-section__head">
                <span className="info-section__icon">📍</span>
                <span className="info-section__num">4.</span>
                <span className="info-section__title">Khu vực làm việc</span>
              </div>
              <div className="info-section__body" style={{ padding: '1rem 1.25rem' }}>
                <p style={{ margin: '0 0 0.75rem', color: 'var(--color-text-secondary, #666)' }}>{job.location}</p>
                <JobLocationMap lat={coords.lat!} lng={coords.lng!} title={job.title} />
                <p className="job-location-map__disclaimer" style={{ marginTop: '0.5rem' }}>
                  Bản đồ mang tính minh họa khu vực, có thể không trùng khớp chính xác địa chỉ công ty.
                </p>
              </div>
            </div>
          )}

          <CompanyReviews company={job.company} />
        </div>
        <aside className="detail-aside">
          <dl className="fact-list">
            <div className="fact-list__row">
              <dt>Mức lương</dt>
              <dd>{job.salary}</dd>
            </div>
            <div className="fact-list__row">
              <dt>Địa điểm</dt>
              <dd>{job.location}</dd>
            </div>
            {job.hours ? (
              <div className="fact-list__row">
                <dt>Thời gian làm việc</dt>
                <dd>{job.hours}</dd>
              </div>
            ) : null}
            <div className="fact-list__row">
              <dt>Hạn nộp hồ sơ</dt>
              <dd>{formatDeadlineVi(job.applicationDeadline)}</dd>
            </div>
          </dl>

          {job.employerPhone ? (
            <div className="detail-contact">
              <h3 className="detail-contact__title">Liên hệ nhà tuyển dụng</h3>
              <p className="detail-contact__phone">
                <span className="detail-contact__label">Điện thoại</span>
                <a href={`tel:${job.employerPhone.replace(/\s/g, '')}`}>{job.employerPhone}</a>
              </p>
              <a
                href={zaloHref}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn--zalo btn--block"
              >
                Liên hệ qua Zalo
              </a>
            </div>
          ) : job.source === 'vieclam24h' && job.description ? (
            <div className="detail-contact">
              <h3 className="detail-contact__title">Liên hệ nhà tuyển dụng</h3>
              <a
                href={job.description}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn--zalo btn--block"
              >
                Xem liên hệ tại vieclam24h ↗
              </a>
            </div>
          ) : null}

          <div className="detail-aside__actions">
            <button
              type="button"
              className="btn btn--primary btn--block"
              onClick={onOneClickApply}
              disabled={applied}
            >
              {applied ? 'Đã ứng tuyển' : 'Ứng tuyển ngay'}
            </button>
            <span className="detail-aside__apply-hint">
              Ứng tuyển nhanh bằng CV đã lưu trong Hồ sơ
            </span>
            {showMessageCta ? (
              <button
                type="button"
                className="btn btn--ghost btn--block"
                onClick={() => setMessageOpen(true)}
              >
                Nhắn tin nhà tuyển dụng
              </button>
            ) : null}
            <button
              type="button"
              className={`btn btn--ghost btn--block btn--with-icon${saved ? ' btn--saved' : ''}`}
              onClick={onToggleSave}
            >
              <BookmarkGlyph filled={saved} />
              {saved ? 'Đã lưu tin' : 'Lưu tin'}
            </button>
          </div>
        </aside>
      </div>

      <Toast message={toastMsg} open={toastOpen} onClose={() => setToastOpen(false)} />
      <MessageEmployerModal
        open={messageOpen}
        job={job}
        user={user}
        onClose={() => setMessageOpen(false)}
      />
    </div>
  )
}
