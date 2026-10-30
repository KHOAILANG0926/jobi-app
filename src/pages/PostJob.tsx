import { FormEvent, RefObject, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import './PostJob.css'
import { ALL_CATEGORIES, CATEGORY_LABELS } from '../data/categories'
import { JOB_DURATION_OPTIONS } from '../data/jobDuration'
import { VN_PROVINCES } from '../data/vnProvinces'
import { VN_WARDS_BY_PROVINCE } from '../data/vnWards'
import { SUBCATEGORY_LABELS } from '../data/subcategories'
import { useAuth } from '../context/AuthContext'
import { useJobs } from '../context/JobsContext'
import { checkIsEmployer } from '../lib/accountRoles'
import { supabase } from '../lib/supabase'
import VietMapPinPicker from '../components/job-form/VietMapPinPicker'
import { findRegionCenter } from '../lib/jobCoords'
import { RECRUITMENT_LABELS, SHIFT_LABELS } from '../lib/jobConditions'
import { BENEFIT_TAG_OPTIONS, composeAge, composeDescription, composeHires, composeHours, composeLocation, composeSalary, normalizeVnPhone, type GenderChoice, type PayUnit } from '../lib/postJobForm'
import type { PinPoint } from '../components/job-form/LocationPinPicker'
import { EMPTY_CONDITIONS, type JobConditions } from '../lib/jobConditions'
import type { JobCategory, ShiftType } from '../types/job'

// 2026-10-30 Lee: 공고 작성 체크리스트 순서(① 근무조건 ② 모집조건 ③ 근무지역 ④ 상세요강). 필수 9개 = 급여·근무시간·고용형태·업직종·모집마감·모집인원·주소·업무 내용·연락처.
const emptyForm = {
  title: '',
  company: '',
  // 'khac'(기타)가 지금 분류의 fallback(구 'other'는 폐기).
  category: 'khac' as JobCategory,
  subcategory: '',
  salaryAmount: '',
  salaryUnit: 'month' as PayUnit,
  salaryNegotiable: false,
  salaryIncludesOvertime: false,
  allowance: '',
  payMethod: '',
  timeStart: '',
  timeEnd: '',
  breakMinutes: '',
  jobDuration: '',
  employmentType: '' as '' | 'full_time' | 'seasonal' | 'part_time',
  benefitTags: [] as string[],
  insurance: false,
  benefitOther: '',
  applicationDeadline: '',
  ongoing: false,
  hires: '',
  hiresUndecided: false,
  ageMin: '',
  ageMax: '',
  gender: '' as GenderChoice,
  genderMale: '',
  genderFemale: '',
  education: '',
  preference: '',
  street: '',
  province: '',
  ward: '',
  park: '',
  work: '',
  overtime: '',
  environment: '',
  process: '',
  employerPhone: '',
  zalo: '',
  zaloSameAsPhone: true,
  urgent: false,
  laborContractPledge: false,
  workDays: [] as string[],
  daysNegotiable: false,
  hoursNegotiable: false,
}

type EmployerCheck = 'checking' | 'employer' | 'guest'
type PostMode = 'quick' | 'email'

function addDays(n: number): string {
  const t = new Date()
  t.setDate(t.getDate() + n)
  return t.toISOString().slice(0, 10)
}

function randomPassword(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
}

// 화면 부품은 컴포넌트 밖에 둔다(안에 두면 입력할 때마다 칸이 새로 만들어져 커서가 빠진다).
const Row = ({ label, req, count, children }: { label: string; req?: boolean; count?: string; children: ReactNode }) => (
  <div className="pj-row">
    <div className="pj-row__label">{label}{req && <span className="pj-req">*</span>}{count && <span className="pj-count">{count}</span>}</div>
    <div className="pj-row__body">{children}</div>
  </div>
)
const Check = ({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) => (
  <label className="pj-check"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />{children}</label>
)

export function PostJob() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { addPostedJob } = useJobs()
  const [form, setForm] = useState(emptyForm)
  const [conditions, setConditions] = useState<JobConditions>(EMPTY_CONDITIONS)
  const [pin, setPin] = useState<PinPoint | null>(null)
  const [pinWarning, setPinWarning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const errorRef = useRef<HTMLParagraphElement>(null)

  const titleRef = useRef<HTMLInputElement>(null)
  const companyRef = useRef<HTMLInputElement>(null)
  const salaryRef = useRef<HTMLInputElement>(null)
  const timeRef = useRef<HTMLInputElement>(null)
  const employmentRef = useRef<HTMLButtonElement>(null)
  const deadlineRef = useRef<HTMLInputElement>(null)
  const hiresRef = useRef<HTMLInputElement>(null)
  const ageRef = useRef<HTMLInputElement>(null)
  const streetRef = useRef<HTMLInputElement>(null)
  const employerPhoneRef = useRef<HTMLInputElement>(null)
  const zaloRef = useRef<HTMLInputElement>(null)
  const descriptionRef = useRef<HTMLTextAreaElement>(null)
  const guestEmailRef = useRef<HTMLInputElement>(null)

  // 폼이 길어서(제출 버튼은 맨 아래) 에러가 폼 맨 위에만 뜨면 사용자가
  // 못 보고 "버튼이 안 눌린다"고 느낀다 — 에러가 뜰 때마다 그쪽으로 스크롤한다.
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [error])

  function goToField(ref: RefObject<HTMLElement | null>) {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    ref.current?.focus()
  }
  // 'khac'(기타)는 classifier.py/SUBCATEGORY_LABELS 둘 다 소분류 규칙 자체가
  // 없어 undefined — 그 경우 소분류 select를 아예 숨긴다.
  const subcategoryOptions = SUBCATEGORY_LABELS[form.category]
  const mapCenter = useMemo(() => findRegionCenter([form.ward, form.province].filter(Boolean).join(', ')) ?? { lat: 21.1861, lng: 106.0763 }, [form.ward, form.province])
  const useMyLocation = () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition((pos) => setPin({ lat: pos.coords.latitude, lng: pos.coords.longitude }), () => { /* 거부 시 지도에서 직접 */ }, { timeout: 10000 })
  }

  // 2026-09-20 사용자 지시("가입 자체가 너무 귀찮다는 의견이 많아" — 로그인
  // 없이도 채용공고를 올릴 수 있게) — 이전엔 이 페이지 전체가
  // <RequireEmployer>로 감싸여 있어 비로그인/비기업 계정은 아예 못 들어왔다.
  // 이제 페이지 자체는 항상 열려있고, 실제 기업 계정인지만 이 안에서
  // 확인해서 세 갈래로 나눈다: 기업 계정(기존 그대로) / 이메일로 등록(뒤에서
  // 계정 자동 생성) / 등록 없이 빠르게 게시(guest_manage_token 방식).
  const [employerCheck, setEmployerCheck] = useState<EmployerCheck>('checking')
  const [postMode, setPostMode] = useState<PostMode>('quick')
  const quickGuestMode = employerCheck === 'guest' && postMode === 'quick'
  const [showDemog, setShowDemog] = useState(false)
  const [showBenefits, setShowBenefits] = useState(false)
  const [guestEmail, setGuestEmail] = useState('')
  const [guestSuccess, setGuestSuccess] = useState<{ jobId: string; manageUrl: string } | null>(null)
  const [emailSuccess, setEmailSuccess] = useState<{ jobId: string; email: string } | null>(null)

  useEffect(() => {
    if (!user) { setEmployerCheck('guest'); return }
    let cancelled = false
    checkIsEmployer(user.id)
      .then((isEmployer) => { if (!cancelled) setEmployerCheck(isEmployer ? 'employer' : 'guest') })
      .catch(() => { if (!cancelled) setEmployerCheck('guest') })
    return () => { cancelled = true }
  }, [user])

  const onImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const salary = composeSalary(form.salaryAmount, form.salaryUnit, form.salaryNegotiable)
    const hours = form.hoursNegotiable ? 'Thỏa thuận' : composeHours(form.timeStart, form.timeEnd, form.breakMinutes)
    const hires = composeHires(form.hires, form.hiresUndecided, form.gender, form.genderMale, form.genderFemale)
    const age = composeAge(form.ageMin, form.ageMax)
    const location = composeLocation(form.street, form.ward, form.province, form.park)
    const description = composeDescription({ work: form.work, overtime: form.overtime, environment: form.environment, process: form.process, benefitOther: form.benefitOther })
    const phone = normalizeVnPhone(form.employerPhone)
    const zalo = form.zaloSameAsPhone ? phone : (form.zalo.trim() ? normalizeVnPhone(form.zalo) : null)
    const deadlineChosen = form.ongoing || !!form.applicationDeadline.trim() || quickGuestMode
    const requiredFields: { valid: boolean; message: string; ref: RefObject<HTMLElement | null> }[] = [
      { valid: !!form.title.trim(), message: 'Vui lòng nhập tiêu đề công việc.', ref: titleRef },
      { valid: !!form.company.trim(), message: 'Vui lòng nhập tên công ty / đơn vị.', ref: companyRef },
      { valid: !!salary, message: 'Vui lòng nhập mức lương (hoặc chọn Thỏa thuận).', ref: salaryRef },
      { valid: !!hours, message: 'Vui lòng nhập giờ bắt đầu và kết thúc.', ref: timeRef },
      { valid: !!form.employmentType, message: 'Vui lòng chọn hình thức làm việc.', ref: employmentRef },
      { valid: deadlineChosen, message: 'Vui lòng chọn hạn nộp hồ sơ hoặc Tuyển liên tục.', ref: deadlineRef },
      { valid: !!hires, message: 'Vui lòng nhập số lượng tuyển (hoặc chọn Chưa xác định).', ref: hiresRef },
      { valid: age !== null, message: 'Độ tuổi không hợp lệ (15–70, từ nhỏ đến lớn).', ref: ageRef },
      { valid: !!location, message: 'Vui lòng nhập số nhà/đường, chọn tỉnh/thành và phường/xã.', ref: streetRef },
      { valid: !!description, message: 'Vui lòng nhập nội dung công việc.', ref: descriptionRef },
      { valid: !!phone, message: 'Số điện thoại không hợp lệ (ví dụ 0912 345 678).', ref: employerPhoneRef },
      { valid: form.zaloSameAsPhone || !form.zalo.trim() || !!zalo, message: 'Số Zalo không hợp lệ.', ref: zaloRef },
    ]
    const firstInvalid = requiredFields.find((f) => !f.valid)
    if (firstInvalid) {
      setError(firstInvalid.message)
      goToField(firstInvalid.ref)
      return
    }
    if (employerCheck === 'guest' && postMode === 'email' && !guestEmail.trim()) {
      setError('Vui lòng nhập email để đăng ký.')
      goToField(guestEmailRef)
      return
    }

    setSubmitting(true)
    try {
      let imageUrl: string | undefined = undefined

      if (imageFile) {
        const ext = imageFile.name.split('.').pop()
        const path = `${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('job-images')
          .upload(path, imageFile, { upsert: true })
        if (uploadError) throw new Error('Tải ảnh thất bại: ' + uploadError.message)
        const { data } = supabase.storage.from('job-images').getPublicUrl(path)
        imageUrl = data.publicUrl
      }

      const salaryNote = [form.allowance.trim() && `Phụ cấp·Thưởng: ${form.allowance.trim()}`, form.payMethod && `Trả lương: ${form.payMethod}`].filter(Boolean).join('; ')
      const baseFields = {
        title: form.title.trim(),
        company: form.company.trim(),
        category: form.category,
        subcategory: form.subcategory || undefined,
        salary: salary!.salary,
        salaryPeriod: salary!.salaryPeriod,
        salaryBasis: form.salaryIncludesOvertime && !form.salaryNegotiable ? 'total_with_overtime' as const : undefined,
        salaryNote: salaryNote || undefined,
        location: location!,
        description: description!,
        hours: hours!,
        jobDuration: form.jobDuration || undefined,
        employmentType: form.employmentType || undefined,
        workDays: form.daysNegotiable ? 'Thỏa thuận' : (form.workDays.length ? form.workDays.join(', ') : undefined),
        benefitTags: form.benefitTags.length ? form.benefitTags : undefined,
        numHires: hires!,
        genderRequirement: form.gender || undefined,
        ageRequirement: age || undefined,
        education: form.education || undefined,
        preference: form.preference.trim() || undefined,
        laborContractPledge: form.laborContractPledge || undefined,
        socialInsurancePledge: form.insurance || undefined,
        employerPhone: phone!,
        zalo: zalo || undefined,
        urgent: form.urgent,
        imageUrl,
        ...conditions,
        workSchedule: form.workDays.length === 5 ? '5_days' as const : form.workDays.length === 6 ? '6_days' as const : form.workDays.length ? 'other' as const : conditions.workSchedule,
      }
      const deadlineOr = (days: number) => form.ongoing ? '' : (form.applicationDeadline.trim() || addDays(days))

      // 근무지 핀은 공고 저장 뒤 소유 확인 RPC로 저장한다(실패해도 공고는 유지 — 관리 화면에서 다시 지정 가능).
      const savePin = async (jobId: string, token: string | null) => {
        if (!pin) return
        const { error: pinError } = await supabase.rpc('set_job_pinned_location', {
          p_job_id: Number(jobId.replace(/^sb-/, '')), p_token: token, p_address: location!, p_lat: pin.lat, p_lng: pin.lng,
        })
        if (pinError) setPinWarning(true)
      }
      const resetForm = () => { setForm(emptyForm); setConditions(EMPTY_CONDITIONS); setPin(null) }

      if (employerCheck === 'guest' && postMode === 'email') {
        // "이메일로 등록" — 화면엔 별도 가입 단계를 안 보여주고, 뒤에서
        // 무작위 비밀번호로 계정을 만든 뒤 비밀번호 설정 이메일을 보낸다.
        const email = guestEmail.trim()
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password: randomPassword(),
          options: { data: { name: form.company.trim(), role: 'employer' } },
        })
        if (signUpError) {
          if (signUpError.message.toLowerCase().includes('already registered') || signUpError.status === 422) {
            throw new Error('Email này đã có tài khoản. Vui lòng đăng nhập trước khi đăng tin.')
          }
          throw new Error(signUpError.message)
        }
        const newUserId = signUpData.user?.id
        if (!newUserId || !signUpData.session) {
          // 예상과 달리 이메일 인증이 필요한 상태였던 경우 — 계정은 생겼지만
          // 지금 당장 세션이 없어 공고를 그 계정으로 저장할 수 없다.
          throw new Error('Không thể tạo tài khoản tự động. Vui lòng thử lại hoặc đăng ký thủ công.')
        }
        const deadline = deadlineOr(14)
        const job = await addPostedJob({ ...baseFields, applicationDeadline: deadline, employerId: newUserId })
        await savePin(job.id, null)
        await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/dat-lai-mat-khau`,
        })
        resetForm()
        setImageFile(null)
        setImagePreview(null)
        setEmailSuccess({ jobId: job.id, email })
      } else if (employerCheck === 'guest' && postMode === 'quick') {
        // "Đăng nhanh, không cần đăng ký" — 계정 없이, 클라이언트가 만든
        // 무작위 토큰만으로 등록(local_jobs_guest_insert RLS 참고). 관리자
        // 손길 없이도 자연히 정리되도록 마감일을 14일이 아니라 7일로
        // 짧게 잡는다(관리 링크를 잃어버려도 방치 기간이 짧음).
        const token = crypto.randomUUID()
        const deadline = deadlineOr(7)
        const job = await addPostedJob({
          ...baseFields,
          applicationDeadline: deadline,
          employerId: undefined,
          guestManageToken: token,
        })
        await savePin(job.id, token)
        const rawId = job.id.replace(/^sb-/, '')
        resetForm()
        setImageFile(null)
        setImagePreview(null)
        setGuestSuccess({
          jobId: job.id,
          manageUrl: `${window.location.origin}/quan-ly-tin/${rawId}?token=${token}`,
        })
      } else {
        // 기존 기업 계정 경로 — 그대로 유지.
        const deadline = deadlineOr(14)
        const job = await addPostedJob({ ...baseFields, applicationDeadline: deadline, employerId: user?.id })
        await savePin(job.id, null)
        resetForm()
        setImageFile(null)
        setImagePreview(null)
        navigate(`/viec-lam/${job.id}`, { replace: true })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  if (guestSuccess) {
    return (
      <div className="page page--narrow post-job">
        <header className="page-header">
          <h1 className="page-header__title">Đăng tin thành công!</h1>
        </header>
        <div className="form-card">
          <p>Tin của bạn đã hiển thị công khai ngay bây giờ.</p>
          {pinWarning && <p className="jcf-help">Chưa lưu được vị trí trên bản đồ. Bạn có thể chọn lại ở trang quản lý tin.</p>}
          <p>
            <strong>Lưu lại link này để sau này chỉnh sửa hoặc ngừng đăng tin</strong> — vì bạn đăng không qua tài
            khoản, đây là cách duy nhất để quản lý tin sau này:
          </p>
          <div className="post-job-manage-link">
            <input className="field__input" readOnly value={guestSuccess.manageUrl}
              onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className="btn btn--ghost btn--sm"
              onClick={() => navigator.clipboard.writeText(guestSuccess.manageUrl)}>
              Sao chép
            </button>
          </div>
          <div className="form-actions" style={{ marginTop: '1rem' }}>
            <button type="button" className="btn btn--primary" onClick={() => navigate(`/viec-lam/${guestSuccess.jobId}`)}>
              Xem tin đã đăng
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setGuestSuccess(null)}>
              Đăng tin khác
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (emailSuccess) {
    return (
      <div className="page page--narrow post-job">
        <header className="page-header">
          <h1 className="page-header__title">Đăng tin thành công!</h1>
        </header>
        <div className="form-card">
          <p>Tin của bạn đã hiển thị công khai ngay bây giờ.</p>
          <p>
            Chúng tôi đã gửi một email đến <strong>{emailSuccess.email}</strong> để bạn đặt mật khẩu — dùng email
            đó để đăng nhập và quản lý tin đăng trong bảng điều khiển nhà tuyển dụng sau này.
          </p>
          <div className="form-actions">
            <button type="button" className="btn btn--primary" onClick={() => navigate(`/viec-lam/${emailSuccess.jobId}`)}>
              Xem tin đã đăng
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 2026-10-30 Lee: 알바몬 일반공고와 같은 디자인(PostJob.css). 순서: 모집내용 → 근무조건 → 근무지 정보 → 접수기간·방법 → 담당자정보 → 상세모집요강.
  const set = <K extends keyof typeof emptyForm>(k: K, v: (typeof emptyForm)[K]) => setForm((f) => ({ ...f, [k]: v }))
  const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
  const phoneBad = !!form.employerPhone.trim() && !normalizeVnPhone(form.employerPhone)
  const demogText = [form.gender ? (form.gender === 'Nam/nữ' ? 'Nam và nữ' : form.gender) : 'Không yêu cầu giới tính',
    composeAge(form.ageMin, form.ageMax) || 'Không yêu cầu tuổi', form.education || 'Không yêu cầu học vấn'].join(', ')
  const benefitText = [conditions.shuttleBus && 'Xe đưa đón', conditions.dormitory && 'Ký túc xá', conditions.mealProvided && 'Ăn ca',
    ...form.benefitTags, form.insurance && 'Bảo hiểm'].filter(Boolean).join(', ')

  return (
    <div className="pj">
      <h1 className="pj__title">Đăng tin tuyển dụng</h1>
      <p className="pj__lead">Nhà tuyển dụng đăng việc miễn phí — tiếp cận ứng viên ngay hôm nay.</p>

      <form onSubmit={onSubmit} noValidate>
        {error && <p className="pj-form-error" role="alert" ref={errorRef}>{error}</p>}

        {employerCheck === 'guest' && (
          <div className="pj-mode">
            <div className="pj-seg" role="group" aria-label="Cách đăng tin">
              <button type="button" aria-pressed={postMode === 'quick'} onClick={() => setPostMode('quick')}>Đăng nhanh, không cần đăng ký</button>
              <button type="button" aria-pressed={postMode === 'email'} onClick={() => setPostMode('email')}>Đăng ký bằng email</button>
            </div>
            {postMode === 'quick' ? (
              <p className="pj-hint" style={{ marginTop: 10 }}>Tin hiển thị ngay và <strong>tự động hết hạn sau 7 ngày</strong> nếu không chọn hạn nộp. Sau khi đăng bạn nhận một link riêng để sửa/ngừng đăng — hãy lưu lại link đó.</p>
            ) : (
              <div className="pj-line" style={{ marginTop: 10 }}>
                <input ref={guestEmailRef} className="pj-input pj-input--grow" type="email" value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)} placeholder="Email (gửi link đặt mật khẩu)" autoComplete="email" />
              </div>
            )}
          </div>
        )}

        <section className="pj-sec">
          <h2 className="pj-sec__h">Nội dung tuyển dụng</h2>
          <Row label="Tiêu đề" req>
            <div className="pj-line">
              <input ref={titleRef} className="pj-input pj-input--grow" maxLength={40} value={form.title} onChange={(e) => set('title', e.target.value)}
                placeholder="Nhập tiêu đề (tối đa 40 ký tự / ví dụ: Tuyển công nhân lắp ráp linh kiện)" />
              <span className="pj-count">{form.title.length}/40</span>
            </div>
          </Row>
          <Row label="Ngành nghề" req>
            <div className="pj-line">
              <select className="pj-select" style={{ flex: '1 1 220px' }} value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as JobCategory, subcategory: '' }))}>
                {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
              {subcategoryOptions && (
                <select className="pj-select" style={{ flex: '1 1 220px' }} value={form.subcategory} onChange={(e) => set('subcategory', e.target.value)}>
                  <option value="">Phân loại chi tiết</option>
                  {Object.entries(subcategoryOptions).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              )}
            </div>
          </Row>
          <Row label="Hình thức" req>
            <div className="pj-chips" role="group" aria-label="Hình thức làm việc">
              {([['full_time', 'Chính thức'], ['seasonal', 'Thời vụ'], ['part_time', 'Part-time']] as const).map(([v, t], i) => (
                <button key={v} ref={i === 0 ? employmentRef : undefined} type="button" aria-pressed={form.employmentType === v} onClick={() => set('employmentType', v)}>{t}</button>
              ))}
              <button type="button" aria-pressed={conditions.recruitmentType === 'agency'}
                onClick={() => setConditions((c) => ({ ...c, recruitmentType: c.recruitmentType === 'agency' ? null : 'agency' }))}>{RECRUITMENT_LABELS.agency}</button>
            </div>
          </Row>
          <Row label="Số lượng tuyển" req>
            <div className="pj-line">
              <input ref={hiresRef} inputMode="numeric" className="pj-input pj-input--num" value={form.hires} disabled={form.hiresUndecided}
                onChange={(e) => set('hires', e.target.value.replace(/\D/g, ''))} />
              <span className="pj-suffix">người</span>
              <Check checked={form.hiresUndecided} onChange={(v) => set('hiresUndecided', v)}>Chưa xác định</Check>
            </div>
          </Row>
          <Row label="Giới tính·Tuổi·Học vấn" req>
            <div className="pj-line">
              <span>{demogText}</span>
              <button type="button" className="pj-link" onClick={() => setShowDemog((v) => !v)}>Thay đổi {showDemog ? '▴' : '▾'}</button>
            </div>
            {showDemog && (
              <div className="pj-panel">
                <div className="pj-chips" role="group" aria-label="Giới tính">
                  {([['', 'Không yêu cầu'], ['Nam', 'Nam'], ['Nữ', 'Nữ'], ['Nam/nữ', 'Nam và nữ']] as const).map(([v, t]) => (
                    <button key={t} type="button" aria-pressed={form.gender === v} onClick={() => set('gender', v)}>{t}</button>
                  ))}
                </div>
                {form.gender === 'Nam/nữ' && (
                  <div className="pj-line">
                    <span>Nam</span><input inputMode="numeric" className="pj-input" style={{ width: 90 }} value={form.genderMale} onChange={(e) => set('genderMale', e.target.value.replace(/\D/g, ''))} aria-label="Số nam" />
                    <span>Nữ</span><input inputMode="numeric" className="pj-input" style={{ width: 90 }} value={form.genderFemale} onChange={(e) => set('genderFemale', e.target.value.replace(/\D/g, ''))} aria-label="Số nữ" />
                    <span className="pj-hint">(tuỳ chọn)</span>
                  </div>
                )}
                <div className="pj-line">
                  <input ref={ageRef} inputMode="numeric" className="pj-input" style={{ width: 90 }} value={form.ageMin} onChange={(e) => set('ageMin', e.target.value.replace(/\D/g, ''))} placeholder="18" aria-label="Tuổi từ" />
                  <span>~</span>
                  <input inputMode="numeric" className="pj-input" style={{ width: 90 }} value={form.ageMax} onChange={(e) => set('ageMax', e.target.value.replace(/\D/g, ''))} placeholder="45" aria-label="Tuổi đến" />
                  <span>tuổi</span>
                  <select className="pj-select" style={{ width: 200 }} value={form.education} onChange={(e) => set('education', e.target.value)} aria-label="Học vấn">
                    <option value="">Không yêu cầu học vấn</option><option>THCS</option><option>THPT</option><option>Trung cấp</option><option>Cao đẳng</option><option>Đại học</option>
                  </select>
                </div>
              </div>
            )}
          </Row>
          <Row label="Ưu tiên">
            <input className="pj-input" value={form.preference} onChange={(e) => set('preference', e.target.value)}
              placeholder="Kinh nghiệm, ở gần, ... (tuỳ chọn)" />
            <Check checked={conditions.immediateStart === true} onChange={(v) => setConditions((c) => ({ ...c, immediateStart: v ? true : null }))}>Đi làm ngay</Check>
          </Row>
        </section>

        <section className="pj-sec">
          <h2 className="pj-sec__h">Điều kiện làm việc</h2>
          <Row label="Thời hạn làm việc">
            <div className="pj-seg" role="group" aria-label="Thời hạn làm việc">
              {JOB_DURATION_OPTIONS.map((d) => (
                <button key={d} type="button" aria-pressed={form.jobDuration === d} onClick={() => set('jobDuration', form.jobDuration === d ? '' : d)}>{d}</button>
              ))}
            </div>
          </Row>
          <Row label="Ngày làm việc">
            <div className="pj-days" role="group" aria-label="Ngày làm việc">
              {DAYS.map((d) => (
                <button key={d} type="button" aria-pressed={form.workDays.includes(d)}
                  onClick={() => set('workDays', form.workDays.includes(d) ? form.workDays.filter((x) => x !== d) : DAYS.filter((x) => x === d || form.workDays.includes(x)))}>{d}</button>
              ))}
            </div>
            <div className="pj-checks">
              <Check checked={form.daysNegotiable} onChange={(v) => set('daysNegotiable', v)}>Thỏa thuận</Check>
            </div>
          </Row>
          <Row label="Giờ làm việc" req>
            <div className="pj-line">
              <input ref={timeRef} type="time" className="pj-input pj-input--round" style={{ width: 180 }} value={form.timeStart} disabled={form.hoursNegotiable}
                onChange={(e) => set('timeStart', e.target.value)} aria-label="Giờ bắt đầu" />
              <input type="time" className="pj-input pj-input--round" style={{ width: 180 }} value={form.timeEnd} disabled={form.hoursNegotiable}
                onChange={(e) => set('timeEnd', e.target.value)} aria-label="Giờ kết thúc" />
              <span className="pj-suffix">Nghỉ</span>
              <input inputMode="numeric" className="pj-input pj-input--round" style={{ width: 90 }} value={form.breakMinutes} disabled={form.hoursNegotiable}
                onChange={(e) => set('breakMinutes', e.target.value.replace(/\D/g, ''))} placeholder="60" aria-label="Phút nghỉ" />
              <span className="pj-suffix">phút</span>
            </div>
            <div className="pj-chips" role="group" aria-label="Ca làm việc">
              {(['day', 'night', 'rotating'] as ShiftType[]).map((v) => (
                <button key={v} type="button" aria-pressed={conditions.shiftType === v}
                  onClick={() => setConditions((c) => ({ ...c, shiftType: c.shiftType === v ? null : v }))}>{SHIFT_LABELS[v]}</button>
              ))}
            </div>
            <div className="pj-checks">
              <Check checked={form.hoursNegotiable} onChange={(v) => set('hoursNegotiable', v)}>Thỏa thuận</Check>
              <Check checked={conditions.weekendWork === true} onChange={(v) => setConditions((c) => ({ ...c, weekendWork: v ? true : null }))}>Làm cuối tuần</Check>
            </div>
          </Row>
          <Row label="Lương" req>
            <div className="pj-line">
              <select className="pj-select pj-select--round" style={{ width: 140 }} value={form.salaryUnit} disabled={form.salaryNegotiable}
                onChange={(e) => set('salaryUnit', e.target.value as PayUnit)}>
                <option value="hour">Theo giờ</option><option value="day">Theo ngày</option><option value="month">Theo tháng</option>
              </select>
              <input ref={salaryRef} className="pj-input pj-input--round" style={{ flex: '1 1 220px' }} value={form.salaryAmount} disabled={form.salaryNegotiable}
                onChange={(e) => set('salaryAmount', e.target.value)} placeholder="Nhập số tiền (ví dụ 9.000.000 đ)" />
            </div>
            <div className="pj-checks">
              <Check checked={form.salaryNegotiable} onChange={(v) => set('salaryNegotiable', v)}>Thỏa thuận</Check>
              <Check checked={form.salaryIncludesOvertime} onChange={(v) => set('salaryIncludesOvertime', v)}>Đã gồm tăng ca</Check>
              <Check checked={form.payMethod === 'Theo tuần'} onChange={(v) => set('payMethod', v ? 'Theo tuần' : '')}>Trả theo tuần</Check>
              <Check checked={form.payMethod === 'Theo ngày'} onChange={(v) => set('payMethod', v ? 'Theo ngày' : '')}>Trả theo ngày</Check>
            </div>
            <input className="pj-input pj-input--round" value={form.allowance} onChange={(e) => set('allowance', e.target.value)}
              placeholder="Phụ cấp · Thưởng (tuỳ chọn, ví dụ: Chuyên cần 500.000đ/tháng)" />
          </Row>
          <Row label="Phúc lợi">
            <div className="pj-line">
              <input className="pj-input pj-input--round pj-input--grow" readOnly value={benefitText}
                placeholder="Xe đưa đón, Ký túc xá, Ăn ca, Bảo hiểm... chọn phúc lợi" onClick={() => setShowBenefits(true)} />
              <button type="button" className="pj-btn-dark" onClick={() => setShowBenefits((v) => !v)}>Chọn</button>
            </div>
            {showBenefits && (
              <div className="pj-panel">
                <div className="pj-checks">
                  <Check checked={conditions.shuttleBus === true} onChange={(v) => setConditions((c) => ({ ...c, shuttleBus: v ? true : null }))}>Xe đưa đón</Check>
                  <Check checked={conditions.dormitory === true} onChange={(v) => setConditions((c) => ({ ...c, dormitory: v ? true : null }))}>Ký túc xá</Check>
                  <Check checked={conditions.mealProvided === true} onChange={(v) => setConditions((c) => ({ ...c, mealProvided: v ? true : null }))}>Ăn ca</Check>
                  {BENEFIT_TAG_OPTIONS.map((t) => (
                    <Check key={t} checked={form.benefitTags.includes(t)}
                      onChange={(v) => set('benefitTags', v ? [...form.benefitTags, t] : form.benefitTags.filter((x) => x !== t))}>{t}</Check>
                  ))}
                  <Check checked={form.insurance} onChange={(v) => set('insurance', v)}>Bảo hiểm (BHXH/BHYT)</Check>
                </div>
                <input className="pj-input" value={form.benefitOther} onChange={(e) => set('benefitOther', e.target.value)} placeholder="Phúc lợi khác (tuỳ chọn)" />
              </div>
            )}
          </Row>
        </section>

        <section className="pj-sec">
          <h2 className="pj-sec__h">Nơi làm việc</h2>
          <Row label="Địa chỉ" req>
            <input ref={streetRef} className="pj-input" value={form.street} onChange={(e) => set('street', e.target.value)} placeholder="Số nhà, đường (ví dụ: 33 Lý Thái Tổ)" />
            <div className="pj-map">
              <div className="pj-map__bar">
                <span>{pin ? `Đã chọn: ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}` : 'Bấm vào bản đồ để chọn đúng nơi làm việc'}</span>
                <span className="pj-line">
                  <button type="button" onClick={useMyLocation}>◎ Vị trí hiện tại</button>
                  {pin && <button type="button" onClick={() => setPin(null)}>↻ Đặt lại</button>}
                </span>
              </div>
              <VietMapPinPicker value={pin} center={mapCenter} onChange={setPin} />
            </div>
          </Row>
          <Row label="Khu vực" req count={`${[form.province, form.ward].filter(Boolean).length}/2`}>
            <div className="pj-line">
              <select className="pj-select" style={{ flex: '1 1 200px' }} value={form.province} onChange={(e) => setForm((f) => ({ ...f, province: e.target.value, ward: '' }))}>
                <option value="">Tỉnh / Thành phố</option>
                {VN_PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <select className="pj-select" style={{ flex: '1 1 200px' }} value={form.ward} disabled={!form.province} onChange={(e) => set('ward', e.target.value)}>
                <option value="">Phường / Xã</option>
                {(VN_WARDS_BY_PROVINCE[form.province] ?? []).map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
          </Row>
          <Row label="KCN / Nhà máy">
            <input className="pj-input" value={form.park} onChange={(e) => set('park', e.target.value)} placeholder="Ví dụ: KCN Quế Võ III (tuỳ chọn)" />
          </Row>
          <Row label="Tên công ty" req count={`${form.company.length}/30`}>
            <input ref={companyRef} className="pj-input" maxLength={30} value={form.company} onChange={(e) => set('company', e.target.value)} placeholder="Công ty TNHH ..." />
            <div className="pj-note">Gợi ý: Tên công ty + (chi nhánh). Không ghi quảng cáo quá mức.</div>
          </Row>
          <Row label="Ảnh">
            <div className="pj-line">
              <div className="pj-photo" onClick={() => fileInputRef.current?.click()}>
                {imagePreview ? <img src={imagePreview} alt="preview" /> : '⊕ Thêm ảnh'}
              </div>
              {imagePreview && <button type="button" className="pj-link" onClick={() => { setImageFile(null); setImagePreview(null) }}>Xoá ảnh</button>}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onImageChange} />
          </Row>
        </section>

        <section className="pj-sec">
          <h2 className="pj-sec__h">Hạn nộp · Cách ứng tuyển</h2>
          <Row label="Hạn nộp hồ sơ" req>
            <div className="pj-line">
              <div className="pj-seg" role="group" aria-label="Hạn nộp">
                <button type="button" aria-pressed={!form.ongoing} onClick={() => set('ongoing', false)}>Chọn ngày</button>
                {!quickGuestMode && <button type="button" aria-pressed={form.ongoing} onClick={() => setForm((f) => ({ ...f, ongoing: true, applicationDeadline: '' }))}>Tuyển liên tục</button>}
              </div>
              {!form.ongoing && <input ref={deadlineRef} type="date" className="pj-input" style={{ width: 200 }} value={form.applicationDeadline} onChange={(e) => set('applicationDeadline', e.target.value)} />}
            </div>
            {quickGuestMode && <p className="pj-hint">• Đăng nhanh: để trống = hết hạn sau 7 ngày.</p>}
          </Row>
          <Row label="Quy trình tuyển dụng">
            <input className="pj-input" value={form.process} onChange={(e) => set('process', e.target.value)} placeholder="Ví dụ: Phỏng vấn trực tiếp, mang CCCD (tuỳ chọn)" />
          </Row>
        </section>

        <section className="pj-sec">
          <h2 className="pj-sec__h">Người liên hệ</h2>
          <Row label="Điện thoại" req>
            <div className="pj-line">
              <input ref={employerPhoneRef} className={`pj-input${phoneBad ? ' pj-input--bad' : ''}`} style={{ width: 320 }} value={form.employerPhone}
                onChange={(e) => set('employerPhone', e.target.value)} inputMode="tel" autoComplete="tel" placeholder="0912 345 678" />
              <Check checked={form.zaloSameAsPhone} onChange={(v) => set('zaloSameAsPhone', v)}>Zalo cùng số</Check>
            </div>
            {phoneBad && <p className="pj-error">Số điện thoại không hợp lệ</p>}
            {!form.zaloSameAsPhone && (
              <input ref={zaloRef} className="pj-input" style={{ width: 320 }} value={form.zalo} onChange={(e) => set('zalo', e.target.value)} inputMode="tel" placeholder="Số Zalo" />
            )}
          </Row>
          <Row label="Tuỳ chọn">
            <div className="pj-checks">
              <Check checked={form.urgent} onChange={(v) => set('urgent', v)}>🔥 Tuyển gấp</Check>
              <Check checked={form.laborContractPledge} onChange={(v) => set('laborContractPledge', v)}>Cam kết ký hợp đồng lao động rõ ràng</Check>
            </div>
          </Row>
        </section>

        <section className="pj-sec">
          <h2 className="pj-sec__h">Mô tả công việc</h2>
          <Row label="Nội dung công việc" req>
            <textarea ref={descriptionRef} className="pj-textarea" value={form.work} onChange={(e) => set('work', e.target.value)} placeholder="Nhập nội dung công việc" />
          </Row>
          <Row label="Tăng ca">
            <input className="pj-input" value={form.overtime} onChange={(e) => set('overtime', e.target.value)} placeholder="Tiền tăng ca, hệ số (ví dụ: 45.000đ/giờ, x1.5)" />
          </Row>
          <Row label="Môi trường làm việc">
            <input className="pj-input" value={form.environment} onChange={(e) => set('environment', e.target.value)} placeholder="(tuỳ chọn)" />
          </Row>
        </section>

        <div className="pj-bar">
          <button type="button" className="pj-bar__ghost" disabled={submitting}
            onClick={() => { setForm(emptyForm); setConditions(EMPTY_CONDITIONS); setPin(null); setImageFile(null); setImagePreview(null) }}>Xoá form</button>
          <button type="submit" className="pj-bar__main" disabled={submitting || employerCheck === 'checking'}>{submitting ? 'Đang đăng...' : 'Đăng tin'}</button>
        </div>
      </form>
    </div>
  )
}
