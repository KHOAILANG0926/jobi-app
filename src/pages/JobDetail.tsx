import { useCallback, useEffect, useMemo, useState, type ComponentType, type CSSProperties, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  MapPin, Timer, Award, GraduationCap, Users, Clock, Calendar, Briefcase, Building2,
  Bookmark, BookmarkCheck, Phone, MessageCircle, ChevronLeft,
} from 'lucide-react'
import { CompanyReviews } from '../components/CompanyReviews'
import type { JobVietMapProps } from '../components/JobVietMap'
import { MessageEmployerModal } from '../components/MessageEmployerModal'
import { Toast } from '../components/Toast'
import { useAuth } from '../context/AuthContext'
import { ReportButton } from '../components/ReportButton'
import { CATEGORY_LABELS } from '../data/categories'
import { useJobs } from '../context/JobsContext'
import { addApplication, hasAppliedToJob } from '../lib/applicationsStorage'
import { buildProfile } from '../components/useApply'
import { ApplyUnavailableNotice } from '../components/ApplyUnavailableNotice'
import { snapshotCvPhotoForApplication } from '../lib/accountCvStorage'
import { formatDeadlineVi, JOB_CONTACT_HASH, resolveApplyAction, resolveApplyRoute, zaloMeUrl } from '../lib/jobUtils'
import { fetchEmployerJobCount } from '../lib/jobRows'
import { externalMapLinks, findRegionCenter, isVerifiedWorkLocation, resolveMapLocations, workLocationExternalLinks, type ExternalMapLinks } from '../lib/jobCoords'
import { isJobSaved, toggleSavedJobId } from '../lib/storage'
import { recordJobView } from '../lib/viewHistoryStorage'
import { companyLogoUrl } from '../lib/companyLogo'
import { companyKeyFromName } from '../lib/reviewsStorage'
import { JOB_SECTION_LABELS, JOB_SECTION_ORDER, JOB_TABS, SALARY_BASIS_LABEL, EMPLOYMENT_TYPE_LABEL, benefitList, contactOf, deadlineBadge, isGenericCompanyName, salaryPeriodLabel, jobSectionId, jobTags, shiftLabel, tabOfSection, weekendLabel, type JobTabKey } from '../lib/jobDetailView'
import { descriptionRows } from '../lib/jobDescriptionRows'
import { planDirections } from '../lib/directionsPlan'
import { findIndustrialPark, industrialParkDirectionsNote, industrialParkDirectionsUrl } from '../lib/industrialPark'
import type { JobSection } from '../data/jobSchema'

function nonEmpty(v: string | null | undefined): string | undefined {
  const t = v?.trim()
  return t ? t : undefined
}

// 2026-09-22 실제 브라우저로 hydration을 검증하다가 발견 — React.lazy()+
// Suspense로 지도를 감싸는 건 SSR에 안 맞았다. entry-server.tsx는
// renderToString(구식 동기 API)을 쓰는데, 이 API는 "아직 안 끝난
// Suspense"를 아예 지원하지 않아서(공식 에러 메시지: "The server used
// renderToString which does not support Suspense" — renderToPipeableStream
// 같은 스트리밍 API에서만 지원됨) fallback을 얌전히 보여주는 대신 그
// 자리를 "에러난 경계"로 취급해버렸다. 그 결과 (1) hydration이 페이지
// 전체 단위로 깨지고(React error #418/#423, 브라우저 DOM diff로 실측)
// (2) 에러 마커 안에 서버 파일 절대경로가 담긴 스택 트레이스가 그대로
// 공개 HTML에 노출되는 문제까지 있었다(curl로 직접 확인). Suspense/lazy를
// 아예 안 쓰고, "클라이언트에서 마운트된 뒤에만 실제로 import하는" 평범한
// useEffect 패턴으로 바꿨다 — 서버는 이 컴포넌트를 null로 완결 렌더하고
// (에러도 미완료 경계도 아님), 클라이언트도 최초 hydration 순간엔 똑같이
// null이었다가(같은 구조라 mismatch 없음) 그 다음 effect에서 실제 지도로
// 바뀐다.
function ClientOnlyMap(props: JobVietMapProps) {
  const [Comp, setComp] = useState<ComponentType<JobVietMapProps> | null>(null)
  useEffect(() => {
    let cancelled = false
    import('../components/JobVietMap').then((mod) => {
      if (!cancelled) setComp(() => mod.default)
    })
    return () => { cancelled = true }
  }, [])
  if (!Comp) return null
  const Map = Comp
  return <Map {...props} />
}

type InfoField = { key: string; icon: ReactNode; label: string; value: ReactNode; cls?: string }

export function JobDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { jobs, mapAcceptanceJobs, loading: jobsLoading } = useJobs()
  const [saved, setSaved] = useState(() => (id ? isJobSaved(id, user?.id) : false))
  const [messageOpen, setMessageOpen] = useState(false)
  const [toastOpen, setToastOpen] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const [applied, setApplied] = useState(false)
  const [applying, setApplying] = useState(false)
  const [employerJobCount, setEmployerJobCount] = useState<number | undefined>(undefined)
  // 2026-10-07 상세 개편(알바몬 구조): 탭은 내용을 숨기지 않고 해당 구역으로 스크롤만 한다.
  // 구역 순서·키는 data/jobSchema.ts(JOB_SECTIONS)가 정본. 활성 탭은 스크롤 위치(IntersectionObserver)로 갱신.
  const [activeTab, setActiveTab] = useState<JobTabKey>('conditions')
  const [tabsTop, setTabsTop] = useState(0)

  const job = useMemo(() => jobs.find((j) => j.id === id) ?? mapAcceptanceJobs.find((j) => j.id === id), [jobs, mapAcceptanceJobs, id])
  // 목록의 '연락 방법 보기'(#lien-he)로 들어오면 로그인 없이 연락 안내로 바로 이동(2026-09-30)
  const location = useLocation()
  useEffect(() => {
    if (!job || location.hash !== `#${JOB_CONTACT_HASH}`) return
    const t = window.setTimeout(() => {
      document.getElementById('jd2-apply-unavailable')?.scrollIntoView({ behavior: 'instant', block: 'center' })
    }, 50)
    return () => window.clearTimeout(t)
  }, [job, location.hash])

  // "신뢰 정보" 카드용 — 이 기업이 지금까지 등록한 공개 공고 수. 크롤링
  // 공고(employerId 없음)는 실제 소유 기업 계정이 없어 조회 대상이 아니다.
  useEffect(() => {
    if (!job?.employerId) { setEmployerJobCount(undefined); return }
    let cancelled = false
    fetchEmployerJobCount(job.employerId).then((n) => { if (!cancelled) setEmployerJobCount(n) })
    return () => { cancelled = true }
  }, [job?.employerId])

  useEffect(() => {
    // 크롤링 공고(employerId 없음)는 내부 지원을 아예 만들지 않으므로 조회도 스킵
    if (!job || !job.employerId) return
    let cancelled = false
    hasAppliedToJob(job.id, user?.id).then((v) => { if (!cancelled) setApplied(v) })
    return () => { cancelled = true }
  }, [job?.id, job?.employerId, user?.id])

  useEffect(() => {
    if (id) setSaved(isJobSaved(id, user?.id))
  }, [id, user?.id])

  useEffect(() => { setActiveTab('conditions') }, [id])

  // 고정 탭 바는 사이트 헤더(sticky) 바로 아래에 붙는다 — 헤더 높이를 실측해 CSS 변수로 전달.
  useEffect(() => {
    const header = document.querySelector('.layout__header') as HTMLElement | null
    if (!header) return
    const update = () => setTabsTop(header.offsetHeight)
    update()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null
    ro?.observe(header)
    window.addEventListener('resize', update)
    return () => { ro?.disconnect(); window.removeEventListener('resize', update) }
  }, [])

  const jobId = job?.id
  useEffect(() => {
    if (!jobId) return
    const update = () => {
      // 고정 탭 바 바로 아래(+여유)에 닿은 마지막 구역이 현재 구역. 페이지 맨 아래면 마지막 구역.
      const line = tabsTop + 56 + 24
      const present = JOB_SECTION_ORDER.filter((k) => document.getElementById(jobSectionId(k)))
      if (present.length === 0) return
      let current: JobSection = present[0]
      for (const k of present) {
        if ((document.getElementById(jobSectionId(k)) as HTMLElement).getBoundingClientRect().top <= line) current = k
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = present[present.length - 1]
      setActiveTab(tabOfSection(current))
    }
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    update()
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update) }
  }, [jobId, tabsTop])

  const scrollToSection = useCallback((k: JobSection) => {
    setActiveTab(tabOfSection(k))
    document.getElementById(jobSectionId(k))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  // "최근 본 공고" — 상세페이지를 실제로 열람했을 때만 기록한다(목록 카드
  // 노출만으로는 기록하지 않음). 로딩 중이라 job을 아직 못 찾은 상태는 제외.
  useEffect(() => {
    if (job) recordJobView(job.id)
  }, [job?.id])

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

  const onToggleSave = () => setSaved(toggleSavedJobId(job.id, user?.id))
  const showMessageCta = !!job.employerId && user?.role !== 'employer'

  // 크롤링 공고(local_jobs.employer_id가 NULL)는 소유 기업이 없어 내부 지원을 만들면
  // 아무도 조회할 수 없는 "고아 지원"이 되므로 생성하지 않는다. 판정 로직은
  // jobUtils.ts의 resolveApplyRoute()로 useApply.ts(다른 지원 화면들)와 공유한다
  // — 두 곳에 따로 있으면 한쪽만 고쳤을 때 다시 어긋나는 위험이 있다(2026-09-15
  // 실제로 그렇게 어긋나 있던 걸 발견하고 통합함).
  // 2026-09-29 긴급 원복: 원문 사이트로 보내는 지원 동작 제거 — 지원 불가 공고는
  // 화면 안 안내(ApplyUnavailableNotice)로 사실과 등록된 연락 방법만 보여준다.
  const canApplyInternally = resolveApplyRoute(job).mode === 'internal'

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
      // 2026-09-16 사용자 지시로 수정(Astra 조사 2번): 이 화면(공고 상세, 가장
      // 많이 쓰이는 지원 경로)만 seekerName/seekerPhone을 아예 안 보내고
      // 있었다 — RecommendSection/SuggestedJobsPage(useApply.ts의 confirm())는
      // buildProfile()로 이름/전화를 채워 보내는데 여기만 빠져 있어서, 같은
      // 지원인데 어느 화면으로 들어왔는지에 따라 저장 내용이 달랐다(상세
      // 진입 시 이름/전화가 DB에 null로 저장됨). buildProfile()을 재사용해
      // 두 경로가 항상 같은 내용을 저장하게 한다.
      const p = buildProfile(user.id)
      const cvPhotoSnapshotPath = await snapshotCvPhotoForApplication(user.id, job.id).catch(() => null)
      const res = await addApplication({
        jobId: job.id, jobTitle: job.title, company: job.company, employerId: job.employerId,
        seekerId: user.id, seekerName: p.name, seekerPhone: p.phone, cvPhotoSnapshotPath,
      })
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
    document.getElementById('jd2-apply-unavailable')?.scrollIntoView({ behavior: 'instant', block: 'center' })
  }

  // 2026-09-30: 목록과 같은 기준(resolveApplyAction) — 연락처 없는 크롤링 공고는 지원·연락 가능하다고 표시하지 않는다
  const applyAction = resolveApplyAction(job)
  const applyLabel = canApplyInternally
    ? (applied ? 'Đã ứng tuyển' : applying ? 'Đang gửi...' : 'Ứng tuyển ngay')
    : applyAction === 'contact' ? 'Xem cách liên hệ' : 'Chưa có thông tin liên hệ'
  const applyDisabled = canApplyInternally ? (applied || applying) : applyAction === 'none'
  // 연락처가 있으면(Gọi/Zalo) 별도 지원·'연락 방법' 버튼과 안내 박스를 두지 않는다 — 내부 지원(기업 계정 공고)이거나 연락처가 아예 없을 때만 지원 영역을 그린다.
  const hasContact = !!(contactOf(job).phone || contactOf(job).zalo)
  const showApply = canApplyInternally || !hasContact

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

  const badge = deadlineBadge(job.applicationDeadline)
  const tags = jobTags(job)
  const benefits = benefitList(job)
  const descRows = descriptionRows(job.description, job.title)
  const contact = contactOf(job)
  const shift = shiftLabel(job)
  const weekend = weekendLabel(job.weekendWork)
  const employmentText = job.employmentType ? EMPLOYMENT_TYPE_LABEL[job.employmentType] : workPeriodText
  const otherJobsOfCompany = isGenericCompanyName(job.company) ? [] : jobs
    .filter((j) => j.id !== job.id && companyKeyFromName(j.company) === companyKeyFromName(job.company))
    .slice(0, 5)

  // ① 근무조건 / ② 모집조건 — 원문이 채운 값만 표시, 나머지는 행 자체를 숨긴다(추정·가짜 값 금지).
  const periodLabel = salaryPeriodLabel(job.salaryPeriod)
  const row = (key: string, icon: ReactNode, label: string, value: ReactNode | undefined, cls?: string) =>
    value ? ({ key, icon, label, value, cls } as InfoField) : null
  const conditionFields = [
    row('salary', <Briefcase size={14} strokeWidth={1.8} />, 'Mức lương',
      salaryText ? (
        <>
          {periodLabel && <span className="jd2-pay-badge">{periodLabel}</span>}
          {salaryText}{job.salaryBasis ? ` · ${SALARY_BASIS_LABEL[job.salaryBasis]}` : ''}
        </>
      ) : undefined, 'jd2-info-val--salary'),
    row('salaryNote', <Briefcase size={14} strokeWidth={1.8} />, 'Ghi chú lương', job.salaryNote),
    row('workPeriod', <Briefcase size={14} strokeWidth={1.8} />, 'Hình thức làm việc', employmentText),
    row('jobDuration', <Timer size={14} strokeWidth={1.8} />, 'Thời hạn làm việc', nonEmpty(job.jobDuration)),
    row('workDays', <Calendar size={14} strokeWidth={1.8} />, 'Ngày làm việc', workDaysText),
    row('hours', <Clock size={14} strokeWidth={1.8} />, 'Thời gian làm việc', hoursText),
    row('shift', <Clock size={14} strokeWidth={1.8} />, 'Ca làm việc', shift),
    row('weekend', <Calendar size={14} strokeWidth={1.8} />, 'Cuối tuần', weekend),
    row('benefits', <Award size={14} strokeWidth={1.8} />, 'Phúc lợi', benefits.length > 0 ? benefits.join(' · ') : undefined),
    row('category', <Building2 size={14} strokeWidth={1.8} />, 'Ngành nghề', catLabel),
  ].filter(Boolean) as InfoField[]
  const recruitFields = [
    { key: 'deadline', icon: <Timer size={14} strokeWidth={1.8} />, label: 'Hạn nộp hồ sơ', value: deadlineText + (badge ? ` (${badge.label})` : ''), cls: badge?.tone === 'soon' ? 'jd2-info-val--soon' : undefined } as InfoField,
    row('numHires', <Users size={14} strokeWidth={1.8} />, 'Số lượng tuyển', numHiresText),
    row('education', <GraduationCap size={14} strokeWidth={1.8} />, 'Học vấn', educationText),
    row('preference', <Award size={14} strokeWidth={1.8} />, 'Kinh nghiệm', preferenceText),
    row('age', <Users size={14} strokeWidth={1.8} />, 'Độ tuổi', nonEmpty(job.ageRequirement)),
    row('gender', <Users size={14} strokeWidth={1.8} />, 'Giới tính', nonEmpty(job.genderRequirement)),
    row('docs', <Briefcase size={14} strokeWidth={1.8} />, 'Hồ sơ cần chuẩn bị', job.requiredDocuments),
    row('language', <Award size={14} strokeWidth={1.8} />, 'Ngoại ngữ', job.languageRequirement),
    row('trip', <MapPin size={14} strokeWidth={1.8} />, 'Đi công tác', job.businessTrip === true ? 'Có thể đi công tác' : job.businessTrip === false ? 'Không đi công tác' : undefined),
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
  // 2026-09-30 사용자 지시: 지역·공단 중심 좌표로 대신 표시하지 않는다. 확인된 근무지(precise)만 지도에
  // 그리고, 없으면 '위치 미확인'으로 표시한다(길찾기·거리 계산에서도 이미 제외됨).
  const verifiedMapPoints = mapLocations.points.filter((p) => p.precise)
  const hasMapPoints = verifiedMapPoints.length > 0
  const mapCenter = verifiedMapPoints[0]
  // 2026-10-07 사용자 지시: 공단(KCN) 수준까지만 아는 근무지는 "해당 KCN 중심 좌표"로 핀 없이 지도 + "Vị trí chính xác chưa xác minh".
  // 중심 좌표는 출처(OpenStreetMap way)가 있는 공단 표(data/industrialParks.ts)에서만 가져온다 — 표에 없으면
  // 지역 중심으로 대신하지 않고 지도 없이 글자 안내만 보여준다. 핀·길찾기·거리 계산에는 쓰지 않는다.
  // 길찾기는 승인된 출입구 좌표가 있는 근무지만(MapLinks와 같은 규칙: viewKind==='exact'일 때만 directions 존재) — 전체화면 지도에도 같은 규칙.
  const mapDirections = (job.workLocations ?? []).flatMap((loc) => {
    const links = isVerifiedWorkLocation(loc) ? workLocationExternalLinks(loc) : null
    return links && links.viewKind === 'exact' && links.directions
      ? [{ label: (job.workLocations?.length ?? 0) > 1 ? `Chỉ đường — ${loc.rawAddress}` : 'Chỉ đường', href: links.directions }]
      : []
  })
  const park = !hasMapPoints
    ? findIndustrialPark(job.rawLocation, ...(job.workLocations ?? []).flatMap((l) => [l.industrialPark, l.rawAddress]))
    : undefined
  // 공단 수준 길찾기 — 출처 있는 정문·관리사무소 좌표(destination)로만. 없으면(영역 중심은 쓰지 않음) 버튼 숨김
  // 길찾기 3단계(2026-10-08): ① 승인 좌표 Chỉ đường → ② KCN 정문 좌표 Đến cổng KCN → ③ 둘 다 없으면 Gọi hỏi đường(전화).
  const directionsPlan = planDirections({
    approvedLinks: mapDirections,
    gateHref: park ? industrialParkDirectionsUrl(park) : null,
    gateNote: park?.destination ? industrialParkDirectionsNote(park.destination) : undefined,
    phone: contact.phone,
  })
  const parkDirection = directionsPlan.tier === 'gate'
    ? { label: directionsPlan.link.label, href: directionsPlan.link.href, note: directionsPlan.note }
    : undefined
  // 주소 "텍스트 목록" 표시는 좌표(geocoding) 유무와 무관하게 원본에 근무지가
  // 있으면 항상 보여준다.
  const hasWorkLocationList = (job.workLocations?.length ?? 0) > 0
  // 근무지 목록도 없고 모집지역도 없는 완전 레거시 케이스(job.location
  // 텍스트만 있음)에서만 쓰는 단일 Google Maps 링크 — 근무지가 있으면 각
  // 주소별로, 모집지역만 있으면 지역별로 따로 만든다(아래 렌더링 부분).
  const hasRecruitmentRegionsOnly = !hasWorkLocationList && (job.recruitmentRegions?.length ?? 0) > 0
  // 2026-09-29: 외부 지도 링크는 사이트 지도와 같은 점을 쓴다(글자 검색 X). 근무지 행이 없는
  // 레거시 공고는 지역 수준 점뿐이라 지역 화면만 열고 길찾기는 주지 않는다.
  const singleLocationGmaps =
    !hasWorkLocationList && !hasRecruitmentRegionsOnly && locationText && mapLocations.source !== 'default'
      ? externalMapLinks(mapLocations.points[0], false, 11)
      : null

  // 출처 사이트·Facebook CDN 이미지는 회사 로고로 쓰지 않는다(companyLogo.ts, 2026-10-06) — 없으면 이니셜.
  const logoUrl = companyLogoUrl(job.imageUrl)
  const extraImages = job.images?.filter((u) => u !== logoUrl) ?? []

  const hasCompanyInfo = !!job.companyVerified || !!job.companyFoundedYear || !!job.hireCount || !!employerJobCount
    || !!job.laborContractPledge || !!job.socialInsurancePledge

  // 회사 정보도, 같은 회사 다른 공고도 없으면 기업정보 구역(탭 포함)을 숨긴다. 리뷰는 구역 밖에서 유지.
  const showCompanySection = hasCompanyInfo || otherJobsOfCompany.length > 0
  // 상세요강은 남은 문장 행(또는 추가 사진)이 하나도 없으면 구역·탭을 숨긴다.
  const showDescriptionSection = descRows.length > 0 || extraImages.length > 0
  const visibleTabs = JOB_TABS.filter((t) => t.key !== 'company' || showCompanySection).filter((t) => t.key !== 'description' || showDescriptionSection)

  return (
    <div className="jd2-page" style={{ '--jd-tabs-top': `${tabsTop}px` } as CSSProperties}>

      {/* ── Back ── */}
      <button type="button" className="jd2-back" onClick={() => navigate(-1)}>
        <ChevronLeft size={16} strokeWidth={2} />
        Quay lại
      </button>

      {/* ── Header card: 급여·D-day·태그 강조, 경고는 한 줄 ── */}
      <div className="jd2-header">
        <div className="jd2-header__left">
          <div className="jd2-logo">
            {logoUrl
              ? <img src={logoUrl} alt={job.company} className="jd2-logo__img" />
              : <span className="jd2-logo__fallback">{job.company?.[0] ?? 'J'}</span>
            }
          </div>
          <div className="jd2-header__info">
            <div className="jd2-header__chips">
              <span className="jd2-chip">{catLabel}</span>
              {job.urgent && <span className="jd2-chip jd2-chip--urgent">Tuyển gấp</span>}
              {badge && <span className={`jd2-chip jd2-dday jd2-dday--${badge.tone}`}>{badge.label}</span>}
            </div>
            <h1 className="jd2-header__title">{job.title}</h1>
            <p className="jd2-header__company">{job.company}</p>
            {(salaryText || job.salaryBasis) && (
              <p className="jd2-hl-salary">
                {periodLabel && <span className="jd2-pay-badge">{periodLabel}</span>}
                <span className="jd2-hl-salary__val">{salaryText ?? 'Thỏa thuận'}</span>
                {job.salaryBasis && <span className="jd2-hl-salary__basis">{SALARY_BASIS_LABEL[job.salaryBasis]}</span>}
                {job.salaryNote && <span className="jd2-hl-salary__note">{job.salaryNote}</span>}
              </p>
            )}
            {tags.length > 0 && (
              <div className="jd2-tags">
                {tags.map((t) => <span key={t} className="jd2-tag">{t}</span>)}
              </div>
            )}
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
            <p className="jd2-warn1">
              <span aria-hidden="true">⚠️</span> Việc Gần Bạn không thu phí. Cẩn thận nếu bị yêu cầu đặt cọc, mã OTP hoặc chuyển tiền.
            </p>
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

      {/* ── Sticky tabs: 내용을 숨기지 않고 구역으로 스크롤만 ── */}
      <nav className="jd2-tabs jd2-tabs--sticky" aria-label="Các phần của tin tuyển dụng">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-current={activeTab === t.key ? 'true' : undefined}
            className={`jd2-tab${activeTab === t.key ? ' jd2-tab--active' : ''}`}
            onClick={() => scrollToSection(t.sections[0])}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* ── Main grid ── */}
      <div className="jd2-grid">
        <div className="jd2-main">

          {/* ① 근무조건 */}
          <section id={jobSectionId('conditions')} className="jd2-sec">
            <h2 className="jd2-sec__title">{JOB_SECTION_LABELS.conditions}</h2>
            <div className="jd2-box">
              <dl className="jd2-kv">
                {conditionFields.map((f) => (
                  <div className="jd2-kv__row" key={f.key}>
                    <dt>{f.label}</dt>
                    <dd className={f.cls}>{f.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          {/* ② 모집조건 */}
          <section id={jobSectionId('recruit')} className="jd2-sec">
            <h2 className="jd2-sec__title">{JOB_SECTION_LABELS.recruit}</h2>
            <div className="jd2-box">
              <dl className="jd2-kv">
                {recruitFields.map((f) => (
                  <div className="jd2-kv__row" key={f.key}>
                    <dt>{f.label}</dt>
                    <dd className={f.cls}>{f.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          {/* ③ 근무지역 */}
          <section id={jobSectionId('location')} className="jd2-sec">
          <h2 className="jd2-sec__title">{JOB_SECTION_LABELS.location}</h2>
          {/* ── Location / Map — always shown open, at the best accuracy the job data allows ── */}
          <div className="jd2-box">
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
                    // 2026-09-29(4682 사고): 정확 여부·핀·길찾기·거리 모두 isVerifiedWorkLocation()
                    // 하나로 판단한다. 예전 "모든 등급에서 글자 검색 길찾기 표시"(09-05)는 Google이
                    // 모호한 글자를 엉뚱한 곳(논)으로 추측해 폐기 — 미확인 위치는 지역 화면만 연다.
                    <ul className="jd2-map-addr-list">
                      {job.workLocations?.map((loc) => {
                        const gmaps = workLocationExternalLinks(loc)
                        const tier = loc.coordinateAccuracy ?? 'unresolved'
                        const isPreciseLoc = isVerifiedWorkLocation(loc)
                        const approved = loc.approvedPoint
                        const verifiedWard = isPreciseLoc && !approved && tier === 'ward'
                        const isRegionOnlyText = loc.addressAccuracy === 'region_only'
                        return (
                          <li key={loc.id} className="jd2-map-addr-item">
                            <p className="jd2-map-addr">
                              <MapPin size={13} strokeWidth={1.8} />
                              {loc.rawAddress}
                            </p>
                            {loc.industrialPark && <p className="jd2-map-extra">Khu công nghiệp: <strong>{loc.industrialPark}</strong></p>}
                            {loc.shuttleRoute && <p className="jd2-map-extra">Tuyến xe đưa đón: <strong>{loc.shuttleRoute}</strong></p>}
                            {loc.matchedRecruitmentRegions && loc.matchedRecruitmentRegions.length > 1 && (
                              <p className="jd2-map-recruitment-regions">
                                Tuyển tại: {loc.matchedRecruitmentRegions.join(', ')}
                              </p>
                            )}
                            {loc.geocodeStatus === 'pending' && !isRegionOnlyText ? (
                              // 2026-09-07 사용자 지시: geocode_status='pending'은
                              // "실패"가 아니라 "아직 지오코딩을 시도하지 않음" —
                              // exact_text인데 아직 시도 안 한 경우에만 이 문구를
                              // 보여준다. region_only는 원문 자체가 지역 수준이라
                              // pending 여부와 무관하게 항상 기존 지역 안내문을
                              // 그대로 보여줘야 한다(충돌 수정 — 아래 isRegionOnlyText
                              // 분기가 그 문구를 그대로 담당).
                              <p className="jd2-map-pending-note">
                                Đang xác minh vị trí — hệ thống chưa xác định được tọa độ cho địa chỉ này.
                              </p>
                            ) : approved ? (
                              // 사람이 회사 공식 정보·원문을 대조해 승인한 근무지(2026-09-29)
                              <p className="jd2-map-verified-ward-note">
                                {job.id.startsWith('acceptance-')
                                  ? 'Điểm cơ sở được đối chiếu với địa điểm công khai để kiểm thử Preview; chưa xác minh lối vào hoặc tuyển dụng trực tiếp.'
                                  : approved.placePrecision === 'entrance'
                                  ? 'Vị trí nơi làm việc đã được xác minh (cổng/lối vào).'
                                  : 'Vị trí nơi làm việc đã được xác minh theo thông tin chính thức của công ty — lối vào cụ thể chưa được xác minh.'}
                              </p>
                            ) : isRegionOnlyText ? (
                              // Tier C/D — 성·시 또는 구·군·동만 있는 텍스트, 구체적
                              // 상세주소가 아니다. 거리검색에도 쓰이지 않는다.
                              <p className="jd2-map-ward-note">
                                Chỉ có khu vực hành chính (tỉnh/thành hoặc quận/huyện) — vị trí nơi làm việc chưa được xác minh.
                              </p>
                            ) : verifiedWard ? (
                              // Tier A(원문 좌표로 확인된 근무구역) — exact와 동일한
                              // 정밀도를 주장하지 않되, 확인된 위치임은 밝힌다.
                              <p className="jd2-map-verified-ward-note">
                                Khu vực làm việc đã xác nhận — có thể chưa phải vị trí chính xác của tòa nhà.
                              </p>
                            ) : !isPreciseLoc ? (
                              // 미확인 — 좌표가 있어도(공단 중심·동 단위 추정 등) 근무지 위치로 주장하지 않는다.
                              <p className="jd2-map-ward-note">
                                Vị trí nơi làm việc chưa được xác minh — không hiển thị trên bản đồ, không dùng để chỉ đường hay tính khoảng cách.
                              </p>
                            ) : null}
                            <MapLinks links={gmaps} />
                            {isPreciseLoc && !verifiedWard && !approved && (
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
                          const gmaps = externalMapLinks(findRegionCenter(region), false, 11)
                          return (
                            <li key={region} className="jd2-map-addr-item">
                              <p className="jd2-map-addr">
                                <MapPin size={13} strokeWidth={1.8} />
                                {region}
                              </p>
                              <MapLinks links={gmaps} />
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
                        <MapLinks links={singleLocationGmaps} />
                      </>
                    )
                  )}
                  {/* 내부 지도는 'default'(위치 정보가 전혀 없어 베트남 전체 중심으로
                      떨어진 경우)만 아니면 항상 그린다 — 정확한 마커든 근사 위치든
                      resolveMapLocations()가 이미 우선순위대로 골라준 점들이다. */}
                  {hasMapPoints && mapCenter && (
                    <>
                      <ClientOnlyMap
                        lat={mapCenter.lat}
                        lng={mapCenter.lng}
                        title={job.title}
                        zoom={mapLocations.zoom}
                        markers={verifiedMapPoints.map((p) => ({ lat: p.lat, lng: p.lng, label: p.label }))}
                        directions={mapDirections}
                      />
                      <p className="jd2-map-note">
                        {verifiedMapPoints.length > 1
                          ? `Công việc này có ${verifiedMapPoints.length} địa điểm làm việc đã xác minh.`
                          : 'Vị trí nơi làm việc đã được xác minh trên bản đồ.'}
                      </p>
                    </>
                  )}
                  {park && (
                    <>
                      <ClientOnlyMap lat={park.lat} lng={park.lng} title={park.name} zoom={14} pinless parkRef={park.source.ref} parkName={park.name} directions={parkDirection ? [parkDirection] : undefined} />
                      <p className="jd2-map-pending-note jd2-map-area-note">
                        <strong>Vị trí chính xác chưa xác minh.</strong> Bản đồ chỉ cho biết khu vực {park.name} (viền nét đứt, không có ghim) — chưa dùng để tính khoảng cách.
                        <span className="jd2-map-credit"> Viền khu vực: OpenStreetMap ({park.source.ref}) · © OpenStreetMap contributors.</span>
                      </p>
                      {parkDirection && (
                        <div className="jd2-map-links">
                          <a className="jd2-map-dir" href={parkDirection.href} target="_blank" rel="noopener noreferrer">{parkDirection.label} ↗</a>
                          <p className="jd2-map-dir-note">{parkDirection.note}</p>
                        </div>
                      )}
                    </>
                  )}
                  {!hasMapPoints && !park && mapLocations.source !== 'pending' && (
                    <p className="jd2-map-pending-note">
                      Vị trí nơi làm việc chưa được xác minh — chưa hiển thị bản đồ, chỉ đường và khoảng cách.
                    </p>
                  )}
                  {/* mapLocations.source === 'pending'일 때는 hasMapPoints가 항상
                      false(points: [])라 위 지도 블록이 아예 렌더되지 않는다 —
                      좌표가 전혀 없다는 이유로 이 카드 전체가 비어 보이지 않도록,
                      "아직 확인 중"임을 알리는 별도 안내를 지도 대신 보여준다
                      (2026-09-07 사용자 지시: 베트남 기본 중심 표시도, 완전히
                      숨기는 것도 금지 — 명확한 pending 문구로 구분). */}
                  {mapLocations.source === 'pending' && (
                    <p className="jd2-map-pending-note">
                      Đang xác minh vị trí trên bản đồ — hệ thống sẽ cập nhật khi có tọa độ chính xác.
                    </p>
                  )}
                  {directionsPlan.tier === 'call' && (
                    <div className="jd2-map-links">
                      <a className="jd2-map-dir" href={directionsPlan.href}>{directionsPlan.label} ({directionsPlan.phone})</a>
                      <p className="jd2-map-dir-note">Chưa có tọa độ đã xác minh — hãy gọi nhà tuyển dụng để hỏi đường.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          </section>

          {/* ④ 상세요강 — 제목 반복·소제목 제거, 남은 문장을 행으로. 비면 구역 숨김 */}
          {showDescriptionSection && (
          <section id={jobSectionId('description')} className="jd2-sec">
            <h2 className="jd2-sec__title">{JOB_SECTION_LABELS.description}</h2>
            {descRows.length > 0 && (
              <div className="jd2-box">
                <dl className="jd2-kv jd2-kv--single">
                  {descRows.map((r) => (
                    <div className="jd2-kv__row" key={r.key}>
                      <dt>{r.label}</dt>
                      <dd>
                        {r.lines.length === 1 ? r.lines[0] : (
                          <ul className="jd2-desc__list">{r.lines.map((l) => <li key={l} className="jd2-desc__item">{l}</li>)}</ul>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
            {/* ── Extra photos (excludes the company logo already shown in the header) ── */}
            {extraImages.length > 0 && (
              <div className="jd2-box">
                <div className="jd2-card__body">
                  {extraImages.map((url, i) => (
                    <img key={i} src={url} alt={`${job.title} ${i + 1}`} className="jd2-desc-img" />
                  ))}
                </div>
              </div>
            )}
          </section>
          )}

          {/* ⑤ 기업정보 */}
          {showCompanySection && (
          <section id={jobSectionId('company')} className="jd2-sec">
          <h2 className="jd2-sec__title">{JOB_SECTION_LABELS.company}</h2>
          {/* ── Company info ── */}
          {hasCompanyInfo && (
            <div className="jd2-box">
              <div className="jd2-card__body jd2-company">
                <div className="jd2-company__logo">
                  {logoUrl
                    ? <img src={logoUrl} alt={job.company} className="jd2-logo__img" />
                    : <span className="jd2-logo__fallback">{job.company?.[0] ?? 'J'}</span>
                  }
                </div>
                <div className="jd2-company__body">
                  <p className="jd2-company__name">{job.company}</p>
                  <ul className="jd2-company__facts">
                    {job.companyVerified && <li>✓ Doanh nghiệp đã xác minh</li>}
                    {job.companyFoundedYear && <li>Thành lập năm {job.companyFoundedYear}</li>}
                    {job.hireCount !== undefined && job.hireCount > 0 && <li>Đã tuyển: {job.hireCount}</li>}
                    {employerJobCount !== undefined && employerJobCount > 0 && (
                      <li>Đã đăng {employerJobCount} tin tuyển dụng trên Việc Gần Bạn</li>
                    )}
                  </ul>
                  {(job.laborContractPledge || job.socialInsurancePledge) && (
                    <ul className="jd2-company__facts jd2-company__pledges">
                      {job.laborContractPledge && <li>🤝 Cam kết ký hợp đồng lao động rõ ràng</li>}
                      {job.socialInsurancePledge && <li>🤝 Cam kết đóng BHXH/BHYT đầy đủ theo quy định</li>}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

            {otherJobsOfCompany.length > 0 && (
              <div className="jd2-box">
                <p className="jd2-box__sub">Tin khác của công ty</p>
                <ul className="jd2-card__body jd2-other-jobs">
                  {otherJobsOfCompany.map((j) => (
                    <li key={j.id}><Link to={`/viec-lam/${j.id}`}>{j.title}</Link></li>
                  ))}
                </ul>
              </div>
            )}

            <CompanyReviews company={job.company} />
          </section>
          )}
          {!showCompanySection && <CompanyReviews company={job.company} />}
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

          {/* 지원 영역: 내부 지원이거나 연락처가 없을 때만 — 연락처가 있으면 하단 Gọi/Zalo 버튼만 */}
          {showApply && (
            <button
              type="button"
              className="jd2-btn-apply"
              onClick={onApplyClick}
              disabled={applyDisabled}
            >
              {applyLabel}
            </button>
          )}
          {canApplyInternally ? (
            <span className="jd2-aside-hint">Ứng tuyển nhanh bằng CV đã lưu trong Hồ sơ</span>
          ) : !hasContact ? (
            <div id="jd2-apply-unavailable">
              <ApplyUnavailableNotice job={job} onShowDescription={() => scrollToSection('description')} />
            </div>
          ) : null}

          {/* 연락처는 화면에 한 곳만: PC는 이 요약 박스, 모바일(≤760px)은 하단 고정 바 */}
          {hasContact && (
            <div className="jd2-aside-contact">
              {contact.phone && (
                <a href={`tel:${contact.phone.replace(/\s/g, '')}`} className="jd2-aside-contact__call">
                  <Phone size={17} strokeWidth={2} />
                  Gọi {contact.phone}
                </a>
              )}
              {contact.zalo && (
                <a href={zaloMeUrl(contact.zalo)} target="_blank" rel="noopener noreferrer" className="jd2-aside-contact__zalo">
                  <MessageCircle size={17} strokeWidth={2} />
                  Zalo
                </a>
              )}
            </div>
          )}

          <ReportButton
            targetType="job"
            targetId={job.id}
            snapshot={{ title: job.title, company: job.company, url: `/viec-lam/${job.id}` }}
          />

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

      {/* ── 하단 고정 바(PC·모바일 공통): Gọi / Zalo / 지원. 연락처가 없으면 Gọi·Zalo는 그리지 않는다 ── */}
      <div className="jd2-mobile-cta" role="region" aria-label="Liên hệ nhanh">
        <div className="jd2-mobile-cta__inner">
          {contact.phone && (
            <a href={`tel:${contact.phone.replace(/\s/g, '')}`} className="jd2-mobile-cta__call">
              <Phone size={17} strokeWidth={2} />
              Gọi
            </a>
          )}
          {contact.zalo && (
            <a href={zaloMeUrl(contact.zalo)} target="_blank" rel="noopener noreferrer" className="jd2-mobile-cta__zalo">
              <MessageCircle size={18} strokeWidth={2} />
              Zalo
            </a>
          )}
          {showApply && (
            <button
              type="button"
              className="jd2-mobile-cta__apply"
              onClick={onApplyClick}
              disabled={applyDisabled}
            >
              {applyLabel}
            </button>
          )}
        </div>
      </div>

      <Toast message={toastMsg} open={toastOpen} onClose={() => setToastOpen(false)} />
      <MessageEmployerModal open={messageOpen} job={job} user={user} onClose={() => setMessageOpen(false)} />
    </div>
  )
}


/** 외부 지도 링크 — 확인된 근무지만 핀+길찾기, 그 외는 지역 화면만(2026-09-29). */
function MapLinks({ links }: { links: ExternalMapLinks | null }) {
  // 2026-09-30: 지역 수준(area) 지도 화면 링크도 지역 중심 좌표 대체 표시라 내보내지 않는다
  if (!links || links.viewKind !== 'exact') return null
  return (
    <div className="jd2-map-gmaps-links">
      <a href={links.view} target="_blank" rel="noopener noreferrer">
        {links.viewKind === 'exact' ? 'Xem trên bản đồ lớn ↗' : 'Xem khu vực trên bản đồ ↗'}
      </a>
      {links.directions && (
        <a href={links.directions} target="_blank" rel="noopener noreferrer">Chỉ đường ↗</a>
      )}
    </div>
  )
}
