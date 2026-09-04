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
import { googleMapsLinks, resolveMapLocation, resolveMapLocations, resolveWorkLocationQuery } from '../lib/jobCoords'
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

  // 지도는 항상 표시한다 — 우선순위: 실제 DB lat/lng > location 텍스트가 매칭되는 지역
  // 중심 > 위치 정보가 전혀 없으면 베트남 전체 중심. marker도 항상 그리되, 실제 좌표가
  // 아닐 때는 안내 문구로 근사치임을 항상 함께 밝힌다(가짜 위치를 실제처럼 보이지 않게).
  const mapLocation = resolveMapLocation(job)
  // Additive multi-marker resolution — only differs from mapLocation when the job has
  // 1+ geocoded job_work_locations rows; otherwise it collapses to the same single point.
  const mapLocations = resolveMapLocations(job)
  // 1개만 geocode돼도 그 실제 위치를 보여준다 — "다중"일 때만이 아니라 "1개
  // 이상"이 기준. 0개면 mapLocations.points가 기존 region/default 단일점으로
  // 그대로 collapse되므로(resolveMapLocations 자체 로직) 이 값도 자연히 false.
  const hasGeocodedWorkLocations = mapLocations.points.length >= 1 && mapLocations.source === 'exact'
  // 지도 중심 — geocode된 근무지가 있으면 그 지점(들)을, 없으면 기존 region/default
  // 단일 지점을 그대로 쓴다. 2개 이상이면 JobLocationMap의 fitBounds가 최종 화면을
  // 다시 맞추므로, 여기서는 첫 지점을 초기 중심으로만 쓰면 된다.
  const mapCenter = hasGeocodedWorkLocations ? mapLocations.points[0] : mapLocation
  // 주소 "텍스트 목록" 표시는 좌표(geocoding) 유무와 무관하게 원본에 근무지가
  // 있으면 항상 보여준다 — 마커 개수(hasGeocodedWorkLocations)와는 별개 기준.
  const hasWorkLocationList = (job.workLocations?.length ?? 0) > 0
  // 근무지 목록이 없을 때(region/default fallback)만 쓰는 단일 Google Maps 링크 —
  // 근무지가 있으면 각 주소별로 따로 만든다(아래 렌더링 부분).
  // 이 경로는 job_work_locations가 없는 경우(지역명 텍스트만 있음)라
  // locationText 자체가 이미 "상위 시·도" 수준이다 — 원문 위치와 상위 시·도가
  // 같은 값으로 겹치지만, 국가 표기(Vietnam)는 항상 명시적으로 덧붙인다.
  const singleLocationGmaps = !hasWorkLocationList && locationText ? googleMapsLinks(`${locationText}, Vietnam`) : null
  // job_work_locations가 있는 공고는 항목별로 coordinate_accuracy가 다를 수 있다
  // (예: 한 공고가 여러 지역을 커버하면서 어떤 주소는 exact, 어떤 주소는 unresolved).
  // 상세주소 텍스트는 정확도와 무관하게 전부 그대로 보여주되, 지도 마커는 exact/ward
  // 좌표를 가진 항목에만 찍는다 — region/unresolved는 내부 지도를 아예 숨기고
  // 외부 Google 지도 검색 링크만 제공한다(공개 게이트가 exact geocode를 더 이상
  // 요구하지 않으므로, 상세주소는 있지만 좌표를 못 찾은 공고가 실제로 존재한다).
  const mappableWorkLocations = (job.workLocations ?? []).filter(
    (l): l is typeof l & { lat: number; lng: number } => typeof l.lat === 'number' && typeof l.lng === 'number',
  )
  const hasMappableWorkLocations = mappableWorkLocations.length > 0

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
              {!hasWorkLocationList && !locationText ? (
                // 위치 정보가 전혀 없을 때: 임의 좌표(fallback 대도시 등)로 지도를
                // 그리지 않는다 — 실제 근무지가 아닌 곳에 마커가 찍히면 사용자가
                // 그걸 실제 위치로 오해할 수 있기 때문 (sb-4312/sb-4313에서 실제
                // 발생했던 문제의 근본 원인). 지도 대신 명확한 안내 문구만 표시.
                <p className="jd2-map-unknown">Không thể xác định chính xác khu vực làm việc cho tin tuyển dụng này.</p>
              ) : (
                <>
                  {hasWorkLocationList ? (
                    // 항목별로 coordinate_accuracy가 다를 수 있다 — 상세주소 텍스트와
                    // 길찾기는 정확도와 무관하게 항상 보여준다(2026-09-04 사용자 지시
                    // "길찾기 정책 수정": "location_verified=false인 ward도 길찾기
                    // 버튼을 숨기지 않음 — 마커와 정확한 거리 계산만 제외. 길찾기는
                    // 좌표 대신 raw_address + 상위 시·도 + Vietnam 텍스트 검색으로
                    // 실행"). googleMapsLinks()는 좌표를 전혀 쓰지 않는 텍스트 검색
                    // 기반이라 신뢰도와 무관하게 항상 안전하다. 내부 지도 마커·정확한
                    // 거리 계산만 'exact' 또는 locationVerified===true인 'ward'로
                    // 제한된다(loc.lat/lng 자체가 JobsContext에서 이미 그렇게 걸러져
                    // 있음 — mappableWorkLocations 참고).
                    <ul className="jd2-map-addr-list">
                      {job.workLocations?.map((loc) => {
                        const gmaps = googleMapsLinks(resolveWorkLocationQuery(loc, job.location))
                        const isMappable = typeof loc.lat === 'number' && typeof loc.lng === 'number'
                        const tier = loc.coordinateAccuracy ?? (isMappable ? 'exact' : 'unresolved')
                        // location_verified=true인 'ward'는 지도 마커는 쓸 수 있지만
                        // 'exact'로 표시하지 않는다 — 사용자 지시("location_verified=true인
                        // ward"): "지도 사용은 가능하지만 exact라고 표시하지 않음 / UI
                        // 라벨은 '근무구역 확인' / 정확한 거리라고 단정하지 않음."
                        const verifiedWard = tier === 'ward' && loc.locationVerified === true
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
                            {verifiedWard && (
                              <p className="jd2-map-verified-ward-note">
                                Khu vực làm việc đã xác nhận — có thể chưa phải vị trí chính xác của tòa nhà.
                              </p>
                            )}
                            {tier === 'ward' && !verifiedWard && (
                              <p className="jd2-map-ward-note">
                                Vị trí gần đúng theo khu vực (quận/huyện) — không phải vị trí chính xác của tòa nhà.
                              </p>
                            )}
                            <div className="jd2-map-gmaps-links">
                              <a href={gmaps.view} target="_blank" rel="noopener noreferrer">Xem trên bản đồ lớn ↗</a>
                              <a href={gmaps.directions} target="_blank" rel="noopener noreferrer">Chỉ đường ↗</a>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    locationText && (
                      <>
                        <p className="jd2-map-addr">
                          <MapPin size={13} strokeWidth={1.8} />
                          {locationText}
                        </p>
                        {/* job_work_locations가 아예 없는 레거시 공고 — mapLocation.source가
                            'exact'(공고 자체 lat/lng)일 때만 검증된 위치로 보고 길찾기까지
                            보여준다. 'region'/'default'는 지역명 텍스트로 추측한 좌표일 뿐이므로
                            내부 지도·마커·길찾기를 전혀 만들지 않고 외부 검색 링크만 제공한다. */}
                        {singleLocationGmaps && (
                          <div className="jd2-map-gmaps-links">
                            {mapLocation.source === 'exact' ? (
                              <>
                                <a href={singleLocationGmaps.view} target="_blank" rel="noopener noreferrer">Xem trên bản đồ lớn ↗</a>
                                <a href={singleLocationGmaps.directions} target="_blank" rel="noopener noreferrer">Chỉ đường ↗</a>
                              </>
                            ) : (
                              <a href={singleLocationGmaps.view} target="_blank" rel="noopener noreferrer">Tìm địa chỉ trên Google Maps ↗</a>
                            )}
                          </div>
                        )}
                      </>
                    )
                  )}
                  {/* 내부 지도는 검증된 좌표가 있을 때만 그린다:
                      - job_work_locations가 있으면 exact/ward 마커가 1개라도 있을 때만
                      - job_work_locations가 없으면 공고 자체에 실제 lat/lng(source==='exact')가
                        있을 때만 — 지역명 추측 좌표(region/default)로는 지도를 그리지 않는다. */}
                  {((hasWorkLocationList && hasMappableWorkLocations) ||
                    (!hasWorkLocationList && locationText && mapLocation.source === 'exact')) && (
                    <>
                      <JobLocationMap
                        lat={mapCenter.lat}
                        lng={mapCenter.lng}
                        title={job.title}
                        zoom={mapLocations.zoom}
                        extraMarkers={hasGeocodedWorkLocations ? mapLocations.points : undefined}
                      />
                      <p className="jd2-map-note">
                        {hasGeocodedWorkLocations
                          ? `Công việc này có ${mapLocations.points.length} địa điểm làm việc.`
                          : 'Bản đồ mang tính minh họa, có thể không trùng khớp chính xác địa chỉ công ty.'}
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
