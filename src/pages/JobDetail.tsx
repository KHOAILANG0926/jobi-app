import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  MapPin, Timer, Award, GraduationCap, Users, Clock, Calendar, Briefcase, Building2,
  Bookmark, BookmarkCheck, Phone, MessageCircle, ChevronLeft, ChevronDown,
} from 'lucide-react'
import { CompanyReviews } from '../components/CompanyReviews'
import JobLocationMap from '../components/JobLocationMap'
import { MessageEmployerModal } from '../components/MessageEmployerModal'
import { Toast } from '../components/Toast'
import { useAuth } from '../context/AuthContext'
import { ReportButton } from '../components/ReportButton'
import { CATEGORY_LABELS } from '../data/categories'
import { useJobs } from '../context/JobsContext'
import { addApplication, hasAppliedToJob } from '../lib/applicationsStorage'
import { formatDeadlineVi, zaloMeUrl } from '../lib/jobUtils'
import { isJobSaved, toggleSavedJobId } from '../lib/storage'

function nonEmpty(v: string | null | undefined): string | undefined {
  const t = v?.trim()
  return t ? t : undefined
}

/* ── Description renderer ── */
// Quyền lợi 섹션에서 급여/보상 관련 문구는 눈에 띄게 볼드 처리
const BENEFIT_HIGHLIGHT_RE = /lương|thưởng|thu nhập|phụ cấp|bảo hiểm/i

// 원본 Quyền lợi 텍스트에 실제로 언급된 항목만 compact chip으로 요약 — 목록에 없는 복지를 임의 추가하지 않는다.
const BENEFIT_CHIP_RULES: { label: string; re: RegExp }[] = [
  { label: 'BHXH / BHYT', re: /bhxh|bhyt|bảo hiểm xã hội|bảo hiểm y tế/i },
  { label: 'Thưởng', re: /thưởng/i },
  { label: 'Đào tạo', re: /đào tạo|training/i },
  { label: 'Khám sức khỏe', re: /khám sức kh(ỏe|oẻ)/i },
  { label: 'Du lịch', re: /du lịch/i },
  { label: 'Nghỉ phép', re: /nghỉ phép/i },
]

function DescriptionRenderer({ text }: { text: string }) {
  if (text.startsWith('http')) return null
  const blocks = text.split(/\n\n+/)
  return (
    <>
      {blocks.map((block, i) => {
        if (block.startsWith('## ')) {
          const [heading, ...lines] = block.split('\n')
          const headingText = heading.replace('## ', '')
          const isBenefits = /quyền lợi/i.test(headingText)
          const chips = isBenefits
            ? BENEFIT_CHIP_RULES.filter((r) => r.re.test(lines.join(' '))).map((r) => r.label)
            : []
          return (
            <div key={i} className="jd2-card jd2-desc-card">
              <h2 className="jd2-card__title">{headingText}</h2>
              <div className="jd2-card__body">
                {chips.length > 0 && (
                  <div className="jd2-chips">
                    {chips.map((c) => <span key={c} className="jd2-chip-benefit">{c}</span>)}
                  </div>
                )}
                <ul className="jd2-desc__list">
                  {lines.map((line, j) => {
                    if (line.startsWith('• ')) {
                      const content = line.replace('• ', '')
                      const highlight = isBenefits && BENEFIT_HIGHLIGHT_RE.test(content)
                      return (
                        <li key={j} className={`jd2-desc__item${highlight ? ' jd2-desc__item--highlight' : ''}`}>
                          {content}
                        </li>
                      )
                    }
                    return line.trim() ? <p key={j} className="jd2-desc__line">{line}</p> : null
                  })}
                </ul>
              </div>
            </div>
          )
        }
        return (
          <div key={i} className="jd2-card jd2-desc-card">
            <div className="jd2-card__body">
              <p className="jd2-desc__para">{block}</p>
            </div>
          </div>
        )
      })}
    </>
  )
}

type InfoField = { key: string; icon: ReactNode; label: string; value: string }

export function JobDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { jobs } = useJobs()
  const [saved, setSaved] = useState(() => (id ? isJobSaved(id) : false))
  const [messageOpen, setMessageOpen] = useState(false)
  const [toastOpen, setToastOpen] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const [applied, setApplied] = useState(false)
  const [applying, setApplying] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)

  const job = useMemo(() => jobs.find((j) => j.id === id), [jobs, id])

  useEffect(() => {
    // 크롤링 공고(employerId 없음)는 내부 지원을 아예 만들지 않으므로 조회도 스킵
    if (!job || !job.employerId) return
    let cancelled = false
    hasAppliedToJob(job.id, user?.id).then((v) => { if (!cancelled) setApplied(v) })
    return () => { cancelled = true }
  }, [job?.id, job?.employerId, user?.id])

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
  const showMessageCta = !!job.employerId && user?.role !== 'employer'

  // 크롤링 공고(local_jobs.employer_id가 NULL)는 소유 기업이 없어 내부 지원을 만들면
  // 아무도 조회할 수 없는 "고아 지원"이 되므로 생성하지 않는다.
  // 크롤러가 본문 없이 원본 링크만 저장한 경우 description 자체가 URL이 되는 기존 패턴
  // (DescriptionRenderer의 text.startsWith('http') 처리와 동일)을 그대로 활용.
  const canApplyInternally = !!job.employerId
  const sourceUrl = !canApplyInternally && job.description?.startsWith('http')
    ? job.description
    : undefined

  const onOneClickApply = async () => {
    if (!user) {
      navigate('/dang-nhap', { state: { from: `/viec-lam/${job.id}` } })
      return
    }
    if (applying) return
    setApplying(true)
    try {
      if (await hasAppliedToJob(job.id, user.id)) {
        setApplied(true)
        setToastMsg('Bạn đã ứng tuyển tin này trước đó.')
        setToastOpen(true)
        return
      }
      const res = await addApplication({ jobId: job.id, jobTitle: job.title, company: job.company, employerId: job.employerId, seekerId: user.id })
      if (res.ok) {
        setApplied(true)
        setToastMsg('Đã ứng tuyển thành công!')
        setToastOpen(true)
      } else if (res.reason === 'duplicate') {
        setApplied(true)
        setToastMsg('Bạn đã ứng tuyển tin này trước đó.')
        setToastOpen(true)
      } else {
        setToastMsg('Có lỗi xảy ra, vui lòng thử lại.')
        setToastOpen(true)
      }
    } finally {
      setApplying(false)
    }
  }

  const onApplyClick = () => {
    if (canApplyInternally) {
      onOneClickApply()
      return
    }
    if (sourceUrl) {
      window.open(sourceUrl, '_blank', 'noopener,noreferrer')
      return
    }
    setToastMsg('Tin này chưa hỗ trợ ứng tuyển trực tuyến. Vui lòng liên hệ trực tiếp qua thông tin công ty.')
    setToastOpen(true)
  }

  const applyLabel = canApplyInternally
    ? (applied ? 'Đã ứng tuyển' : applying ? 'Đang gửi...' : 'Ứng tuyển ngay')
    : (sourceUrl ? 'Xem tin gốc & Ứng tuyển ↗' : 'Ứng tuyển ngay')

  const applyHint = canApplyInternally
    ? 'Ứng tuyển nhanh bằng CV đã lưu trong Hồ sơ'
    : sourceUrl
      ? 'Tin từ nguồn bên ngoài — ứng tuyển trực tiếp tại trang gốc'
      : 'Vui lòng liên hệ trực tiếp qua thông tin công ty bên dưới'

  const catLabel = CATEGORY_LABELS[job.category] ?? job.category

  // ── 빈 데이터 처리: 원본이 명시적으로 채운 값만 표시, 나머지는 필드 자체를 숨긴다 ──
  const salaryText = nonEmpty(job.rawSalary)
  const locationText = nonEmpty(job.rawLocation)
  const preferenceText = nonEmpty(job.rawPreference)
  const educationText = nonEmpty(job.rawEducation)
  const numHiresText = nonEmpty(job.numHires)
  const hoursText = nonEmpty(job.hours)
  const workDaysText = nonEmpty(job.workDays)
  const workPeriodText = nonEmpty(job.workPeriod)
  const deadlineText = formatDeadlineVi(job.applicationDeadline)

  const summaryParts = [salaryText, locationText, preferenceText, workPeriodText].filter(Boolean) as string[]

  const infoFields: InfoField[] = [
    salaryText && { key: 'salary', icon: <Briefcase size={14} strokeWidth={1.8} />, label: 'Mức lương', value: salaryText },
    locationText && { key: 'location', icon: <MapPin size={14} strokeWidth={1.8} />, label: 'Địa điểm', value: locationText },
    { key: 'deadline', icon: <Timer size={14} strokeWidth={1.8} />, label: 'Hạn nộp hồ sơ', value: deadlineText },
    preferenceText && { key: 'preference', icon: <Award size={14} strokeWidth={1.8} />, label: 'Kinh nghiệm', value: preferenceText },
    educationText && { key: 'education', icon: <GraduationCap size={14} strokeWidth={1.8} />, label: 'Học vấn', value: educationText },
    numHiresText && { key: 'numHires', icon: <Users size={14} strokeWidth={1.8} />, label: 'Số lượng tuyển', value: numHiresText },
    workPeriodText && { key: 'workPeriod', icon: <Briefcase size={14} strokeWidth={1.8} />, label: 'Hình thức làm việc', value: workPeriodText },
    hoursText && { key: 'hours', icon: <Clock size={14} strokeWidth={1.8} />, label: 'Thời gian làm việc', value: hoursText },
    workDaysText && { key: 'workDays', icon: <Calendar size={14} strokeWidth={1.8} />, label: 'Ngày làm việc', value: workDaysText },
    { key: 'category', icon: <Building2 size={14} strokeWidth={1.8} />, label: 'Ngành nghề', value: catLabel },
  ].filter(Boolean) as InfoField[]

  // 실제 lat/lng이 DB에 있을 때만 지도를 노출한다 — 지역명으로 추정한 좌표는 지도 판단 근거로 쓰지 않는다.
  const hasRealCoords = typeof job.rawLat === 'number' && typeof job.rawLng === 'number'

  const extraImages = job.images?.filter((u) => u !== job.imageUrl) ?? []

  const hasCompanyInfo = !!job.companyVerified || !!job.companyFoundedYear || !!job.hireCount

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
              {locationText && (
                <>
                  <span className="jd2-meta-item">
                    <MapPin size={13} strokeWidth={1.8} />
                    {locationText}
                  </span>
                  <span className="jd2-meta-sep">·</span>
                </>
              )}
              <span className="jd2-meta-item">
                Đăng {new Date(job.postedAt).toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
            {summaryParts.length > 0 && (
              <p className="jd2-summary">{summaryParts.join(' · ')}</p>
            )}
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

          {/* ── Recruitment info (merged) ── */}
          <div className="jd2-card">
            <h2 className="jd2-card__title">Thông tin tuyển dụng</h2>
            <div className="jd2-info-grid">
              {infoFields.map((f) => (
                <div className="jd2-info-row" key={f.key}>
                  <span className="jd2-info-icon">{f.icon}</span>
                  <div>
                    <div className="jd2-info-label">{f.label}</div>
                    <div className={`jd2-info-val${f.key === 'salary' ? ' jd2-info-val--salary' : ''}`}>{f.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Extra photos (excludes the company logo already shown in the header) ── */}
          {extraImages.length > 0 && (
            <div className="jd2-card">
              <div className="jd2-card__body">
                {extraImages.map((url, i) => (
                  <img key={i} src={url} alt={`${job.title} ${i + 1}`} className="jd2-desc-img" />
                ))}
              </div>
            </div>
          )}

          {/* ── Description (Mô tả / Yêu cầu / Quyền lợi — each its own card) ── */}
          {job.description && !job.description.startsWith('http') && (
            <DescriptionRenderer text={job.description} />
          )}

          {/* ── Map ── */}
          {hasRealCoords && (
            <div className="jd2-card">
              <h2 className="jd2-card__title">Địa điểm làm việc</h2>
              <div className="jd2-card__body">
                {locationText && (
                  <p className="jd2-map-addr">
                    <MapPin size={13} strokeWidth={1.8} />
                    {locationText}
                  </p>
                )}
                {mapOpen ? (
                  <>
                    <JobLocationMap lat={job.rawLat!} lng={job.rawLng!} title={job.title} />
                    <p className="jd2-map-note">Bản đồ mang tính minh họa, có thể không trùng khớp chính xác địa chỉ công ty.</p>
                  </>
                ) : (
                  <button type="button" className="jd2-map-toggle" onClick={() => setMapOpen(true)}>
                    <MapPin size={15} strokeWidth={1.8} />
                    Xem bản đồ
                    <ChevronDown size={15} strokeWidth={1.8} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Company info ── */}
          {hasCompanyInfo && (
            <div className="jd2-card">
              <h2 className="jd2-card__title">Thông tin công ty</h2>
              <div className="jd2-card__body jd2-company">
                <div className="jd2-company__logo">
                  {job.imageUrl
                    ? <img src={job.imageUrl} alt={job.company} className="jd2-logo__img" />
                    : <span className="jd2-logo__fallback">{job.company?.[0] ?? 'J'}</span>
                  }
                </div>
                <div className="jd2-company__body">
                  <p className="jd2-company__name">{job.company}</p>
                  <ul className="jd2-company__facts">
                    {job.companyVerified && <li>✓ Doanh nghiệp đã xác minh</li>}
                    {job.companyFoundedYear && <li>Thành lập năm {job.companyFoundedYear}</li>}
                    {job.hireCount !== undefined && job.hireCount > 0 && <li>Đã tuyển: {job.hireCount}</li>}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <CompanyReviews company={job.company} />
        </div>

        {/* ── Sidebar ── */}
        <aside className="jd2-aside">
          {/* Salary */}
          {salaryText && (
            <div className="jd2-aside-salary">
              <span className="jd2-aside-salary__label">Mức lương</span>
              <span className="jd2-aside-salary__val">{salaryText}</span>
            </div>
          )}

          {/* Deadline */}
          <div className="jd2-aside-row">
            <span className="jd2-aside-row__label">Hạn nộp hồ sơ</span>
            <span className="jd2-aside-row__val">{deadlineText}</span>
          </div>

          <div className="jd2-aside-divider" />

          {/* Primary CTA — Apply */}
          <button
            type="button"
            className="jd2-btn-apply"
            onClick={onApplyClick}
            disabled={canApplyInternally && (applied || applying)}
          >
            {applyLabel}
          </button>
          <span className="jd2-aside-hint">{applyHint}</span>

          <ReportButton
            targetType="job"
            targetId={job.id}
            snapshot={{ title: job.title, company: job.company, url: `/viec-lam/${job.id}` }}
          />

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
            <button type="button" className="jd2-btn-zalo jd2-btn-message" onClick={() => setMessageOpen(true)}>
              <MessageCircle size={17} strokeWidth={2} />
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

      {/* ── Mobile floating CTA bar ── */}
      <div className="jd2-mobile-cta">
        {job.employerPhone && (
          <a href={zaloHref} target="_blank" rel="noopener noreferrer" className="jd2-mobile-cta__zalo">
            <MessageCircle size={18} strokeWidth={2} />
            Chat qua Zalo
          </a>
        )}
        <button
          type="button"
          className="jd2-mobile-cta__apply"
          onClick={onApplyClick}
          disabled={canApplyInternally && (applied || applying)}
        >
          {applyLabel}
        </button>
      </div>

      <Toast message={toastMsg} open={toastOpen} onClose={() => setToastOpen(false)} />
      <MessageEmployerModal open={messageOpen} job={job} user={user} onClose={() => setMessageOpen(false)} />
    </div>
  )
}
