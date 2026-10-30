import { FormEvent, RefObject, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ALL_CATEGORIES, CATEGORY_LABELS } from '../data/categories'
import { JOB_DURATION_OPTIONS } from '../data/jobDuration'
import { VN_PROVINCES } from '../data/vnProvinces'
import { VN_WARDS_BY_PROVINCE } from '../data/vnWards'
import { SUBCATEGORY_LABELS } from '../data/subcategories'
import { useAuth } from '../context/AuthContext'
import { useJobs } from '../context/JobsContext'
import { checkIsEmployer } from '../lib/accountRoles'
import { supabase } from '../lib/supabase'
import { Choice, Tri } from '../components/job-form/JobConditionsFields'
import VietMapPinPicker from '../components/job-form/VietMapPinPicker'
import { findRegionCenter } from '../lib/jobCoords'
import { RECRUITMENT_LABELS, SCHEDULE_LABELS, SHIFT_LABELS } from '../lib/jobConditions'
import { BENEFIT_TAG_OPTIONS, composeAge, composeDescription, composeHires, composeHours, composeLocation, composeSalary, normalizeVnPhone, type GenderChoice, type PayUnit } from '../lib/postJobForm'
import type { PinPoint } from '../components/job-form/LocationPinPicker'
import { EMPTY_CONDITIONS, type JobConditions } from '../lib/jobConditions'
import type { JobCategory, RecruitmentType, ShiftType, WorkSchedule } from '../types/job'

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
    const hours = composeHours(form.timeStart, form.timeEnd, form.breakMinutes)
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

  return (
    <div className="page page--narrow post-job">
      <header className="page-header">
        <h1 className="page-header__title">Đăng tin tuyển dụng</h1>
        <p className="page-header__lead">
          Nhà tuyển dụng đăng việc miễn phí — tiếp cận ứng viên ngay hôm nay.
        </p>
      </header>

      <form className="form-card" onSubmit={onSubmit} noValidate>
        {error && <p className="form-error" role="alert" ref={errorRef}>{error}</p>}

        {employerCheck === 'guest' && (
          <fieldset className="role-picker">
            <legend className="role-picker__legend">Cách đăng tin</legend>
            <div className="role-picker__options" role="group">
              <button
                type="button"
                className={`role-picker__btn${postMode === 'quick' ? ' role-picker__btn--active' : ''}`}
                onClick={() => setPostMode('quick')}
              >
                ⚡ Đăng nhanh, không cần đăng ký
              </button>
              <button
                type="button"
                className={`role-picker__btn${postMode === 'email' ? ' role-picker__btn--active' : ''}`}
                onClick={() => setPostMode('email')}
              >
                📧 Đăng ký bằng email
              </button>
            </div>
            {postMode === 'quick' ? (
              <p className="hint">
                Tin hiển thị ngay lập tức và <strong>tự động hết hạn sau 7 ngày</strong> nếu bạn không chọn hạn nộp
                khác bên dưới. Sau khi đăng, bạn sẽ nhận được một link riêng để chỉnh sửa/ngừng đăng/gia hạn — hãy
                lưu lại link đó vì đây là cách duy nhất để quản lý tin (không có tài khoản).
              </p>
            ) : (
              <label className="field">
                <span className="field__label">Email *</span>
                <input ref={guestEmailRef} className="field__input" type="email" value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="example@email.com" autoComplete="email" />
                <span className="hint">Chúng tôi sẽ gửi link đặt mật khẩu để bạn đăng nhập quản lý tin sau này.</span>
              </label>
            )}
          </fieldset>
        )}

        {/* 0. Cơ bản */}
        <label className="field">
          <span className="field__label">Tiêu đề công việc *</span>
          <input ref={titleRef} className="field__input" value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Ví dụ: Nhân viên phục vụ ca tối" />
        </label>

        <label className="field">
          <span className="field__label">Tên công ty / đơn vị *</span>
          <input ref={companyRef} className="field__input" value={form.company}
            onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
            placeholder="Công ty TNHH ..." />
        </label>

        {/* ① Điều kiện làm việc */}
        <fieldset className="jcf-section">
          <legend>① Điều kiện làm việc</legend>
          <div className="field">
            <span className="field__label">Lương *</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input ref={salaryRef} className="field__input" style={{ flex: '1 1 160px', minWidth: 0 }} value={form.salaryAmount} disabled={form.salaryNegotiable}
                onChange={(e) => setForm((f) => ({ ...f, salaryAmount: e.target.value }))} placeholder="Ví dụ: 9.000.000 đ" />
              <select className="field__input" style={{ flex: '0 0 120px' }} value={form.salaryUnit} disabled={form.salaryNegotiable}
                onChange={(e) => setForm((f) => ({ ...f, salaryUnit: e.target.value as PayUnit }))}>
                <option value="hour">/ giờ</option><option value="day">/ ngày</option><option value="month">/ tháng</option>
              </select>
            </div>
            <label className="field field--row"><input type="checkbox" checked={form.salaryNegotiable}
              onChange={(e) => setForm((f) => ({ ...f, salaryNegotiable: e.target.checked }))} /><span className="field__label">Thỏa thuận</span></label>
            <label className="field field--row"><input type="checkbox" checked={form.salaryIncludesOvertime} disabled={form.salaryNegotiable}
              onChange={(e) => setForm((f) => ({ ...f, salaryIncludesOvertime: e.target.checked }))} /><span className="field__label">Đã gồm tăng ca</span></label>
          </div>
          <label className="field">
            <span className="field__label">Phụ cấp · Thưởng</span>
            <input className="field__input" value={form.allowance} onChange={(e) => setForm((f) => ({ ...f, allowance: e.target.value }))}
              placeholder="Ví dụ: Chuyên cần 500.000đ/tháng" />
          </label>
          <label className="field">
            <span className="field__label">Trả lương</span>
            <select className="field__input" value={form.payMethod} onChange={(e) => setForm((f) => ({ ...f, payMethod: e.target.value }))}>
              <option value="">— Không chọn —</option><option>Theo tháng</option><option>Theo tuần</option><option>Theo ngày</option>
            </select>
          </label>
          <div className="field">
            <span className="field__label">Thời gian làm việc *</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input ref={timeRef} type="time" className="field__input" style={{ flex: '0 1 130px' }} value={form.timeStart}
                onChange={(e) => setForm((f) => ({ ...f, timeStart: e.target.value }))} aria-label="Giờ bắt đầu" />
              <span>~</span>
              <input type="time" className="field__input" style={{ flex: '0 1 130px' }} value={form.timeEnd}
                onChange={(e) => setForm((f) => ({ ...f, timeEnd: e.target.value }))} aria-label="Giờ kết thúc" />
              <span>Nghỉ</span>
              <input inputMode="numeric" className="field__input" style={{ flex: '0 1 80px' }} value={form.breakMinutes}
                onChange={(e) => setForm((f) => ({ ...f, breakMinutes: e.target.value.replace(/\D/g, '') }))} placeholder="60" aria-label="Phút nghỉ" />
              <span>phút</span>
            </div>
          </div>
          <Choice<ShiftType> label="Ca làm việc" value={conditions.shiftType}
            options={(['day', 'night', 'rotating', 'other'] as ShiftType[]).map((v) => [v, SHIFT_LABELS[v]])}
            onChange={(v) => setConditions((c) => ({ ...c, shiftType: v }))} />
          <Choice<WorkSchedule> label="Ngày làm việc" value={conditions.workSchedule}
            options={(['5_days', '6_days', 'other'] as WorkSchedule[]).map((v) => [v, SCHEDULE_LABELS[v]])}
            onChange={(v) => setConditions((c) => ({ ...c, workSchedule: v }))} />
          <Tri label="Làm cuối tuần" value={conditions.weekendWork} onChange={(v) => setConditions((c) => ({ ...c, weekendWork: v }))} />
          <label className="field">
            <span className="field__label">Thời hạn làm việc</span>
            <select className="field__input" value={form.jobDuration} onChange={(e) => setForm((f) => ({ ...f, jobDuration: e.target.value }))}>
              <option value="">— Không chọn —</option>
              {JOB_DURATION_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <div className="jcf-row" role="radiogroup" aria-label="Hình thức làm việc">
            <span className="jcf-row__label">Hình thức làm việc *</span>
            <div className="jcf-seg">
              {([['full_time', 'Chính thức'], ['seasonal', 'Thời vụ'], ['part_time', 'Part-time']] as const).map(([v, t], i) => (
                <button key={v} ref={i === 0 ? employmentRef : undefined} type="button" role="radio" aria-checked={form.employmentType === v}
                  className={form.employmentType === v ? 'is-on' : ''} onClick={() => setForm((f) => ({ ...f, employmentType: v }))}>{t}</button>
              ))}
            </div>
          </div>
          <Choice<Exclude<RecruitmentType, 'unknown'>> label="Hình thức tuyển"
            value={conditions.recruitmentType === 'unknown' ? null : conditions.recruitmentType}
            options={[['direct', RECRUITMENT_LABELS.direct], ['agency', RECRUITMENT_LABELS.agency]]}
            onChange={(v) => setConditions((c) => ({ ...c, recruitmentType: v }))} />
          <label className="field">
            <span className="field__label">Ngành nghề *</span>
            <select className="field__input" value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as JobCategory, subcategory: '' }))}>
              {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
          </label>
          {subcategoryOptions && (
            <label className="field">
              <span className="field__label">Phân loại chi tiết</span>
              <select className="field__input" value={form.subcategory} onChange={(e) => setForm((f) => ({ ...f, subcategory: e.target.value }))}>
                <option value="">— Không chọn —</option>
                {Object.entries(subcategoryOptions).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
          )}
          <span className="field__label">Phúc lợi</span>
          <Tri label="Xe đưa đón" value={conditions.shuttleBus} onChange={(v) => setConditions((c) => ({ ...c, shuttleBus: v }))} />
          <Tri label="Ký túc xá" value={conditions.dormitory} onChange={(v) => setConditions((c) => ({ ...c, dormitory: v }))} />
          <Tri label="Ăn ca" value={conditions.mealProvided} onChange={(v) => setConditions((c) => ({ ...c, mealProvided: v }))} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', margin: '6px 0' }}>
            {BENEFIT_TAG_OPTIONS.map((t) => (
              <label key={t} className="field field--row" style={{ margin: 0 }}>
                <input type="checkbox" checked={form.benefitTags.includes(t)}
                  onChange={(e) => setForm((f) => ({ ...f, benefitTags: e.target.checked ? [...f.benefitTags, t] : f.benefitTags.filter((x) => x !== t) }))} />
                <span className="field__label">{t}</span>
              </label>
            ))}
            <label className="field field--row" style={{ margin: 0 }}>
              <input type="checkbox" checked={form.insurance} onChange={(e) => setForm((f) => ({ ...f, insurance: e.target.checked }))} />
              <span className="field__label">Bảo hiểm (BHXH/BHYT)</span>
            </label>
          </div>
          <input className="field__input" value={form.benefitOther} onChange={(e) => setForm((f) => ({ ...f, benefitOther: e.target.value }))}
            placeholder="Phúc lợi khác (tuỳ chọn)" aria-label="Phúc lợi khác" />
        </fieldset>

        {/* ② Thông tin tuyển dụng */}
        <fieldset className="jcf-section">
          <legend>② Thông tin tuyển dụng</legend>
          <div className="field">
            <span className="field__label">{quickGuestMode ? 'Hạn nộp hồ sơ * (để trống = 7 ngày)' : 'Hạn nộp hồ sơ *'}</span>
            <input ref={deadlineRef} className="field__input" type="date" value={form.applicationDeadline} disabled={form.ongoing}
              onChange={(e) => setForm((f) => ({ ...f, applicationDeadline: e.target.value }))} />
            {!quickGuestMode && (
              <label className="field field--row"><input type="checkbox" checked={form.ongoing}
                onChange={(e) => setForm((f) => ({ ...f, ongoing: e.target.checked, applicationDeadline: e.target.checked ? '' : f.applicationDeadline }))} />
                <span className="field__label">Tuyển liên tục (đến khi đủ)</span></label>
            )}
          </div>
          <div className="field">
            <span className="field__label">Số lượng tuyển *</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input ref={hiresRef} inputMode="numeric" className="field__input" style={{ flex: '0 1 120px' }} value={form.hires} disabled={form.hiresUndecided}
                onChange={(e) => setForm((f) => ({ ...f, hires: e.target.value.replace(/\D/g, '') }))} placeholder="10" />
              <span>người</span>
            </div>
            <label className="field field--row"><input type="checkbox" checked={form.hiresUndecided}
              onChange={(e) => setForm((f) => ({ ...f, hiresUndecided: e.target.checked }))} /><span className="field__label">Chưa xác định</span></label>
          </div>
          <div className="field">
            <span className="field__label">Độ tuổi</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input ref={ageRef} inputMode="numeric" className="field__input" style={{ flex: '0 1 90px' }} value={form.ageMin}
                onChange={(e) => setForm((f) => ({ ...f, ageMin: e.target.value.replace(/\D/g, '') }))} placeholder="18" aria-label="Tuổi từ" />
              <span>~</span>
              <input inputMode="numeric" className="field__input" style={{ flex: '0 1 90px' }} value={form.ageMax}
                onChange={(e) => setForm((f) => ({ ...f, ageMax: e.target.value.replace(/\D/g, '') }))} placeholder="45" aria-label="Tuổi đến" />
              <span>tuổi</span>
            </div>
          </div>
          <div className="jcf-row" role="radiogroup" aria-label="Giới tính">
            <span className="jcf-row__label">Giới tính</span>
            <div className="jcf-seg">
              {([['', 'Không yêu cầu'], ['Nam', 'Nam'], ['Nữ', 'Nữ'], ['Nam/nữ', 'Nam và nữ']] as const).map(([v, t]) => (
                <button key={t} type="button" role="radio" aria-checked={form.gender === v} className={form.gender === v ? 'is-on' : ''}
                  onClick={() => setForm((f) => ({ ...f, gender: v }))}>{t}</button>
              ))}
            </div>
          </div>
          {form.gender === 'Nam/nữ' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '6px 0 10px' }}>
              <span>Nam</span><input inputMode="numeric" className="field__input" style={{ flex: '0 1 80px' }} value={form.genderMale}
                onChange={(e) => setForm((f) => ({ ...f, genderMale: e.target.value.replace(/\D/g, '') }))} aria-label="Số nam" />
              <span>Nữ</span><input inputMode="numeric" className="field__input" style={{ flex: '0 1 80px' }} value={form.genderFemale}
                onChange={(e) => setForm((f) => ({ ...f, genderFemale: e.target.value.replace(/\D/g, '') }))} aria-label="Số nữ" />
              <span className="hint">(tuỳ chọn)</span>
            </div>
          )}
          <label className="field">
            <span className="field__label">Học vấn</span>
            <select className="field__input" value={form.education} onChange={(e) => setForm((f) => ({ ...f, education: e.target.value }))}>
              <option value="">— Không yêu cầu —</option><option>THCS</option><option>THPT</option><option>Trung cấp</option><option>Cao đẳng</option><option>Đại học</option>
            </select>
          </label>
          <label className="field">
            <span className="field__label">Kinh nghiệm · Ưu tiên · Yêu cầu khác</span>
            <input className="field__input" value={form.preference} onChange={(e) => setForm((f) => ({ ...f, preference: e.target.value }))}
              placeholder="Ví dụ: Không cần kinh nghiệm, ưu tiên ở gần" />
          </label>
          <Tri label="Đi làm ngay" value={conditions.immediateStart} onChange={(v) => setConditions((c) => ({ ...c, immediateStart: v }))} />
        </fieldset>

        {/* ③ Khu vực làm việc */}
        <fieldset className="jcf-section">
          <legend>③ Khu vực làm việc</legend>
          <p className="jcf-help">Bấm vào bản đồ để đặt ghim đúng nơi làm việc (cổng công ty/nhà máy).</p>
          <VietMapPinPicker value={pin} center={mapCenter} onChange={setPin} />
          <div className="jcf-pin-bar">
            <span>{pin ? `Đã chọn: ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}` : 'Chưa chọn vị trí trên bản đồ'}</span>
            <span className="jcf-pin-bar__actions">
              <button type="button" onClick={useMyLocation}>Dùng vị trí hiện tại</button>
              {pin && <button type="button" onClick={() => setPin(null)}>Xóa ghim</button>}
            </span>
          </div>
          <label className="field">
            <span className="field__label">Số nhà · Đường *</span>
            <input ref={streetRef} className="field__input" value={form.street} onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))}
              placeholder="Ví dụ: 33 Lý Thái Tổ" />
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <label className="field" style={{ flex: '1 1 200px', minWidth: 0 }}>
              <span className="field__label">Tỉnh / Thành phố *</span>
              <select className="field__input" value={form.province} onChange={(e) => setForm((f) => ({ ...f, province: e.target.value, ward: '' }))}>
                <option value="">— Chọn —</option>
                {VN_PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label className="field" style={{ flex: '1 1 200px', minWidth: 0 }}>
              <span className="field__label">Phường / Xã *</span>
              <select className="field__input" value={form.ward} disabled={!form.province} onChange={(e) => setForm((f) => ({ ...f, ward: e.target.value }))}>
                <option value="">— Chọn —</option>
                {(VN_WARDS_BY_PROVINCE[form.province] ?? []).map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </label>
          </div>
          <label className="field">
            <span className="field__label">KCN / Nhà máy</span>
            <input className="field__input" value={form.park} onChange={(e) => setForm((f) => ({ ...f, park: e.target.value }))}
              placeholder="Ví dụ: KCN Quế Võ III" />
          </label>
        </fieldset>

        {/* ④ Mô tả công việc */}
        <fieldset className="jcf-section">
          <legend>④ Mô tả công việc</legend>
          <label className="field">
            <span className="field__label">Nội dung công việc *</span>
            <textarea ref={descriptionRef} className="field__input field__textarea" rows={4} value={form.work}
              onChange={(e) => setForm((f) => ({ ...f, work: e.target.value }))} placeholder="Làm gì, ở đâu, dùng máy gì..." />
          </label>
          <label className="field">
            <span className="field__label">Tăng ca (tiền tăng ca, hệ số)</span>
            <input className="field__input" value={form.overtime} onChange={(e) => setForm((f) => ({ ...f, overtime: e.target.value }))}
              placeholder="Ví dụ: 45.000đ/giờ, x1.5 ngày thường" />
          </label>
          <label className="field">
            <span className="field__label">Môi trường làm việc</span>
            <input className="field__input" value={form.environment} onChange={(e) => setForm((f) => ({ ...f, environment: e.target.value }))} />
          </label>
          <label className="field">
            <span className="field__label">Quy trình tuyển dụng</span>
            <input className="field__input" value={form.process} onChange={(e) => setForm((f) => ({ ...f, process: e.target.value }))}
              placeholder="Ví dụ: Phỏng vấn trực tiếp, mang CCCD" />
          </label>
          <div className="field">
            <span className="field__label">Ảnh · Poster</span>
            <div
              style={{ border: '2px dashed #ddd', borderRadius: 8, padding: 16, textAlign: 'center', cursor: 'pointer', marginTop: 6 }}
              onClick={() => fileInputRef.current?.click()}
            >
              {imagePreview
                ? <img src={imagePreview} alt="preview" style={{ maxHeight: 160, borderRadius: 6, maxWidth: '100%' }} />
                : <p style={{ color: '#aaa', margin: 0 }}>Nhấn để chọn ảnh (JPG, PNG)</p>
              }
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onImageChange} />
            {imagePreview && (
              <button type="button" style={{ marginTop: 6, fontSize: 12, color: '#e53e3e', background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => { setImageFile(null); setImagePreview(null) }}>
                Xoá ảnh
              </button>
            )}
          </div>
          <label className="field">
            <span className="field__label">Số điện thoại liên hệ *</span>
            <input ref={employerPhoneRef} className="field__input" value={form.employerPhone}
              onChange={(e) => setForm((f) => ({ ...f, employerPhone: e.target.value }))}
              style={form.employerPhone.trim() && !normalizeVnPhone(form.employerPhone) ? { borderColor: '#d92d20' } : undefined}
              inputMode="tel" autoComplete="tel" placeholder="0900 000 000" />
            {form.employerPhone.trim() && !normalizeVnPhone(form.employerPhone) && <span className="hint" style={{ color: '#d92d20' }}>Số điện thoại không hợp lệ</span>}
          </label>
          <label className="field field--row"><input type="checkbox" checked={form.zaloSameAsPhone}
            onChange={(e) => setForm((f) => ({ ...f, zaloSameAsPhone: e.target.checked }))} /><span className="field__label">Zalo cùng số điện thoại</span></label>
          {!form.zaloSameAsPhone && (
            <label className="field">
              <span className="field__label">Zalo</span>
              <input ref={zaloRef} className="field__input" value={form.zalo} onChange={(e) => setForm((f) => ({ ...f, zalo: e.target.value }))}
                inputMode="tel" placeholder="0900 000 000" />
            </label>
          )}
          <label className="field field--row">
            <input type="checkbox" checked={form.urgent} onChange={(e) => setForm((f) => ({ ...f, urgent: e.target.checked }))} />
            <span className="field__label">🔥 Tuyển gấp</span>
          </label>
          <label className="field field--row">
            <input type="checkbox" checked={form.laborContractPledge} onChange={(e) => setForm((f) => ({ ...f, laborContractPledge: e.target.checked }))} />
            <span className="field__label">Cam kết ký hợp đồng lao động rõ ràng</span>
          </label>
        </fieldset>

        <div className="form-actions">
          <button type="submit" className="btn btn--primary" disabled={submitting || employerCheck === 'checking'}>
            {submitting ? 'Đang đăng...' : 'Đăng tin'}
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => { setForm(emptyForm); setConditions(EMPTY_CONDITIONS); setPin(null); setImageFile(null); setImagePreview(null) }} disabled={submitting}>
            Xoá form
          </button>
        </div>
      </form>
    </div>
  )
}
