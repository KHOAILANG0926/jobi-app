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

function DescriptionRenderer({ text }: { text: string }) {
  if (text.startsWith('http')) return null
  const blocks = text.split(/\n\n+/)
  return (
    <div className="job-desc">
      {blocks.map((block, i) => {
        if (block.startsWith('## ')) {
          const [heading, ...lines] = block.split('\n')
          return (
            <div key={i} className="job-desc__section">
              <h4 className="job-desc__heading">{heading.replace('## ', '')}</h4>
              {lines.map((line, j) => (
                line.startsWith('• ')
                  ? <p key={j} className="job-desc__bullet">{line}</p>
                  : line.trim() ? <p key={j} className="job-desc__line">{line}</p> : null
              ))}
            </div>
          )
        }
        return <p key={i} style={{ whiteSpace: 'pre-line', margin: '0 0 0.75rem', lineHeight: 1.8 }}>{block}</p>
      })}
    </div>
  )
}

function BookmarkGlyph({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden className="btn-bookmark__icon">
      <path
        d="M7 3.5h10a2 2 0 012 2v16.5l-7-4.25L5 22V5.5a2 2 0 012-2z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"
      />
    </svg>
  )
}

/* ── 아이콘 SVG ── */
function IcSalary() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="10" cy="10" r="9" stroke="#e53935" strokeWidth="1.5"/>
      <text x="10" y="14" textAnchor="middle" fontSize="10" fill="#e53935" fontWeight="700">₫</text>
    </svg>
  )
}
function IcPin() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M10 2a6 6 0 016 6c0 4-6 10-6 10S4 12 4 8a6 6 0 016-6z" stroke="#64748b" strokeWidth="1.5"/>
      <circle cx="10" cy="8" r="2" stroke="#64748b" strokeWidth="1.5"/>
    </svg>
  )
}
function IcClock() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="10" cy="10" r="8" stroke="#64748b" strokeWidth="1.5"/>
      <path d="M10 6v4l3 2" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}
function IcCalendar() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" style={{ flexShrink: 0 }}>
      <rect x="3" y="4" width="14" height="13" rx="2" stroke="#64748b" strokeWidth="1.5"/>
      <path d="M7 2v4M13 2v4M3 9h14" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}
function IcBriefcase() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" style={{ flexShrink: 0 }}>
      <rect x="2" y="7" width="16" height="11" rx="2" stroke="#64748b" strokeWidth="1.5"/>
      <path d="M7 7V5a2 2 0 014 0v2" stroke="#64748b" strokeWidth="1.5"/>
      <path d="M2 12h16" stroke="#64748b" strokeWidth="1.5"/>
    </svg>
  )
}
function IcPeople() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="6" r="3" stroke="#64748b" strokeWidth="1.5"/>
      <path d="M2 17c0-3 2.7-5 6-5s6 2 6 5" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M14 9a2 2 0 010 4M16 17c0-2-1-3.5-2-4" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}
function IcGrad() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M10 4L2 8l8 4 8-4-8-4z" stroke="#64748b" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M5 10v4c0 2 5 3 5 3s5-1 5-3v-4" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}
function IcDeadline() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="10" cy="11" r="7" stroke="#64748b" strokeWidth="1.5"/>
      <path d="M10 7v4l2.5 2.5" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M7 2h6" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round"/>
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
        <Link to="/" className="btn btn--primary">Về trang chủ</Link>
      </div>
    )
  }

  const onToggleSave = () => setSaved(toggleSavedJobId(job.id))
  const zaloHref = zaloMeUrl(job.zalo || job.employerPhone)
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
    const res = addApplication({ jobId: job.id, jobTitle: job.title, company: job.company, seekerId: user.id })
    if (res.ok) {
      setApplied(true)
      setToastMsg('Đã ứng tuyển thành công!')
      setToastOpen(true)
    }
  }

  const catLabel = CATEGORY_LABELS[job.category] ?? job.category

  return (
    <div className="page jd-page">
      <button type="button" className="back-link" onClick={() => navigate(-1)}>← Quay lại</button>

      {/* ── HEADER CARD ── */}
      <div className="jd-hcard">
        <div className="jd-hcard__logo">
          {job.imageUrl
            ? <img src={job.imageUrl} alt={job.company} className="jd-hcard__logo-img" />
            : <span className="jd-hcard__logo-fallback">🏢</span>
          }
        </div>
        <div className="jd-hcard__info">
          <div className="jd-hcard__tags">
            <span className="jd-tag">#{catLabel}</span>
            {job.urgent && <span className="jd-tag jd-tag--urgent">#Tuyển gấp</span>}
          </div>
          <h1 className="jd-hcard__title">{job.title}</h1>
          <p className="jd-hcard__company">{job.company}</p>
          <div className="jd-hcard__meta">
            <span className="jd-hcard__meta-item">
              <IcPin />
              {job.location}
            </span>
            <span className="jd-hcard__meta-item">
              Đăng{' '}
              {new Date(job.postedAt).toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
          {(job.companyVerified || job.hireCount) && (
            <div className="trust-badges" style={{ marginTop: '0.4rem' }}>
              {job.companyVerified && <span className="trust-badge trust-badge--verified">✔ Đã xác minh</span>}
              {job.hireCount !== undefined && <span className="trust-badge">Đã tuyển {job.hireCount} lần</span>}
            </div>
          )}
        </div>
        <div className="jd-hcard__bookmark">
          <button
            type="button"
            className={`jd-bookmark-btn${saved ? ' jd-bookmark-btn--active' : ''}`}
            onClick={onToggleSave}
            title={saved ? 'Bỏ lưu' : 'Lưu tin'}
          >
            <BookmarkGlyph filled={saved} />
          </button>
        </div>
      </div>

      {/* ── MAIN GRID ── */}
      <div className="detail-grid">
        <div className="jd-left">

          {/* ── Điều kiện làm việc ── */}
          <div className="jd-card">
            <h2 className="jd-card__title">
              <IcBriefcase />
              Điều kiện làm việc
            </h2>
            <div className="jd-info-grid">
              <div className="jd-info-item">
                <span className="jd-info-label"><IcSalary /> Mức lương</span>
                <span className="jd-info-value jd-info-value--salary">{job.salary || 'Thỏa thuận'}</span>
              </div>
              <div className="jd-info-item">
                <span className="jd-info-label"><IcPin /> Địa điểm</span>
                <span className="jd-info-value">{job.location}</span>
              </div>
              <div className="jd-info-item">
                <span className="jd-info-label"><IcClock /> Giờ làm việc</span>
                <span className="jd-info-value">{job.hours || 'Theo ca / Thỏa thuận'}</span>
              </div>
              <div className="jd-info-item">
                <span className="jd-info-label"><IcCalendar /> Ngày làm việc</span>
                <span className="jd-info-value">{job.workDays || 'Thỏa thuận'}</span>
              </div>
              {job.workPeriod && (
                <div className="jd-info-item">
                  <span className="jd-info-label"><IcBriefcase /> Hình thức</span>
                  <span className="jd-info-value">{job.workPeriod}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Điều kiện tuyển dụng ── */}
          <div className="jd-card">
            <h2 className="jd-card__title">
              <IcPeople />
              Điều kiện tuyển dụng
            </h2>
            <div className="jd-recruit-grid">
              <div className="jd-recruit-item">
                <span className="jd-recruit-icon"><IcDeadline /></span>
                <span className="jd-recruit-label">Hạn nộp hồ sơ</span>
                <span className="jd-recruit-value">{formatDeadlineVi(job.applicationDeadline)}</span>
              </div>
              <div className="jd-recruit-item">
                <span className="jd-recruit-icon"><IcPeople /></span>
                <span className="jd-recruit-label">Số lượng tuyển</span>
                <span className="jd-recruit-value">{job.numHires || 'Tuyển nhiều vị trí'}</span>
              </div>
              <div className="jd-recruit-item">
                <span className="jd-recruit-icon"><IcGrad /></span>
                <span className="jd-recruit-label">Học vấn</span>
                <span className="jd-recruit-value">{job.education || 'Không yêu cầu'}</span>
              </div>
              <div className="jd-recruit-item">
                <span className="jd-recruit-icon"><IcBriefcase /></span>
                <span className="jd-recruit-label">Kinh nghiệm</span>
                <span className="jd-recruit-value">{job.preference || 'Không yêu cầu kinh nghiệm'}</span>
              </div>
            </div>
          </div>

          {/* ── Mô tả công việc ── */}
          {(job.imageUrl || (job.description && !job.description.startsWith('http'))) && (
            <div className="jd-card">
              <h2 className="jd-card__title">
                <span style={{ fontSize: '1rem' }}>📋</span>
                Mô tả công việc
              </h2>
              <div className="jd-card__body">
                {job.imageUrl && (
                  <>
                    <img src={job.imageUrl} alt={job.title} className="jd-desc-img" />
                    {job.images && job.images
                      .filter((u: string) => u !== job.imageUrl)
                      .map((url: string, i: number) => (
                        <img key={i} src={url} alt={`${job.title} ${i + 2}`} className="jd-desc-img" />
                      ))}
                  </>
                )}
                {job.description && <DescriptionRenderer text={job.description} />}
              </div>
            </div>
          )}

          {/* ── Khu vực làm việc ── */}
          {coords && (
            <div className="jd-card">
              <h2 className="jd-card__title">
                <IcPin />
                Khu vực làm việc
              </h2>
              <div className="jd-card__body">
                <p style={{ margin: '0 0 0.75rem', color: '#64748b', fontSize: '0.9rem' }}>{job.location}</p>
                <JobLocationMap lat={coords.lat!} lng={coords.lng!} title={job.title} />
                <p className="job-location-map__disclaimer" style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                  Bản đồ mang tính minh họa khu vực, có thể không trùng khớp chính xác địa chỉ công ty.
                </p>
              </div>
            </div>
          )}

          <CompanyReviews company={job.company} />
        </div>

        {/* ── SIDEBAR ── */}
        <aside className="detail-aside jd-aside">
          {/* Salary highlight */}
          <div className="jd-aside-salary">
            <span className="jd-aside-salary__label">Mức lương</span>
            <span className="jd-aside-salary__value">{job.salary || 'Thỏa thuận'}</span>
          </div>

          {/* Deadline */}
          <div className="jd-aside-meta">
            <span className="jd-aside-meta__label">Hạn nộp hồ sơ</span>
            <span className="jd-aside-meta__value">{formatDeadlineVi(job.applicationDeadline)}</span>
          </div>

          {/* Zalo */}
          {job.employerPhone && (
            <a href={zaloHref} target="_blank" rel="noopener noreferrer" className="jd-btn-zalo">
              <svg viewBox="0 0 40 40" width="22" height="22" fill="none" aria-hidden>
                <circle cx="20" cy="20" r="20" fill="#fff"/>
                <text x="20" y="26" textAnchor="middle" fontSize="16" fontWeight="900" fill="#0068ff">Z</text>
              </svg>
              Chat qua Zalo
            </a>
          )}

          {/* Phone */}
          {job.employerPhone && (
            <a href={`tel:${job.employerPhone.replace(/\s/g, '')}`} className="jd-btn-phone">
              <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden>
                <path d="M6.5 2C5.7 2 5 2.7 5 3.5c0 1.4.3 2.7.9 3.9L7.6 9l-.5.5c-.9.9-1 2.3-.3 3.4 1.1 1.8 2.5 3.3 4.3 4.4 1.1.7 2.5.6 3.4-.3l.5-.5 1.6 1.7c1.2.6 2.5.9 3.9.9.8 0 1.5-.7 1.5-1.5v-3c0-.7-.5-1.3-1.2-1.5l-3-.7c-.6-.2-1.3.1-1.7.6l-.7.9c-.7-.4-1.4-.9-2-1.5s-1.1-1.3-1.5-2l.9-.7c.5-.4.8-1.1.6-1.7l-.7-3C12.3 2.5 11.7 2 11 2H6.5z" fill="#1e40af"/>
              </svg>
              Gọi điện thoại
            </a>
          )}

          <div style={{ height: '1px', background: 'var(--color-border, #e5e7eb)', margin: '0.75rem 0' }} />

          {/* Apply */}
          <button type="button" className="btn btn--primary btn--block" onClick={onOneClickApply} disabled={applied}>
            {applied ? '✓ Đã ứng tuyển' : 'Ứng tuyển ngay'}
          </button>
          <span className="detail-aside__apply-hint">Ứng tuyển nhanh bằng CV đã lưu trong Hồ sơ</span>

          {showMessageCta && (
            <button type="button" className="btn btn--ghost btn--block" onClick={() => setMessageOpen(true)}>
              Nhắn tin nhà tuyển dụng
            </button>
          )}
          <button
            type="button"
            className={`btn btn--ghost btn--block btn--with-icon${saved ? ' btn--saved' : ''}`}
            onClick={onToggleSave}
          >
            <BookmarkGlyph filled={saved} />
            {saved ? 'Đã lưu tin' : 'Lưu tin'}
          </button>
        </aside>
      </div>

      <Toast message={toastMsg} open={toastOpen} onClose={() => setToastOpen(false)} />
      <MessageEmployerModal open={messageOpen} job={job} user={user} onClose={() => setMessageOpen(false)} />
    </div>
  )
}
