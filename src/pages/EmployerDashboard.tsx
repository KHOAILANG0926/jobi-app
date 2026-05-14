import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useJobs } from '../context/JobsContext'
import { CATEGORY_LABELS } from '../data/categories'
import {
  APPLICATION_STATUS_META,
  loadApplications,
  updateApplicationStatus,
  type ApplicationStatus,
  type JobApplication,
} from '../lib/applicationsStorage'
import type { Job } from '../types/job'

type Tab = 'jobs' | 'applicants'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function EmployerDashboard() {
  const { user } = useAuth()
  const { jobs, deleteJob, updateJob } = useJobs()
  const [tab, setTab] = useState<Tab>('jobs')
  const [applications, setApplications] = useState<JobApplication[]>([])
  const [filterJobId, setFilterJobId] = useState<string>('all')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  useEffect(() => {
    setApplications(loadApplications())
    const handler = () => setApplications(loadApplications())
    window.addEventListener('jobi:applications', handler)
    return () => window.removeEventListener('jobi:applications', handler)
  }, [])

  if (!user) return null

  const myJobs = useMemo(
    () => jobs.filter((j) => j.employerId === user.id),
    [jobs, user.id],
  )

  const myJobIds = useMemo(() => new Set(myJobs.map((j) => j.id)), [myJobs])

  const myApplications = useMemo(
    () => applications.filter((a) => myJobIds.has(a.jobId)),
    [applications, myJobIds],
  )

  const applicantCountByJob = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const a of myApplications) {
      counts[a.jobId] = (counts[a.jobId] ?? 0) + 1
    }
    return counts
  }, [myApplications])

  const pendingCount = useMemo(
    () => myApplications.filter((a) => a.status === 'submitted' || a.status === 'reviewing').length,
    [myApplications],
  )

  const filteredApplications = useMemo(
    () =>
      filterJobId === 'all'
        ? myApplications
        : myApplications.filter((a) => a.jobId === filterJobId),
    [myApplications, filterJobId],
  )

  const handleStatusChange = (key: string, status: ApplicationStatus) => {
    updateApplicationStatus(key, status)
    setApplications(loadApplications())
  }

  const handleDelete = (job: Job) => {
    if (deleteConfirmId === job.id) {
      deleteJob(job.id)
      setDeleteConfirmId(null)
    } else {
      setDeleteConfirmId(job.id)
    }
  }

  const handleToggleUrgent = (job: Job) => {
    updateJob(job.id, { urgent: !job.urgent })
  }

  return (
    <div className="page employer-dashboard">
      {/* Hero */}
      <header className="employer-dashboard__hero">
        <p className="employer-dashboard__greeting">Xin chào, {user.name}</p>
        <h1 className="employer-dashboard__title">Bảng điều khiển nhà tuyển dụng</h1>
        <div className="employer-dashboard__hero-actions">
          <Link to="/dang-tin" className="btn btn--primary employer-dashboard__cta">
            + Đăng tin mới
          </Link>
          <Link to="/" className="employer-dashboard__link">
            Xem danh sách trên Jobi →
          </Link>
        </div>
      </header>

      {/* Stats */}
      <section className="employer-dashboard__stats" aria-label="Thống kê nhanh">
        <div className="employer-dashboard__stat">
          <span className="employer-dashboard__stat-value">{myJobs.length}</span>
          <span className="employer-dashboard__stat-label">Tin đang đăng</span>
        </div>
        <div className="employer-dashboard__stat">
          <span className="employer-dashboard__stat-value">{myApplications.length}</span>
          <span className="employer-dashboard__stat-label">Tổng ứng viên</span>
        </div>
        <div className="employer-dashboard__stat">
          <span className="employer-dashboard__stat-value edb-stat--pending">{pendingCount}</span>
          <span className="employer-dashboard__stat-label">Chờ xét duyệt</span>
        </div>
      </section>

      {/* Tabs */}
      <div className="edb-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'jobs'}
          className={`edb-tab${tab === 'jobs' ? ' edb-tab--active' : ''}`}
          onClick={() => setTab('jobs')}
        >
          📋 Tin tuyển dụng
          {myJobs.length > 0 && <span className="edb-tab__badge">{myJobs.length}</span>}
        </button>
        <button
          role="tab"
          aria-selected={tab === 'applicants'}
          className={`edb-tab${tab === 'applicants' ? ' edb-tab--active' : ''}`}
          onClick={() => setTab('applicants')}
        >
          👥 Ứng viên
          {pendingCount > 0 && <span className="edb-tab__badge edb-tab__badge--alert">{pendingCount}</span>}
        </button>
      </div>

      {/* ── Tab: Jobs ── */}
      {tab === 'jobs' && (
        <div className="edb-panel" role="tabpanel">
          {myJobs.length === 0 ? (
            <div className="edb-empty">
              <span className="edb-empty__icon">📝</span>
              <p className="edb-empty__text">Bạn chưa đăng tin nào.</p>
              <Link to="/dang-tin" className="btn btn--primary">
                Đăng tin đầu tiên
              </Link>
            </div>
          ) : (
            <ul className="edb-job-list">
              {myJobs.map((job) => {
                const count = applicantCountByJob[job.id] ?? 0
                const isConfirming = deleteConfirmId === job.id
                return (
                  <li key={job.id} className="edb-job-item">
                    <div className="edb-job-item__main">
                      <div className="edb-job-item__header">
                        {job.urgent && <span className="edb-urgent-badge">🔥 Tuyển gấp</span>}
                        <Link
                          to={`/viec-lam/${job.id}`}
                          className="edb-job-item__title"
                        >
                          {job.title}
                        </Link>
                      </div>
                      <p className="edb-job-item__meta">
                        {CATEGORY_LABELS[job.category]} · {job.location} · {job.salary}
                      </p>
                      <p className="edb-job-item__date">
                        Đăng ngày {formatDate(job.postedAt)} · Hạn {formatDate(job.applicationDeadline)}
                      </p>
                    </div>

                    <div className="edb-job-item__right">
                      <button
                        className="edb-applicant-count"
                        onClick={() => {
                          setFilterJobId(job.id)
                          setTab('applicants')
                        }}
                        title="Xem ứng viên"
                      >
                        <span className="edb-applicant-count__num">{count}</span>
                        <span className="edb-applicant-count__label">ứng viên</span>
                      </button>

                      <div className="edb-job-item__actions">
                        <button
                          className={`edb-btn-urgent${job.urgent ? ' edb-btn-urgent--on' : ''}`}
                          onClick={() => handleToggleUrgent(job)}
                          title={job.urgent ? 'Bỏ tuyển gấp' : 'Đánh dấu tuyển gấp'}
                        >
                          🔥
                        </button>
                        <button
                          className={`edb-btn-delete${isConfirming ? ' edb-btn-delete--confirm' : ''}`}
                          onClick={() => handleDelete(job)}
                          title={isConfirming ? 'Nhấn lần nữa để xác nhận xoá' : 'Xoá tin'}
                        >
                          {isConfirming ? 'Xác nhận xoá?' : '🗑'}
                        </button>
                        {isConfirming && (
                          <button
                            className="edb-btn-cancel"
                            onClick={() => setDeleteConfirmId(null)}
                          >
                            Huỷ
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {/* ── Tab: Applicants ── */}
      {tab === 'applicants' && (
        <div className="edb-panel" role="tabpanel">
          {/* Job filter */}
          {myJobs.length > 0 && (
            <div className="edb-filter-row">
              <label className="edb-filter-label" htmlFor="edb-job-filter">
                Lọc theo tin:
              </label>
              <select
                id="edb-job-filter"
                className="edb-filter-select"
                value={filterJobId}
                onChange={(e) => setFilterJobId(e.target.value)}
              >
                <option value="all">Tất cả ({myApplications.length})</option>
                {myJobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title} ({applicantCountByJob[j.id] ?? 0})
                  </option>
                ))}
              </select>
            </div>
          )}

          {filteredApplications.length === 0 ? (
            <div className="edb-empty">
              <span className="edb-empty__icon">👥</span>
              <p className="edb-empty__text">
                {myJobs.length === 0
                  ? 'Đăng tin để nhận ứng viên.'
                  : 'Chưa có ứng viên nào.'}
              </p>
            </div>
          ) : (
            <ul className="edb-applicant-list">
              {filteredApplications.map((app) => {
                const meta = APPLICATION_STATUS_META[app.status]
                return (
                  <li key={`${app.jobId}-${app.appliedAt}`} className="edb-applicant-item">
                    <div className="edb-applicant-item__avatar">
                      {(app.seekerName?.trim() || '?')[0].toUpperCase()}
                    </div>
                    <div className="edb-applicant-item__info">
                      <p className="edb-applicant-item__name">
                        {app.seekerName ?? 'Ẩn danh'}
                      </p>
                      <p className="edb-applicant-item__sub">
                        {app.seekerPhone && (
                          <a href={`tel:${app.seekerPhone}`} className="edb-phone-link">
                            📞 {app.seekerPhone}
                          </a>
                        )}
                        {app.seekerPhone && ' · '}
                        {app.jobTitle} · {formatDate(app.appliedAt)}
                      </p>
                    </div>
                    <div className="edb-applicant-item__status">
                      <select
                        className={`edb-status-select ${meta.badgeClass}`}
                        value={app.status}
                        onChange={(e) =>
                          handleStatusChange(app.id ?? app.appliedAt, e.target.value as ApplicationStatus)
                        }
                        aria-label={`Trạng thái ứng tuyển của ${app.seekerName ?? 'ứng viên'}`}
                      >
                        {(Object.keys(APPLICATION_STATUS_META) as ApplicationStatus[]).map((s) => (
                          <option key={s} value={s}>
                            {APPLICATION_STATUS_META[s].labelVi}
                          </option>
                        ))}
                      </select>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
