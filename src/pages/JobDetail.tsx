import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CompanyReviews } from '../components/CompanyReviews'
import { MessageEmployerModal } from '../components/MessageEmployerModal'
import { Toast } from '../components/Toast'
import { useAuth } from '../context/AuthContext'
import { CATEGORY_LABELS } from '../data/categories'
import { useJobs } from '../context/JobsContext'
import { addApplication, hasAppliedToJob } from '../lib/applicationsStorage'
import { formatDeadlineVi, zaloMeUrl } from '../lib/jobUtils'
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
  const [applied, setApplied] = useState(() => (id ? hasAppliedToJob(id) : false))

  const job = useMemo(() => jobs.find((j) => j.id === id), [jobs, id])

  useEffect(() => {
    if (job) setApplied(hasAppliedToJob(job.id))
  }, [job?.id])

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
    if (hasAppliedToJob(job.id)) {
      setToastMsg('Bạn đã ứng tuyển tin này trước đó.')
      setToastOpen(true)
      return
    }
    const res = addApplication({
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
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
          <h2 className="detail-panel__heading">Mô tả công việc</h2>
          <p className="detail-panel__body">{job.description}</p>
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
