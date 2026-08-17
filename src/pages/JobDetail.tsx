import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  MapPin, Clock, Calendar, Briefcase, Users, GraduationCap,
  Timer, Bookmark, BookmarkCheck, Phone, MessageCircle, ChevronLeft,
} from 'lucide-react'
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

/* ── Description renderer ── */
function DescriptionRenderer({ text }: { text: string }) {
  if (text.startsWith('http')) return null
  const blocks = text.split(/\n\n+/)
  return (
    <div className="jd2-desc">
      {blocks.map((block, i) => {
        if (block.startsWith('## ')) {
          const [heading, ...lines] = block.split('\n')
          return (
            <div key={i} className="jd2-desc__section">
              <h4 className="jd2-desc__heading">{heading.replace('## ', '')}</h4>
              <ul className="jd2-desc__list">
                {lines.map((line, j) =>
                  line.startsWith('• ')
                    ? <li key={j} className="jd2-desc__item">{line.replace('• ', '')}</li>
                    : line.trim()
                      ? <p key={j} className="jd2-desc__line">{line}</p>
                      : null
                )}
              </ul>
            </div>
          )
        }
        return (
          <p key={i} className="jd2-desc__para">{block}</p>
        )
      })}
    </div>
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
    <div className="jd2-page">

      {/* ── Back ── */}
      <button type="button" className="jd2-back" onClick={() => navigate(-1)}>
        <ChevronLeft size={16} strokeWidth={2} />
        Quay lại
      </button>

      {/* ── Header card ── */}
      <div className="jd2-header">
        <div className="jd2-header__left">
          <div className="jd2-logo">
            {job.imageUrl
              ? <img src={job.imageUrl} alt={job.company} className="jd2-logo__img" />
              : <span className="jd2-logo__fallback">{job.company?.[0] ?? 'J'}</span>
            }
          </div>
          <div className="jd2-header__info">
            <div className="jd2-header__chips">
              <span className="jd2-chip">{catLabel}</span>
              {job.urgent && <span className="jd2-chip jd2-chip--urgent">Tuyển gấp</span>}
            </div>
            <h1 className="jd2-header__title">{job.title}</h1>
            <p className="jd2-header__company">{job.company}</p>
            <div className="jd2-header__meta">
              <span className="jd2-meta-item">
                <MapPin size={13} strokeWidth={1.8} />
                {job.location}
              </span>
              <span className="jd2-meta-sep">·</span>
              <span className="jd2-meta-item">
                Đăng {new Date(job.postedAt).toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
        <button
          type="button"
          className={`jd2-save-btn${saved ? ' jd2-save-btn--active' : ''}`}
          onClick={onToggleSave}
          title={saved ? 'Bỏ lưu' : 'Lưu tin'}
        >
          {saved ? <BookmarkCheck size={18} strokeWidth={1.8} /> : <Bookmark size={18} strokeWidth={1.8} />}
        </button>
      </div>

      {/* ── Main grid ── */}
      <div className="jd2-grid">
        <div className="jd2-main">

          {/* ── Working conditions ── */}
          <div className="jd2-card">
            <h2 className="jd2-card__title">Điều kiện làm việc</h2>
            <div className="jd2-info-grid">
              <div className="jd2-info-row">
                <span className="jd2-info-icon"><Briefcase size={14} strokeWidth={1.8} /></span>
                <div>
                  <div className="jd2-info-label">Mức lương</div>
                  <div className="jd2-info-val jd2-info-val--salary">{job.salary || 'Thỏa thuận'}</div>
                </div>
              </div>
              <div className="jd2-info-row">
                <span className="jd2-info-icon"><MapPin size={14} strokeWidth={1.8} /></span>
                <div>
                  <div className="jd2-info-label">Địa điểm</div>
                  <div className="jd2-info-val">{job.location}</div>
                </div>
              </div>
              <div className="jd2-info-row">
                <span className="jd2-info-icon"><Clock size={14} strokeWidth={1.8} /></span>
                <div>
                  <div className="jd2-info-label">Giờ làm việc</div>
                  <div className="jd2-info-val">{job.hours || 'Thỏa thuận'}</div>
                </div>
              </div>
              <div className="jd2-info-row">
                <span className="jd2-info-icon"><Calendar size={14} strokeWidth={1.8} /></span>
                <div>
                  <div className="jd2-info-label">Ngày làm việc</div>
                  <div className="jd2-info-val">{job.workDays || 'Thỏa thuận'}</div>
                </div>
              </div>
              {job.workPeriod && (
                <div className="jd2-info-row">
                  <span className="jd2-info-icon"><Briefcase size={14} strokeWidth={1.8} /></span>
                  <div>
                    <div className="jd2-info-label">Hình thức</div>
                    <div className="jd2-info-val">{job.workPeriod}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Recruitment conditions ── */}
          <div className="jd2-card">
            <h2 className="jd2-card__title">Điều kiện tuyển dụng</h2>
            <div className="jd2-info-grid">
              <div className="jd2-info-row">
                <span className="jd2-info-icon"><Timer size={14} strokeWidth={1.8} /></span>
                <div>
                  <div className="jd2-info-label">Hạn nộp hồ sơ</div>
                  <div className="jd2-info-val">{formatDeadlineVi(job.applicationDeadline)}</div>
                </div>
              </div>
              <div className="jd2-info-row">
                <span className="jd2-info-icon"><Users size={14} strokeWidth={1.8} /></span>
                <div>
                  <div className="jd2-info-label">Số lượng tuyển</div>
                  <div className="jd2-info-val">{job.numHires || 'Tuyển nhiều vị trí'}</div>
                </div>
              </div>
              <div className="jd2-info-row">
                <span className="jd2-info-icon"><GraduationCap size={14} strokeWidth={1.8} /></span>
                <div>
                  <div className="jd2-info-label">Học vấn</div>
                  <div className="jd2-info-val">{job.education || 'Không yêu cầu'}</div>
                </div>
              </div>
              <div className="jd2-info-row">
                <span className="jd2-info-icon"><Briefcase size={14} strokeWidth={1.8} /></span>
                <div>
                  <div className="jd2-info-label">Kinh nghiệm</div>
                  <div className="jd2-info-val">{job.preference || 'Không yêu cầu kinh nghiệm'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Description ── */}
          {(job.imageUrl || (job.description && !job.description.startsWith('http'))) && (
            <div className="jd2-card jd2-card--desc">
              <h2 className="jd2-card__title">Mô tả công việc</h2>
              <div className="jd2-card__body">
                {job.imageUrl && (
                  <>
                    <img src={job.imageUrl} alt={job.title} className="jd2-desc-img" />
                    {job.images?.filter((u: string) => u !== job.imageUrl).map((url: string, i: number) => (
                      <img key={i} src={url} alt={`${job.title} ${i + 2}`} className="jd2-desc-img" />
                    ))}
                  </>
                )}
                {job.description && <DescriptionRenderer text={job.description} />}
              </div>
            </div>
          )}

          {/* ── Map ── */}
          {coords && (
            <div className="jd2-card">
              <h2 className="jd2-card__title">Khu vực làm việc</h2>
              <div className="jd2-card__body">
                <p className="jd2-map-addr">
                  <MapPin size={13} strokeWidth={1.8} />
                  {job.location}
                </p>
                <JobLocationMap lat={coords.lat!} lng={coords.lng!} title={job.title} />
                <p className="jd2-map-note">Bản đồ mang tính minh họa, có thể không trùng khớp chính xác địa chỉ công ty.</p>
              </div>
            </div>
          )}

          <CompanyReviews company={job.company} />
        </div>

        {/* ── Sidebar ── */}
        <aside className="jd2-aside">
          {/* Salary */}
          <div className="jd2-aside-salary">
            <span className="jd2-aside-salary__label">Mức lương</span>
            <span className="jd2-aside-salary__val">{job.salary || 'Thỏa thuận'}</span>
          </div>

          {/* Deadline */}
          <div className="jd2-aside-row">
            <span className="jd2-aside-row__label">Hạn nộp hồ sơ</span>
            <span className="jd2-aside-row__val">{formatDeadlineVi(job.applicationDeadline)}</span>
          </div>

          <div className="jd2-aside-divider" />

          {/* Primary CTA — Apply */}
          <button
            type="button"
            className="jd2-btn-apply"
            onClick={onOneClickApply}
            disabled={applied}
          >
            {applied ? 'Đã ứng tuyển' : 'Ứng tuyển ngay'}
          </button>
          <span className="jd2-aside-hint">Ứng tuyển nhanh bằng CV đã lưu trong Hồ sơ</span>

          {/* Zalo */}
          {job.employerPhone && (
            <a href={zaloHref} target="_blank" rel="noopener noreferrer" className="jd2-btn-zalo">
              <MessageCircle size={17} strokeWidth={2} />
              Chat qua Zalo
            </a>
          )}

          {/* Phone */}
          {job.employerPhone && (
            <a href={`tel:${job.employerPhone.replace(/\s/g, '')}`} className="jd2-btn-phone">
              <Phone size={15} strokeWidth={1.8} />
              {job.employerPhone}
            </a>
          )}

          {/* Message employer */}
          {showMessageCta && (
            <button type="button" className="jd2-btn-ghost" onClick={() => setMessageOpen(true)}>
              Nhắn tin nhà tuyển dụng
            </button>
          )}

          {/* Save */}
          <button
            type="button"
            className={`jd2-btn-ghost jd2-btn-ghost--save${saved ? ' active' : ''}`}
            onClick={onToggleSave}
          >
            {saved
              ? <><BookmarkCheck size={15} strokeWidth={1.8} /> Đã lưu tin</>
              : <><Bookmark size={15} strokeWidth={1.8} /> Lưu tin</>
            }
          </button>
        </aside>
      </div>

      <Toast message={toastMsg} open={toastOpen} onClose={() => setToastOpen(false)} />
      <MessageEmployerModal open={messageOpen} job={job} user={user} onClose={() => setMessageOpen(false)} />
    </div>
  )
}
