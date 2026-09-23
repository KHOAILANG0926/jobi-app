import { FormEvent, RefObject, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ALL_CATEGORIES, CATEGORY_LABELS } from '../data/categories'
import { JOB_DURATION_OPTIONS } from '../data/jobDuration'
import { AGE_REQUIREMENT_OPTIONS, GENDER_REQUIREMENT_OPTIONS } from '../data/jobRequirements'
import { SUBCATEGORY_LABELS } from '../data/subcategories'
import { useAuth } from '../context/AuthContext'
import { useJobs } from '../context/JobsContext'
import { checkIsEmployer } from '../lib/accountRoles'
import { supabase } from '../lib/supabase'
import type { JobCategory } from '../types/job'

const emptyForm = {
  title: '',
  company: '',
  // 2026-09-19 수정 — 'other'는 구 8분류(2026-09-17 폐기) 잔재로 지금
  // JobCategory에 없는 값이라 여기 남아있으면 사용자가 대분류를 안 건드리고
  // 등록할 때 DB에 유효하지 않은 값이 들어가는 잠재 버그였음('khac'=기타가
  // 지금의 fallback).
  category: 'khac' as JobCategory,
  subcategory: '',
  salary: '',
  location: '',
  hours: '',
  jobDuration: '',
  genderRequirement: '',
  ageRequirement: '',
  description: '',
  employerPhone: '',
  applicationDeadline: '',
  urgent: false,
  laborContractPledge: false,
  socialInsurancePledge: false,
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
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const errorRef = useRef<HTMLParagraphElement>(null)

  const titleRef = useRef<HTMLInputElement>(null)
  const companyRef = useRef<HTMLInputElement>(null)
  const salaryRef = useRef<HTMLInputElement>(null)
  const locationRef = useRef<HTMLInputElement>(null)
  const employerPhoneRef = useRef<HTMLInputElement>(null)
  const descriptionRef = useRef<HTMLTextAreaElement>(null)
  const guestEmailRef = useRef<HTMLInputElement>(null)

  // 폼이 길어서(제출 버튼은 맨 아래) 에러가 폼 맨 위에만 뜨면 사용자가
  // 못 보고 "버튼이 안 눌린다"고 느낀다 — 에러가 뜰 때마다 그쪽으로 스크롤한다.
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [error])

  function goToField(ref: RefObject<HTMLInputElement | HTMLTextAreaElement | null>) {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    ref.current?.focus()
  }
  // 'khac'(기타)는 classifier.py/SUBCATEGORY_LABELS 둘 다 소분류 규칙 자체가
  // 없어 undefined — 그 경우 소분류 select를 아예 숨긴다.
  const subcategoryOptions = SUBCATEGORY_LABELS[form.category]

  // 2026-09-20 사용자 지시("가입 자체가 너무 귀찮다는 의견이 많아" — 로그인
  // 없이도 채용공고를 올릴 수 있게) — 이전엔 이 페이지 전체가
  // <RequireEmployer>로 감싸여 있어 비로그인/비기업 계정은 아예 못 들어왔다.
  // 이제 페이지 자체는 항상 열려있고, 실제 기업 계정인지만 이 안에서
  // 확인해서 세 갈래로 나눈다: 기업 계정(기존 그대로) / 이메일로 등록(뒤에서
  // 계정 자동 생성) / 등록 없이 빠르게 게시(guest_manage_token 방식).
  const [employerCheck, setEmployerCheck] = useState<EmployerCheck>('checking')
  const [postMode, setPostMode] = useState<PostMode>('quick')
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

    const requiredFields: { valid: boolean; message: string; ref: RefObject<HTMLInputElement | HTMLTextAreaElement | null> }[] = [
      { valid: !!form.title.trim(), message: 'Vui lòng nhập tiêu đề công việc.', ref: titleRef },
      { valid: !!form.company.trim(), message: 'Vui lòng nhập tên công ty / đơn vị.', ref: companyRef },
      { valid: !!form.salary.trim(), message: 'Vui lòng nhập mức lương / chế độ.', ref: salaryRef },
      { valid: !!form.location.trim(), message: 'Vui lòng nhập địa điểm làm việc.', ref: locationRef },
      { valid: !!form.employerPhone.trim(), message: 'Vui lòng nhập số điện thoại liên hệ.', ref: employerPhoneRef },
      { valid: !!form.description.trim(), message: 'Vui lòng nhập mô tả chi tiết.', ref: descriptionRef },
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

      const baseFields = {
        title: form.title.trim(),
        company: form.company.trim(),
        category: form.category,
        subcategory: form.subcategory || undefined,
        salary: form.salary.trim(),
        location: form.location.trim(),
        description: form.description.trim(),
        hours: form.hours.trim() || undefined,
        jobDuration: form.jobDuration || undefined,
        genderRequirement: form.genderRequirement || undefined,
        ageRequirement: form.ageRequirement || undefined,
        laborContractPledge: form.laborContractPledge || undefined,
        socialInsurancePledge: form.socialInsurancePledge || undefined,
        employerPhone: form.employerPhone.trim(),
        urgent: form.urgent,
        imageUrl,
      }

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
        const deadline = form.applicationDeadline.trim() || addDays(14)
        const job = await addPostedJob({ ...baseFields, applicationDeadline: deadline, employerId: newUserId })
        await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/dat-lai-mat-khau`,
        })
        setForm(emptyForm)
        setImageFile(null)
        setImagePreview(null)
        setEmailSuccess({ jobId: job.id, email })
      } else if (employerCheck === 'guest' && postMode === 'quick') {
        // "Đăng nhanh, không cần đăng ký" — 계정 없이, 클라이언트가 만든
        // 무작위 토큰만으로 등록(local_jobs_guest_insert RLS 참고). 관리자
        // 손길 없이도 자연히 정리되도록 마감일을 14일이 아니라 7일로
        // 짧게 잡는다(관리 링크를 잃어버려도 방치 기간이 짧음).
        const token = crypto.randomUUID()
        const deadline = form.applicationDeadline.trim() || addDays(7)
        const job = await addPostedJob({
          ...baseFields,
          applicationDeadline: deadline,
          employerId: undefined,
          guestManageToken: token,
        })
        const rawId = job.id.replace(/^sb-/, '')
        setForm(emptyForm)
        setImageFile(null)
        setImagePreview(null)
        setGuestSuccess({
          jobId: job.id,
          manageUrl: `${window.location.origin}/quan-ly-tin/${rawId}?token=${token}`,
        })
      } else {
        // 기존 기업 계정 경로 — 그대로 유지.
        const deadline = form.applicationDeadline.trim() || addDays(14)
        const job = await addPostedJob({ ...baseFields, applicationDeadline: deadline, employerId: user?.id })
        setForm(emptyForm)
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

        <label className="field">
          <span className="field__label">Danh mục *</span>
          <select className="field__input" value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as JobCategory, subcategory: '' }))}>
            {ALL_CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </label>

        {subcategoryOptions && (
          <label className="field">
            <span className="field__label">Phân loại chi tiết (tuỳ chọn)</span>
            <select className="field__input" value={form.subcategory}
              onChange={(e) => setForm((f) => ({ ...f, subcategory: e.target.value }))}>
              <option value="">— Không chọn —</option>
              {Object.entries(subcategoryOptions).map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
          </label>
        )}

        <label className="field">
          <span className="field__label">Mức lương / chế độ *</span>
          <input ref={salaryRef} className="field__input" value={form.salary}
            onChange={(e) => setForm((f) => ({ ...f, salary: e.target.value }))}
            placeholder="Ví dụ: 30.000 đ/giờ hoặc thỏa thuận" />
        </label>

        <label className="field">
          <span className="field__label">Địa điểm làm việc *</span>
          <input ref={locationRef} className="field__input" value={form.location}
            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
            placeholder="Quận, thành phố" />
        </label>

        <label className="field">
          <span className="field__label">Thời gian làm việc (tuỳ chọn)</span>
          <input className="field__input" value={form.hours}
            onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))}
            placeholder="Ca sáng, cuối tuần..." />
        </label>

        <label className="field">
          <span className="field__label">Thời hạn làm việc (tuỳ chọn)</span>
          <select className="field__input" value={form.jobDuration}
            onChange={(e) => setForm((f) => ({ ...f, jobDuration: e.target.value }))}>
            <option value="">— Không chọn —</option>
            {JOB_DURATION_OPTIONS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">Giới tính yêu cầu (tuỳ chọn)</span>
          <select className="field__input" value={form.genderRequirement}
            onChange={(e) => setForm((f) => ({ ...f, genderRequirement: e.target.value }))}>
            <option value="">— Không yêu cầu —</option>
            {GENDER_REQUIREMENT_OPTIONS.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">Độ tuổi yêu cầu (tuỳ chọn)</span>
          <select className="field__input" value={form.ageRequirement}
            onChange={(e) => setForm((f) => ({ ...f, ageRequirement: e.target.value }))}>
            <option value="">— Không yêu cầu —</option>
            {AGE_REQUIREMENT_OPTIONS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">Số điện thoại liên hệ *</span>
          <input ref={employerPhoneRef} className="field__input" value={form.employerPhone}
            onChange={(e) => setForm((f) => ({ ...f, employerPhone: e.target.value }))}
            inputMode="tel" autoComplete="tel" placeholder="0900 000 000" />
        </label>

        <label className="field">
          <span className="field__label">
            {employerCheck === 'guest' && postMode === 'quick'
              ? 'Hạn nộp hồ sơ (để trống = 7 ngày)'
              : 'Hạn nộp hồ sơ (để trống = 14 ngày)'}
          </span>
          <input className="field__input" type="date" value={form.applicationDeadline}
            onChange={(e) => setForm((f) => ({ ...f, applicationDeadline: e.target.value }))} />
        </label>

        <label className="field field--row">
          <input type="checkbox" checked={form.urgent}
            onChange={(e) => setForm((f) => ({ ...f, urgent: e.target.checked }))} />
          <span className="field__label">🔥 Tuyển gấp</span>
        </label>

        <div className="field">
          <span className="field__label">Cam kết với người lao động (tuỳ chọn)</span>
          <label className="field field--row">
            <input type="checkbox" checked={form.laborContractPledge}
              onChange={(e) => setForm((f) => ({ ...f, laborContractPledge: e.target.checked }))} />
            <span className="field__label">Cam kết ký hợp đồng lao động rõ ràng</span>
          </label>
          <label className="field field--row">
            <input type="checkbox" checked={form.socialInsurancePledge}
              onChange={(e) => setForm((f) => ({ ...f, socialInsurancePledge: e.target.checked }))} />
            <span className="field__label">Cam kết đóng BHXH/BHYT đầy đủ theo quy định</span>
          </label>
        </div>

        <div className="field">
          <span className="field__label">Ảnh công ty / nơi làm việc (tuỳ chọn)</span>
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
          <span className="field__label">Mô tả chi tiết *</span>
          <textarea ref={descriptionRef} className="field__input field__textarea" rows={5} value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Nội dung công việc, yêu cầu, quyền lợi..." />
        </label>

        <div className="form-actions">
          <button type="submit" className="btn btn--primary" disabled={submitting || employerCheck === 'checking'}>
            {submitting ? 'Đang đăng...' : 'Đăng tin'}
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => { setForm(emptyForm); setImageFile(null); setImagePreview(null) }} disabled={submitting}>
            Xoá form
          </button>
        </div>
      </form>
    </div>
  )
}
