import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  MapPin, Timer, Award, GraduationCap, Users, Clock, Calendar, Briefcase, Building2,
  Bookmark, BookmarkCheck, Phone, MessageCircle, ChevronLeft,
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
import { googleMapsLinks, resolveMapLocations, resolveWorkLocationQuery } from '../lib/jobCoords'
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

  // One "## Heading" = one card, no matter how many blank lines sit inside it. The
  // crawler sometimes leaves stray blank lines or an unheaded sub-list (e.g. "Ưu
  // tiên:") in the middle of a section; splitting on every blank line (the previous
  // behavior) turned those stray gaps into extra unheaded cards, fracturing a single
  // MÔ TẢ/YÊU CẦU/QUYỀN LỢI section into several. Splitting on heading boundaries
  // instead keeps everything between one "## " line and the next as one block. Text
  // with no "## " heading at all (unstructured crawler paste) keeps the previous
  // paragraph-per-blank-line behavior, unchanged.
  const hasHeadings = /^## /m.test(text)
  const blocks = hasHeadings ? text.split(/(?=^## )/m) : text.split(/\n\n+/)

  return (
    <>
      {blocks.map((rawBlock, i) => {
        const block = rawBlock.trim()
        if (!block) return null
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
  const { jobs, loading: jobsLoading } = useJobs()
  const [saved, setSaved] = useState(() => (id ? isJobSaved(id) : false))
  const [messageOpen, setMessageOpen] = useState(false)
  const [toastOpen, setToastOpen] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const [applied, setApplied] = useState(false)
  const [applying, setApplying] = useState(false)

  const job = useMemo(() => jobs.find((j) => j.id === id), [jobs, id])

  useEffect(() => {
    // 크롤링 공고(employerId 없음)는 내부 지원을 아예 만들지 않으므로 조회도 스킵
    if (!job || !job.employerId) return
    let cancelled = false
    hasAppliedToJob(job.id, user?.id).then((v) => { if (!cancelled) setApplied(v) })
    return () => { cancelled = true }
  }, [job?.id, job?.employerId, user?.id])

  // jobs는 앱 로드 시 한 번(페이지네이션 포함) 비동기로 불러온다 — 아직 로딩
  // 중일 때 job을 못 찾았다고 "Không tìm thấy"를 바로 띄우면, 직접 URL로 들어오거나
  // 새로고침한 경우(특히 방금 크롤링된 최신 공고) 실제로는 존재하는 공고인데도
  // 일시적으로 없는 것처럼 보이는 문제가 있었음(sb-4313에서 확인). 로딩 중에는
  // 로딩 화면만 보여주고, 로딩이 끝난 뒤에도 못 찾을 때만 진짜 "not found"로 처리.
  if (!id) {
    return (
      <div className="page page--narrow not-found">
        <h1>Không tìm thấy tin tuyển dụng</h1>
        <p>Tin có thể đã gỡ hoặc liên kết không đúng.</p>
        <Link to="/" className="btn btn--primary">Về trang chủ</Link>
      </div>
    )
  }

  if (!job) {
    if (jobsLoading) {
      return <div className="page page--narrow" role="status" style={{ textAlign: 'center', padding: '64px 24px' }}>Đang tải...</div>
    }
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
  // 원본 링크는 local_jobs.source_url(신규 backfill로 채워지는 값)을 우선 쓰고,
  // 없는 옛날 데이터는 description 자체가 URL이던 기존 패턴으로 fallback한다
  // (DescriptionRenderer의 text.startsWith('http') 처리와 동일 — 회귀 방지).
  const canApplyInternally = !!job.employerId
  const sourceUrl = canApplyInternally
    ? undefined
    : job.sourceUrl || (job.description?.startsWith('http') ? job.description : undefined)

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

  // 2026-09-05 최종 제품 정책: "모든 공개 공고에 근무지역 텍스트, 지도,
  // 길찾기를 제공한다" — 좌표 검증 여부는 이제 공개 여부가 아니라 지도
  // 표시 방식(정확한 마커 vs 근사 위치)과 거리검색 자격만 결정한다.
  // resolveMapLocations()가 근무지/모집지역/레거시 단일점까지 전부 포함한
  // 최종 우선순위를 이미 계산해준다 — 이 컴포넌트는 그 결과 하나만 쓰면
  // 된다(예전처럼 mapLocation/mapCenter를 별도로 다시 계산하지 않는다).
  const mapLocations = resolveMapLocations(job)
  // 'default'(위치 정보가 전혀 없어 베트남 전체 중심으로 떨어진 경우)만
  // 지도를 숨긴다 — 그 외(exact/address/region)는 전부 무언가 실제 위치
  // 정보에 기반한 점이므로 근사치임을 문구로 밝히고 항상 지도를 그린다.
  const hasMapPoints = mapLocations.points.length > 0 && mapLocations.source !== 'default'
  const mapCenter = mapLocations.points[0]
  // 주소 "텍스트 목록" 표시는 좌표(geocoding) 유무와 무관하게 원본에 근무지가
  // 있으면 항상 보여준다.
  const hasWorkLocationList = (job.workLocations?.length ?? 0) > 0
  // 근무지 목록도 없고 모집지역도 없는 완전 레거시 케이스(job.location
  // 텍스트만 있음)에서만 쓰는 단일 Google Maps 링크 — 근무지가 있으면 각
  // 주소별로, 모집지역만 있으면 지역별로 따로 만든다(아래 렌더링 부분).
  const hasRecruitmentRegionsOnly = !hasWorkLocationList && (job.recruitmentRegions?.length ?? 0) > 0
  const singleLocationGmaps =
    !hasWorkLocationList && !hasRecruitmentRegionsOnly && locationText
      ? googleMapsLinks(`${locationText}, Vietnam`)
      : null

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

          {/* ── Location / Map — always shown open, at the best accuracy the job data allows ── */}
          <div className="jd2-card">
            <h2 className="jd2-card__title">Khu vực làm việc</h2>
            <div className="jd2-card__body">
              {!hasWorkLocationList && !hasRecruitmentRegionsOnly && !locationText ? (
                // 근무지도, 모집지역도, 텍스트 위치도 전부 없는 경우에만 안내 문구만
                // 표시한다(정책: "근무지와 모집지역 모두 없음" — 사실 이 조합은 공개
                // 게이트 자체가 no_address_text로 막으므로 공개된 공고에서는 거의
                // 발생하지 않지만, 방어적으로 유지).
                <p className="jd2-map-unknown">Không thể xác định chính xác khu vực làm việc cho tin tuyển dụng này.</p>
              ) : (
                <>
                  {hasWorkLocationList ? (
                    // 항목별로 coordinate_accuracy/address_accuracy가 다를 수 있다 —
                    // 상세주소 텍스트와 길찾기는 정확도와 무관하게 항상 보여준다
                    // (2026-09-05 최종 정책: "모든 위치 등급에서 길찾기 링크 표시").
                    // googleMapsLinks()는 좌표를 전혀 쓰지 않는 텍스트 검색 기반이라
                    // 신뢰도와 무관하게 항상 안전하다.
                    <ul className="jd2-map-addr-list">
                      {job.workLocations?.map((loc) => {
                        const gmaps = googleMapsLinks(resolveWorkLocationQuery(loc, job.location))
                        const tier = loc.coordinateAccuracy ?? 'unresolved'
                        const verifiedWard = tier === 'ward' && loc.locationVerified === true
                        const isPreciseLoc = tier === 'exact' || verifiedWard
                        const isRegionOnlyText = loc.addressAccuracy === 'region_only'
                        return (
                          <li key={loc.id} className="jd2-map-addr-item">
                            <p className="jd2-map-addr">
                              <MapPin size={13} strokeWidth={1.8} />
                              {loc.rawAddress}
                            </p>
                            {loc.matchedRecruitmentRegions && loc.matchedRecruitmentRegions.length > 1 && (
                              <p className="jd2-map-recruitment-regions">
                                Tuyển tại: {loc.matchedRecruitmentRegions.join(', ')}
                              </p>
                            )}
                            {isRegionOnlyText ? (
                              // Tier C/D — 성·시 또는 구·군·동만 있는 텍스트, 구체적
                              // 상세주소가 아니다. 거리검색에도 쓰이지 않는다.
                              <p className="jd2-map-ward-note">
                                Vị trí gần đúng theo khu vực hành chính (tỉnh/thành hoặc quận/huyện) — không phải địa chỉ chi tiết, không dùng để tính khoảng cách chính xác.
                              </p>
                            ) : verifiedWard ? (
                              // Tier A(원문 좌표로 확인된 근무구역) — exact와 동일한
                              // 정밀도를 주장하지 않되, 확인된 위치임은 밝힌다.
                              <p className="jd2-map-verified-ward-note">
                                Khu vực làm việc đã xác nhận — có thể chưa phải vị trí chính xác của tòa nhà.
                              </p>
                            ) : tier !== 'exact' ? (
                              // Tier B — 구체적 주소 텍스트는 있으나 좌표 미검증.
                              <p className="jd2-map-ward-note">
                                Vị trí gần đúng — địa chỉ cụ thể chưa được xác minh tọa độ chính xác, không dùng để tính khoảng cách.
                              </p>
                            ) : null}
                            <div className="jd2-map-gmaps-links">
                              <a href={gmaps.view} target="_blank" rel="noopener noreferrer">Xem trên bản đồ lớn ↗</a>
                              <a href={gmaps.directions} target="_blank" rel="noopener noreferrer">Chỉ đường ↗</a>
                            </div>
                            {isPreciseLoc && (
                              <p className="jd2-map-exact-note">Vị trí chính xác.</p>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  ) : hasRecruitmentRegionsOnly ? (
                    // Tier E — 원문 근무지 행이 0건, 모집지역만 있음. 지역별로 각각
                    // 안내 문구 + 길찾기 링크를 제공한다(하나의 좌표를 여러 지역에
                    // 복제하지 않음 — 지역마다 자기 이름으로 직접 Google Maps 검색).
                    <>
                      <p className="jd2-map-recruitment-regions-only-note">
                        Tin này chưa có địa chỉ làm việc chi tiết — hiển thị theo khu vực tuyển dụng.
                      </p>
                      <ul className="jd2-map-addr-list">
                        {job.recruitmentRegions?.map((region) => {
                          const gmaps = googleMapsLinks(`${region}, Vietnam`)
                          return (
                            <li key={region} className="jd2-map-addr-item">
                              <p className="jd2-map-addr">
                                <MapPin size={13} strokeWidth={1.8} />
                                {region}
                              </p>
                              <div className="jd2-map-gmaps-links">
                                <a href={gmaps.view} target="_blank" rel="noopener noreferrer">Xem trên bản đồ lớn ↗</a>
                                <a href={gmaps.directions} target="_blank" rel="noopener noreferrer">Chỉ đường ↗</a>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    </>
                  ) : (
                    locationText && (
                      <>
                        <p className="jd2-map-addr">
                          <MapPin size={13} strokeWidth={1.8} />
                          {locationText}
                        </p>
                        {/* job_work_locations도 recruitmentRegions도 없는 완전 레거시
                            케이스 — 길찾기는 등급과 무관하게 항상 보여준다(2026-09-05
                            정책: "길찾기는 어떤 위치 등급에서도 숨기지 않는다"). */}
                        {singleLocationGmaps && (
                          <div className="jd2-map-gmaps-links">
                            <a href={singleLocationGmaps.view} target="_blank" rel="noopener noreferrer">Xem trên bản đồ lớn ↗</a>
                            <a href={singleLocationGmaps.directions} target="_blank" rel="noopener noreferrer">Chỉ đường ↗</a>
                          </div>
                        )}
                      </>
                    )
                  )}
                  {/* 내부 지도는 'default'(위치 정보가 전혀 없어 베트남 전체 중심으로
                      떨어진 경우)만 아니면 항상 그린다 — 정확한 마커든 근사 위치든
                      resolveMapLocations()가 이미 우선순위대로 골라준 점들이다. */}
                  {hasMapPoints && mapCenter && (
                    <>
                      <JobLocationMap
                        lat={mapCenter.lat}
                        lng={mapCenter.lng}
                        title={job.title}
                        zoom={mapLocations.zoom}
                        extraMarkers={mapLocations.points}
                      />
                      <p className="jd2-map-note">
                        {mapLocations.source === 'exact'
                          ? mapLocations.points.length > 1
                            ? `Công việc này có ${mapLocations.points.length} địa điểm làm việc.`
                            : 'Vị trí chính xác trên bản đồ.'
                          : mapLocations.source === 'address'
                            ? 'Vị trí gần đúng dựa trên địa chỉ — chưa được xác minh chính xác.'
                            : 'Vị trí gần đúng theo khu vực — bản đồ mang tính minh họa, không phải địa chỉ chi tiết.'}
                      </p>
                    </>
                  )}
                </>
              )}
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
