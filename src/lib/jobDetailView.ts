import type { Job } from '../types/job'
import { JOB_SECTIONS, type JobSection } from '../data/jobSchema'

/** 상세 화면 구역(순서·키는 jobSchema.ts가 정본) — 탭 라벨·앵커 id. 탭은 내용을 숨기지 않고 스크롤 이동만 한다. */
export const JOB_SECTION_LABELS: Record<JobSection, string> = {
  conditions: 'Điều kiện làm việc',
  recruit: 'Điều kiện tuyển dụng',
  location: 'Khu vực làm việc',
  description: 'Mô tả công việc',
  company: 'Thông tin công ty',
}
export const jobSectionId = (s: JobSection) => `jd-sec-${s}`
export const JOB_SECTION_ORDER: readonly JobSection[] = JOB_SECTIONS

/** 오늘 날짜(YYYY-MM-DD) — 서버(UTC)와 브라우저가 같은 값을 쓰도록 베트남 시간 고정. */
export function todayVn(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now)
}

export type DeadlineBadge = { label: string; tone: 'soon' | 'normal' | 'expired' } | null

/** D-day 배지. 마감일 없음(상시 모집)은 배지 없음. 3일 이내=soon. */
export function deadlineBadge(iso: string | null | undefined, today: string = todayVn()): DeadlineBadge {
  if (!iso) return null
  const end = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`)
  const now = Date.parse(`${today}T00:00:00Z`)
  if (Number.isNaN(end) || Number.isNaN(now)) return null
  const days = Math.round((end - now) / 86400000)
  if (days < 0) return { label: 'Đã hết hạn', tone: 'expired' }
  if (days === 0) return { label: 'Hết hạn hôm nay', tone: 'soon' }
  return { label: `D-${days}`, tone: days <= 3 ? 'soon' : 'normal' }
}

export const SALARY_BASIS_LABEL = { base: 'Lương cơ bản', total_with_overtime: 'Tổng thu nhập (đã gồm tăng ca)' } as const
/** 급여 형태 배지 — month/day/hour만(other·없음은 배지 없음, 추정 금지). */
export const SALARY_PERIOD_LABEL = { month: 'Lương tháng', day: 'Lương ngày', hour: 'Lương giờ' } as const
export function salaryPeriodLabel(p: Job['salaryPeriod'] | null | undefined): string | undefined {
  return p === 'month' || p === 'day' || p === 'hour' ? SALARY_PERIOD_LABEL[p] : undefined
}

export const EMPLOYMENT_TYPE_LABEL = { full_time: 'Toàn thời gian', seasonal: 'Thời vụ', part_time: 'Bán thời gian' } as const

/** 강조 태그 — 값이 true/확인된 것만(null·없음은 추정하지 않고 숨김). */
export function jobTags(job: Job): string[] {
  const tags: string[] = []
  if (job.employmentType) tags.push(EMPLOYMENT_TYPE_LABEL[job.employmentType])
  if (job.shuttleBus === true) tags.push('Xe đưa đón')
  if (job.dormitory === true) tags.push('Ký túc xá')
  if (job.mealProvided === true) tags.push('Bao ăn')
  if (job.socialInsurancePledge) tags.push('BHXH')
  if (job.immediateStart === true) tags.push('Đi làm ngay')
  if (job.shiftType === 'rotating' && job.rotatingShifts) tags.push(`Ca xoay ${job.rotatingShifts} ca`)
  for (const t of job.benefitTags ?? []) if (!tags.includes(t)) tags.push(t)
  return tags
}

const SHIFT_LABEL = { day: 'Ca ngày', night: 'Ca đêm', rotating: 'Ca xoay', other: 'Ca khác' } as const

export function shiftLabel(job: Job): string | undefined {
  if (!job.shiftType) return undefined
  if (job.shiftType === 'rotating' && job.rotatingShifts) return `Ca xoay (${job.rotatingShifts} ca)`
  return SHIFT_LABEL[job.shiftType]
}

export function weekendLabel(v: boolean | null | undefined): string | undefined {
  return v === true ? 'Có làm cuối tuần' : v === false ? 'Không làm cuối tuần' : undefined
}

/** 연락 수단 — 전화·Zalo가 하나도 없으면 하단 바는 Gọi/Zalo를 그리지 않는다. */
export function contactOf(job: Pick<Job, 'employerPhone' | 'zalo'>): { phone?: string; zalo?: string } {
  const phone = job.employerPhone?.trim() || undefined
  const zalo = job.zalo?.trim() || phone
  return { phone, zalo }
}

/** 수집 출처가 회사명 대신 넣는 자리표시자("Nhà tuyển dụng Facebook" 등) — 같은 이름이어도 같은 회사가 아니다. */
export function isGenericCompanyName(name: string | null | undefined): boolean {
  const n = (name ?? '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim()
  return !n || /^nhà tuyển dụng( facebook| ẩn danh)?$/.test(n) || n === 'facebook' || n === 'ẩn danh'
}
