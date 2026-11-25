import { composeAge, composeDescription, composeHires, composeHours, composeLocation, composeSalary, normalizeVnPhone, type GenderChoice, type PayUnit } from './postJobForm.ts'
import type { JobConditions } from './jobConditions.ts'
import { supabase } from './supabase.ts'
import type { JobCategory } from '../types/job'

// 공고 등록 폼의 "값 모으기·필수 검사·저장 칸 만들기·사진/핀 저장" — 웹 PostJob 페이지(src/pages/PostJob.tsx)에 있던 것을 그대로 옮긴 공용 함수(동작 변경 없음).
// 웹과 앱(/app 기업 탭 공고 등록)이 같은 검사·같은 저장 칸을 쓴다. 화면(칸 배치·입력 방식)만 각자 둔다.
// 2026-10-30 Lee: 공고 작성 체크리스트 순서(① 근무조건 ② 모집조건 ③ 근무지역 ④ 상세요강). 필수 9개 = 급여·근무시간·고용형태·업직종·모집마감·모집인원·주소·업무 내용·연락처.
export const emptyPostForm = {
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
  // 알바몬처럼 고용형태 하나 더(최대 2개, Lee 2026-11-08) — local_jobs.employment_type_extra
  employmentTypeExtra: '' as '' | 'contract' | 'internship' | 'collaborator',
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
  // Lee 2026-11-08 "4 적용"(알바몬 공고등록 따라 하기): DB 새 칸 없이 기존 칸에 넣는다 — 경력·우대는 preference, 식대·수습은 salaryNote, 접수 방법·담당자 이름은 상세요강 '채용 절차'.
  beginner: false,
  withFriends: false,
  prefPicks: [] as string[],
  mealAllowance: false,
  probation: false,
  applyMethods: ['Gọi điện', 'Nhắn Zalo'] as string[],
  contactName: '',
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

export type PostForm = typeof emptyPostForm

export function addDays(n: number): string {
  const t = new Date()
  t.setDate(t.getDate() + n)
  return t.toISOString().slice(0, 10)
}

// 4번: 기존 칸에 넣을 글(제출·미리보기 공용)
export const preferenceText = (form: PostForm) => [form.beginner && 'Không cần kinh nghiệm', form.withFriends && 'Có thể đi làm cùng bạn bè', ...form.prefPicks, form.preference.trim()].filter(Boolean).join(', ')
export const processText = (form: PostForm) => [form.process.trim(), form.applyMethods.length ? `Cách ứng tuyển: ${form.applyMethods.join(', ')}` : '', form.contactName.trim() ? `Người liên hệ: ${form.contactName.trim()}` : ''].filter(Boolean).join('\n')
export const salaryNoteText = (form: PostForm) => [form.allowance.trim() && `Phụ cấp·Thưởng: ${form.allowance.trim()}`, form.mealAllowance && 'Phụ cấp ăn riêng', form.probation && 'Có thời gian thử việc', form.payMethod && `Trả lương: ${form.payMethod}`].filter(Boolean).join('; ')

/** 필수 칸 검사에서 걸린 칸 이름 — 화면이 그 칸으로 스크롤·포커스한다. */
export type PostFieldKey = 'title' | 'company' | 'salary' | 'time' | 'employment' | 'deadline' | 'hires' | 'age' | 'street' | 'description' | 'phone' | 'zalo'

export interface ComposedPost {
  salary: NonNullable<ReturnType<typeof composeSalary>>
  hours: string
  hires: string
  age: string | undefined
  location: string
  description: string
  phone: string
  zalo: string | null
}

/** 웹 PostJob의 필수 칸 검사와 같은 순서·같은 문구. quickGuestMode(로그인 없이 빠른 등록)는 마감일 없이도 통과한다. */
export function validatePostForm(form: PostForm, quickGuestMode: boolean): { ok: true; composed: ComposedPost } | { ok: false; message: string; field: PostFieldKey } {
  const salary = composeSalary(form.salaryAmount, form.salaryUnit, form.salaryNegotiable)
  const hours = form.hoursNegotiable ? 'Thỏa thuận' : composeHours(form.timeStart, form.timeEnd, form.breakMinutes)
  const hires = composeHires(form.hires, form.hiresUndecided, form.gender, form.genderMale, form.genderFemale)
  const age = composeAge(form.ageMin, form.ageMax)
  const location = composeLocation(form.street, form.ward, form.province, form.park)
  const description = composeDescription({ work: form.work, overtime: form.overtime, environment: form.environment, process: processText(form), benefitOther: form.benefitOther })
  const phone = normalizeVnPhone(form.employerPhone)
  const zalo = form.zaloSameAsPhone ? phone : (form.zalo.trim() ? normalizeVnPhone(form.zalo) : null)
  const deadlineChosen = form.ongoing || !!form.applicationDeadline.trim() || quickGuestMode
  const required: { valid: boolean; message: string; field: PostFieldKey }[] = [
    { valid: !!form.title.trim(), message: 'Vui lòng nhập tiêu đề công việc.', field: 'title' },
    { valid: !!form.company.trim(), message: 'Vui lòng nhập tên công ty / đơn vị.', field: 'company' },
    { valid: !!salary, message: 'Vui lòng nhập mức lương (hoặc chọn Thỏa thuận).', field: 'salary' },
    { valid: !!hours, message: 'Vui lòng nhập giờ bắt đầu và kết thúc.', field: 'time' },
    { valid: !!form.employmentType, message: 'Vui lòng chọn hình thức làm việc.', field: 'employment' },
    { valid: deadlineChosen, message: 'Vui lòng chọn hạn nộp hồ sơ hoặc Tuyển liên tục.', field: 'deadline' },
    { valid: !!hires, message: 'Vui lòng nhập số lượng tuyển (hoặc chọn Chưa xác định).', field: 'hires' },
    { valid: age !== null, message: 'Độ tuổi không hợp lệ (15–70, từ nhỏ đến lớn).', field: 'age' },
    { valid: !!location, message: 'Vui lòng nhập số nhà/đường, chọn tỉnh/thành và phường/xã.', field: 'street' },
    { valid: !!description, message: 'Vui lòng nhập nội dung công việc.', field: 'description' },
    { valid: !!phone, message: 'Số điện thoại không hợp lệ (ví dụ 0912 345 678).', field: 'phone' },
    { valid: form.zaloSameAsPhone || !form.zalo.trim() || !!zalo, message: 'Số Zalo không hợp lệ.', field: 'zalo' },
  ]
  const bad = required.find((f) => !f.valid)
  if (bad) return { ok: false, message: bad.message, field: bad.field }
  return { ok: true, composed: { salary: salary!, hours: hours!, hires: hires!, age: age ?? undefined, location: location!, description: description!, phone: phone!, zalo: zalo ?? null } }
}

/** 사진을 job-images 저장소에 올리고 대표 사진 주소와 경로를 돌려준다(웹과 같은 경로 규칙). */
export async function uploadJobPhotos(files: File[]): Promise<{ imageUrl: string | undefined; imagePaths: string[] }> {
  let imageUrl: string | undefined = undefined
  const imagePaths: string[] = []
  for (const [i, file] of files.entries()) {
    const ext = file.name.split('.').pop()
    const path = `${Date.now()}-${i}.${ext}`
    const { error: uploadError } = await supabase.storage.from('job-images').upload(path, file, { upsert: true })
    if (uploadError) throw new Error('Tải ảnh thất bại: ' + uploadError.message)
    imagePaths.push(path)
    if (i === 0) imageUrl = supabase.storage.from('job-images').getPublicUrl(path).data.publicUrl
  }
  return { imageUrl, imagePaths }
}

/** 공고 저장용 칸(addPostedJob의 baseFields). 마감일·작성자(employerId)는 호출하는 쪽이 붙인다. */
export function buildJobFields(form: PostForm, conditions: JobConditions, c: ComposedPost, extra: { descriptionHtml?: string; imageUrl?: string; imagePaths: string[] }) {
  return {
    title: form.title.trim(),
    company: form.company.trim(),
    category: form.category,
    subcategory: form.subcategory || undefined,
    salary: c.salary.salary,
    salaryPeriod: c.salary.salaryPeriod,
    salaryBasis: form.salaryIncludesOvertime && !form.salaryNegotiable ? 'total_with_overtime' as const : undefined,
    salaryNote: salaryNoteText(form) || undefined,
    location: c.location,
    description: c.description,
    hours: c.hours,
    jobDuration: form.jobDuration || undefined,
    employmentType: form.employmentType || undefined,
    employmentTypeExtra: form.employmentTypeExtra || undefined,
    descriptionHtml: extra.descriptionHtml || undefined,
    workDays: form.daysNegotiable ? 'Thỏa thuận' : (form.workDays.length ? form.workDays.join(', ') : undefined),
    benefitTags: form.benefitTags.length ? form.benefitTags : undefined,
    numHires: c.hires,
    genderRequirement: form.gender || undefined,
    ageRequirement: c.age || undefined,
    education: form.education || undefined,
    preference: preferenceText(form) || undefined,
    laborContractPledge: form.laborContractPledge || undefined,
    socialInsurancePledge: form.insurance || undefined,
    employerPhone: c.phone,
    zalo: c.zalo || undefined,
    urgent: form.urgent,
    imageUrl: extra.imageUrl,
    images: extra.imagePaths.length ? extra.imagePaths : undefined,
    ...conditions,
    workSchedule: form.workDays.length === 5 ? '5_days' as const : form.workDays.length === 6 ? '6_days' as const : form.workDays.length ? 'other' as const : conditions.workSchedule,
  }
}

/** 근무지 핀은 공고 저장 뒤 소유 확인 RPC로 저장한다(실패해도 공고는 유지). 실패하면 false. */
export async function saveJobPin(jobId: string, token: string | null, address: string, pin: { lat: number; lng: number }): Promise<boolean> {
  const { error } = await supabase.rpc('set_job_pinned_location', { p_job_id: Number(jobId.replace(/^sb-/, '')), p_token: token, p_address: address, p_lat: pin.lat, p_lng: pin.lng })
  return !error
}

export type { GenderChoice, PayUnit, JobCategory }
