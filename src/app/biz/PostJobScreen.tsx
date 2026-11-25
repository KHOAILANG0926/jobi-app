import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, X } from 'lucide-react'
import { useJobs } from '../../context/JobsContext'
import { ALL_CATEGORIES, CATEGORY_LABELS } from '../../data/categories'
import { JOB_DURATION_OPTIONS } from '../../data/jobDuration'
import { SUBCATEGORY_LABELS } from '../../data/subcategories'
import { VN_PROVINCES } from '../../data/vnProvinces'
import { VN_WARDS_BY_PROVINCE } from '../../data/vnWards'
import { shrinkImage } from '../../lib/imageResize'
import { EMPTY_CONDITIONS, type JobConditions } from '../../lib/jobConditions'
import { publishedNotice } from '../../lib/jobPolicyWrite'
import { BENEFIT_TAG_OPTIONS, composeAge, normalizeVnPhone } from '../../lib/postJobForm'
import { addDays, buildJobFields, emptyPostForm, uploadJobPhotos, validatePostForm, type PostFieldKey, type PostForm } from '../../lib/postJobSubmit'
import type { JobCategory } from '../../types/job'
import BizGate from './BizGate'

const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const APPLY_METHODS = ['Ứng tuyển online', 'Nhắn Zalo', 'Email', 'Gọi điện', 'Đến trực tiếp']
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)
const MAX_PHOTOS = 4

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return <section className="app-pj__sec" id={id}><h2>{title}</h2>{children}</section>
}
function Field({ label, req, children }: { label: string; req?: boolean; children: ReactNode }) {
  return <div className="app-field"><span>{label}{req && <b className="app-pj__req"> *</b>}</span>{children}</div>
}
function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return <label className="app-pj__check"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />{children}</label>
}
function Chips({ options, value, onPick, label }: { options: { v: string; t: string }[]; value: string | string[]; onPick: (v: string) => void; label: string }) {
  const on = (v: string) => (Array.isArray(value) ? value.includes(v) : value === v)
  return <div className="app-chip-row app-chip-row--wrap" role="group" aria-label={label}>{options.map((o) => <button key={o.v} type="button" className={'app-chip' + (on(o.v) ? ' app-on' : '')} aria-pressed={on(o.v)} onClick={() => onPick(o.v)}>{o.t}</button>)}</div>
}

// 공고 등록(기업) — 웹 PostJob과 같은 항목·같은 필수 검사·같은 저장 칸(lib/postJobSubmit)·같은 저장 입구(JobsContext.addPostedJob → ingest_job).
// 순서는 확정 체크리스트 그대로: 모집내용 → 근무조건 → 근무지 정보 → 접수기간·방법 → 담당자정보 → 상세모집요강.
function PostJob({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const { addPostedJob } = useJobs()
  const [form, setForm] = useState<PostForm>(emptyPostForm)
  const [conditions, setConditions] = useState<JobConditions>(EMPTY_CONDITIONS)
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<{ id: string; published: boolean } | null>(null)
  const [showDemog, setShowDemog] = useState(false)

  const set = <K extends keyof PostForm>(k: K, v: PostForm[K]) => setForm((f) => ({ ...f, [k]: v }))
  const toggleIn = (k: 'workDays' | 'benefitTags' | 'applyMethods', v: string) => setForm((f) => ({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] }))
  const subOptions = SUBCATEGORY_LABELS[form.category]
  const wards = useMemo(() => (form.province ? VN_WARDS_BY_PROVINCE[form.province] ?? [] : []), [form.province])
  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), []) // eslint-disable-line react-hooks/exhaustive-deps

  const goTo = (field: PostFieldKey) => {
    const el = document.getElementById('app-pj-' + field)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    ;(el as HTMLElement | null)?.focus?.()
  }
  const onPhotos = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS - photos.length)
    e.target.value = ''
    if (!files.length) return
    try {
      const added = await Promise.all(files.map(async (file) => { const small = await shrinkImage(file); return { file: small, url: URL.createObjectURL(small) } }))
      setPhotos((ps) => [...ps, ...added].slice(0, MAX_PHOTOS))
    } catch (err) { setError(err instanceof Error ? err.message : 'Không đọc được ảnh.') }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const checked = validatePostForm(form, false)
    if (!checked.ok) { setError(checked.message); goTo(checked.field); return }
    setSubmitting(true)
    try {
      const { imageUrl, imagePaths } = await uploadJobPhotos(photos.map((p) => p.file))
      const fields = buildJobFields(form, conditions, checked.composed, { imageUrl, imagePaths })
      const deadline = form.ongoing ? '' : (form.applicationDeadline.trim() || addDays(14))
      const job = await addPostedJob({ ...fields, applicationDeadline: deadline, employerId: userId })
      photos.forEach((p) => URL.revokeObjectURL(p.url))
      setPhotos([])
      setDone({ id: job.id, published: job.active === true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi. Vui lòng thử lại.')
    } finally { setSubmitting(false) }
  }

  if (done) {
    return (
      <div className="app-page" data-testid="app-pj-done"><header className="app-pagebar"><h1 className="app-pagebar__title">Đăng tin thành công!</h1></header>
        <div className="app-pj__done"><p>{publishedNotice(done.published)}</p>
          <Link className="app-btn app-btn--primary app-btn--block" to={`/viec-lam/${done.id}`}>Xem tin đã đăng</Link>
          <Link className="app-btn app-btn--block" to="/biz/quan-ly-tin">Quản lý tin</Link></div></div>
    )
  }

  const phoneBad = !!form.employerPhone.trim() && !normalizeVnPhone(form.employerPhone)
  const demogText = [form.gender ? (form.gender === 'Nam/nữ' ? 'Nam và nữ' : form.gender) : 'Không yêu cầu giới tính', composeAge(form.ageMin, form.ageMax) || 'Không yêu cầu tuổi', form.education || 'Không yêu cầu học vấn'].join(', ')
  const tri = (k: 'shuttleBus' | 'dormitory' | 'mealProvided' | 'immediateStart') => conditions[k] === true
  const setTri = (k: 'shuttleBus' | 'dormitory' | 'mealProvided' | 'immediateStart', v: boolean) => setConditions((c) => ({ ...c, [k]: v ? true : null }))

  return (
    <div className="app-page" data-testid="app-pj">
      <header className="app-pagebar"><button type="button" className="app-icon-btn" aria-label="Quay lại" onClick={() => navigate(-1)}><ChevronLeft size={24} aria-hidden /></button><h1 className="app-pagebar__title">Đăng tin tuyển dụng</h1></header>
      <form className="app-form app-pj" onSubmit={submit} noValidate>
        {error && <p className="app-form__error" role="alert" id="app-pj-error">{error}</p>}

        <Section id="app-pj-s1" title="1. Nội dung tuyển dụng">
          <Field label="Tiêu đề" req><input id="app-pj-title" maxLength={40} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Ví dụ: Tuyển công nhân lắp ráp linh kiện" /><small className="app-pj__count">{form.title.length}/40</small></Field>
          <Field label="Ngành nghề" req>
            <select aria-label="Ngành nghề" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as JobCategory, subcategory: '' }))}>{ALL_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}</select>
            {subOptions && <select aria-label="Chi tiết ngành nghề" value={form.subcategory} onChange={(e) => set('subcategory', e.target.value)}><option value="">-- Chọn chi tiết --</option>{Object.entries(subOptions).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>}
            <Check checked={form.beginner} onChange={(v) => set('beginner', v)}>Không cần kinh nghiệm</Check>
          </Field>
          <Field label="Hình thức làm việc" req>
            <span id="app-pj-employment" tabIndex={-1}><Chips label="Hình thức làm việc" value={form.employmentType} onPick={(v) => set('employmentType', v as PostForm['employmentType'])} options={[{ v: 'full_time', t: 'Chính thức' }, { v: 'seasonal', t: 'Thời vụ' }, { v: 'part_time', t: 'Part-time' }]} /></span>
            <Chips label="Hình thức khác" value={form.employmentTypeExtra} onPick={(v) => set('employmentTypeExtra', (form.employmentTypeExtra === v ? '' : v) as PostForm['employmentTypeExtra'])} options={[{ v: 'contract', t: 'Hợp đồng' }, { v: 'internship', t: 'Thực tập' }, { v: 'collaborator', t: 'Cộng tác viên' }]} />
          </Field>
          <Field label="Số lượng tuyển" req>
            <input id="app-pj-hires" inputMode="numeric" value={form.hires} disabled={form.hiresUndecided} onChange={(e) => set('hires', e.target.value.replace(/\D/g, ''))} placeholder="Số người" />
            <Check checked={form.hiresUndecided} onChange={(v) => set('hiresUndecided', v)}>Chưa xác định</Check>
            <Check checked={form.withFriends} onChange={(v) => set('withFriends', v)}>Có thể đi làm cùng bạn bè</Check>
          </Field>
          <Field label="Giới tính · Tuổi · Học vấn">
            <button type="button" className="app-pj__summary" aria-expanded={showDemog} onClick={() => setShowDemog((v) => !v)}>{demogText} <span>{showDemog ? '▴' : '▾'}</span></button>
            {showDemog && (
              <div className="app-pj__panel">
                <Chips label="Giới tính" value={form.gender} onPick={(v) => set('gender', v as PostForm['gender'])} options={[{ v: '', t: 'Không yêu cầu' }, { v: 'Nam', t: 'Nam' }, { v: 'Nữ', t: 'Nữ' }, { v: 'Nam/nữ', t: 'Nam và nữ' }]} />
                {form.gender === 'Nam/nữ' && <div className="app-pj__pair"><input inputMode="numeric" aria-label="Số nam" placeholder="Số nam" value={form.genderMale} onChange={(e) => set('genderMale', e.target.value.replace(/\D/g, ''))} /><input inputMode="numeric" aria-label="Số nữ" placeholder="Số nữ" value={form.genderFemale} onChange={(e) => set('genderFemale', e.target.value.replace(/\D/g, ''))} /></div>}
                <div className="app-pj__pair"><input id="app-pj-age" inputMode="numeric" aria-label="Tuổi từ" placeholder="Tuổi từ (18)" value={form.ageMin} onChange={(e) => set('ageMin', e.target.value.replace(/\D/g, ''))} /><input inputMode="numeric" aria-label="Tuổi đến" placeholder="Đến (45)" value={form.ageMax} onChange={(e) => set('ageMax', e.target.value.replace(/\D/g, ''))} /></div>
                <select aria-label="Học vấn" value={form.education} onChange={(e) => set('education', e.target.value)}><option value="">Không yêu cầu học vấn</option><option>THCS</option><option>THPT</option><option>Trung cấp</option><option>Cao đẳng</option><option>Đại học</option></select>
              </div>
            )}
          </Field>
          <Field label="Ưu tiên"><input value={form.preference} onChange={(e) => set('preference', e.target.value)} placeholder="Ưu tiên khác (tuỳ chọn)" /><Check checked={tri('immediateStart')} onChange={(v) => setTri('immediateStart', v)}>Đi làm ngay</Check></Field>
        </Section>

        <Section id="app-pj-s2" title="2. Điều kiện làm việc">
          <Field label="Lương" req>
            <div className="app-pj__pair"><input id="app-pj-salary" inputMode="decimal" disabled={form.salaryNegotiable} value={form.salaryAmount} onChange={(e) => set('salaryAmount', e.target.value)} placeholder="Ví dụ: 8.000.000" aria-label="Mức lương" />
              <select aria-label="Đơn vị lương" value={form.salaryUnit} disabled={form.salaryNegotiable} onChange={(e) => set('salaryUnit', e.target.value as PostForm['salaryUnit'])}><option value="hour">/ giờ</option><option value="day">/ ngày</option><option value="month">/ tháng</option></select></div>
            <Check checked={form.salaryNegotiable} onChange={(v) => set('salaryNegotiable', v)}>Thỏa thuận</Check>
            <Check checked={form.salaryIncludesOvertime} onChange={(v) => set('salaryIncludesOvertime', v)}>Đã gồm tăng ca</Check>
            <input value={form.allowance} onChange={(e) => set('allowance', e.target.value)} placeholder="Phụ cấp · Thưởng (tuỳ chọn)" aria-label="Phụ cấp, thưởng" />
            <input value={form.payMethod} onChange={(e) => set('payMethod', e.target.value)} placeholder="Trả lương: hình thức, kỳ lương (tuỳ chọn)" aria-label="Trả lương" />
            <Check checked={form.mealAllowance} onChange={(v) => set('mealAllowance', v)}>Phụ cấp ăn riêng</Check>
            <Check checked={form.probation} onChange={(v) => set('probation', v)}>Có thời gian thử việc</Check>
          </Field>
          <Field label="Giờ làm việc" req>
            <div className="app-pj__pair"><select id="app-pj-time" aria-label="Giờ bắt đầu" disabled={form.hoursNegotiable} value={form.timeStart} onChange={(e) => set('timeStart', e.target.value)}><option value="">Bắt đầu</option>{TIME_OPTIONS.map((t) => <option key={t}>{t}</option>)}</select>
              <select aria-label="Giờ kết thúc" disabled={form.hoursNegotiable} value={form.timeEnd} onChange={(e) => set('timeEnd', e.target.value)}><option value="">Kết thúc</option>{TIME_OPTIONS.map((t) => <option key={t}>{t}</option>)}</select></div>
            <input inputMode="numeric" disabled={form.hoursNegotiable} value={form.breakMinutes} onChange={(e) => set('breakMinutes', e.target.value.replace(/\D/g, ''))} placeholder="Nghỉ giữa giờ (phút, tuỳ chọn)" aria-label="Nghỉ giữa giờ" />
            <Check checked={form.hoursNegotiable} onChange={(v) => set('hoursNegotiable', v)}>Thỏa thuận</Check>
          </Field>
          <Field label="Ngày làm việc">
            <Chips label="Ngày làm việc" value={form.workDays} onPick={(v) => toggleIn('workDays', v)} options={DAYS.map((d) => ({ v: d, t: d }))} />
            <Check checked={form.daysNegotiable} onChange={(v) => set('daysNegotiable', v)}>Thỏa thuận</Check>
          </Field>
          <Field label="Thời hạn làm việc"><Chips label="Thời hạn làm việc" value={form.jobDuration} onPick={(v) => set('jobDuration', form.jobDuration === v ? '' : v)} options={[...JOB_DURATION_OPTIONS.map((d) => ({ v: d, t: d.replace(' - ', '~') })), { v: 'Thỏa thuận', t: 'Thỏa thuận' }]} /></Field>
          <Field label="Phúc lợi">
            <Check checked={tri('shuttleBus')} onChange={(v) => setTri('shuttleBus', v)}>Xe đưa đón</Check>
            <Check checked={tri('dormitory')} onChange={(v) => setTri('dormitory', v)}>Ký túc xá</Check>
            <Check checked={tri('mealProvided')} onChange={(v) => setTri('mealProvided', v)}>Ăn ca</Check>
            <Chips label="Phúc lợi khác" value={form.benefitTags} onPick={(v) => toggleIn('benefitTags', v)} options={BENEFIT_TAG_OPTIONS.map((t) => ({ v: t, t }))} />
            <Check checked={form.insurance} onChange={(v) => set('insurance', v)}>Bảo hiểm</Check>
            <Check checked={form.laborContractPledge} onChange={(v) => set('laborContractPledge', v)}>Cam kết ký hợp đồng lao động</Check>
          </Field>
        </Section>

        <Section id="app-pj-s3" title="3. Nơi làm việc">
          <Field label="Tên công ty / đơn vị" req><input id="app-pj-company" value={form.company} onChange={(e) => set('company', e.target.value)} autoComplete="organization" /></Field>
          <Field label="Địa chỉ" req>
            <select aria-label="Tỉnh / Thành phố" value={form.province} onChange={(e) => setForm((f) => ({ ...f, province: e.target.value, ward: '' }))}><option value="">-- Tỉnh / Thành phố --</option>{VN_PROVINCES.map((p) => <option key={p}>{p}</option>)}</select>
            <select aria-label="Phường / Xã" value={form.ward} disabled={!form.province} onChange={(e) => set('ward', e.target.value)}><option value="">-- Phường / Xã --</option>{wards.map((w) => <option key={w}>{w}</option>)}</select>
            <input id="app-pj-street" value={form.street} onChange={(e) => set('street', e.target.value)} placeholder="Số nhà, đường" aria-label="Số nhà, đường" />
            <input value={form.park} onChange={(e) => set('park', e.target.value)} placeholder="Khu công nghiệp / nhà máy (tuỳ chọn)" aria-label="Khu công nghiệp, nhà máy" />
          </Field>
        </Section>

        <Section id="app-pj-s4" title="4. Hạn nộp · Cách ứng tuyển">
          <Field label="Hạn nộp hồ sơ" req>
            <input id="app-pj-deadline" type="date" disabled={form.ongoing} min={addDays(0)} value={form.applicationDeadline} onChange={(e) => set('applicationDeadline', e.target.value)} />
            <Check checked={form.ongoing} onChange={(v) => set('ongoing', v)}>Tuyển liên tục</Check>
          </Field>
          <Field label="Cách ứng tuyển"><Chips label="Cách ứng tuyển" value={form.applyMethods} onPick={(v) => toggleIn('applyMethods', v)} options={APPLY_METHODS.map((m) => ({ v: m, t: m }))} /></Field>
          <Check checked={form.urgent} onChange={(v) => set('urgent', v)}>Tuyển gấp</Check>
        </Section>

        <Section id="app-pj-s5" title="5. Người liên hệ">
          <Field label="Người liên hệ"><input value={form.contactName} onChange={(e) => set('contactName', e.target.value)} placeholder="Tên người liên hệ (tuỳ chọn)" autoComplete="name" /></Field>
          <Field label="Số điện thoại" req><input id="app-pj-phone" type="tel" value={form.employerPhone} onChange={(e) => set('employerPhone', e.target.value)} placeholder="0912 345 678" autoComplete="tel" aria-invalid={phoneBad} />{phoneBad && <small className="app-pj__bad">Số điện thoại chưa đúng định dạng.</small>}</Field>
          <Check checked={form.zaloSameAsPhone} onChange={(v) => set('zaloSameAsPhone', v)}>Zalo cùng số điện thoại</Check>
          {!form.zaloSameAsPhone && <Field label="Số Zalo"><input id="app-pj-zalo" type="tel" value={form.zalo} onChange={(e) => set('zalo', e.target.value)} /></Field>}
        </Section>

        <Section id="app-pj-s6" title="6. Mô tả công việc">
          <Field label="Nội dung công việc" req><textarea id="app-pj-description" rows={5} value={form.work} onChange={(e) => set('work', e.target.value)} placeholder="Mô tả công việc cụ thể" /></Field>
          <Field label="Tăng ca"><textarea rows={2} value={form.overtime} onChange={(e) => set('overtime', e.target.value)} placeholder="Tiền tăng ca, hệ số (tuỳ chọn)" /></Field>
          <Field label="Môi trường làm việc"><textarea rows={2} value={form.environment} onChange={(e) => set('environment', e.target.value)} /></Field>
          <Field label="Quy trình tuyển dụng"><textarea rows={2} value={form.process} onChange={(e) => set('process', e.target.value)} /></Field>
          <Field label={`Ảnh (tối đa ${MAX_PHOTOS})`}>
            <input type="file" accept="image/*" multiple disabled={photos.length >= MAX_PHOTOS} onChange={onPhotos} />
            {photos.length > 0 && <div className="app-com__previews">{photos.map((p, i) => <span key={p.url}><img src={p.url} alt="" /><button type="button" aria-label="Xoá ảnh" onClick={() => { URL.revokeObjectURL(p.url); setPhotos((ps) => ps.filter((_, j) => j !== i)) }}><X size={14} aria-hidden /></button></span>)}</div>}
          </Field>
        </Section>

        <div className="app-cv__save"><button type="submit" className="app-btn app-btn--primary app-btn--block" disabled={submitting}>{submitting ? 'Đang đăng…' : 'Đăng tin'}</button></div>
      </form>
    </div>
  )
}

export default function PostJobScreen() { return <BizGate>{(userId) => <PostJob userId={userId} />}</BizGate> }
