import type { Job } from '../types/job'
import { roleSalaryLines } from './jobRolePresentation.ts'

export type PayKind = 'hour' | 'day' | 'month' | 'year' | 'other'
export interface CardSalary { label: string; text: string; lines?: string[]; kind?: PayKind; lineKinds?: PayKind[] }
// 2026-11-01 Lee(알바몬): 지급 단위 글자에 색 — 월급 빨강, 시급·연봉 파랑, 일급 보라, 금액은 회색. 이 표는 이름표 글자만 정한다.
export const PAY_LABELS: Record<PayKind, string> = { hour: 'Lương giờ', day: 'Lương ngày', month: 'Lương tháng', year: 'Lương năm', other: 'Tiền công' }
const yearUnit = /(?:\/\s*|mỗi\s+|moi\s+)(?:năm|nam)(?!\p{L})/iu
/** 급여 글자에서 지급 단위를 읽는다(못 읽으면 저장된 지급 단위, 그것도 없으면 other). */
export function payKind(text: string, fallback?: string | null): PayKind {
  if (units.hour.test(text)) return 'hour'
  if (units.day.test(text)) return 'day'
  if (units.month.test(text)) return 'month'
  if (yearUnit.test(text)) return 'year'
  return fallback === 'hour' || fallback === 'day' || fallback === 'month' ? fallback : 'other'
}
const labels = { hour: 'Lương giờ', day: 'Lương ngày', month: 'Lương tháng' }
const units = {
  hour: /(?:\/\s*(?:1\s*)?|mỗi\s+|moi\s+)(?:giờ|gio|h)(?![\p{L}\d])/iu,
  day: /(?:\/\s*|mỗi\s+|moi\s+)(?:ngày|ngay)(?!\p{L})/iu,
  month: /(?:\/\s*|mỗi\s+|moi\s+)(?:tháng|thang)(?!\p{L})/iu,
}

/** Display only source amounts. Never derive an hourly rate from a shift/day/month. */
export function cardSalary(job: Pick<Job, 'salary' | 'salaryPeriod'> & Partial<Pick<Job, 'description'>>): CardSalary | null {
  // Lee 2026-10-30: 여러 직무 공고(10-28 공고 1개 유지)는 직무별 급여 한 줄씩, 최대 2줄 + "+N". 직무별 급여가 하나도 없으면 아래 기존 규칙.
  const roleLines = roleSalaryLines(job.description)
  if (roleLines.length) {
    const lines = roleLines.slice(0, 2)
    if (roleLines.length > 2) lines[1] += ` +${roleLines.length - 2}`
    return { label: 'Lương', text: roleLines.join(' · '), lines, lineKinds: lines.map(line => payKind(line)) }
  }
  const text = (job.salary || '').trim()
  // 2026-11-01 #5231: "25.000 VNĐ/giờ"의 VNĐ도 돈 단위(전에는 vnd만 알아봐 메인 목록에서 빠짐).
  const amount = /(?:\d[\d.,]*\s*(?:triệu|tr\b|k\b|đồng|dong\b|vn[dđ](?!\p{L})|đ|usd\b)|\$\s*\d)/iu
  if (!amount.test(text)) return null
  // 2026-11-04 #5422: "13.500.000 – 20.000.000đ/tháng + thưởng"은 기본급 + 상여 꼬리 → " + "에서도 나눠 기본급 칸을 살린다(전에는 한 칸에 thưởng이 섞여 통째로 빠짐).
  const clauses = text.split(/\s*[,;|\n]\s*|\s+\+\s+/).filter(clause => amount.test(clause)
    && !/chuyên cần|chuyen can|phụ cấp|phu cap|thưởng|thuong/iu.test(clause))
  if (!clauses.length) return null
  for (const period of ['hour', 'day', 'month'] as const) {
    const matching = clauses.filter(clause => amount.test(clause) && units[period].test(clause))
    if (matching.length) return { label: labels[period], text: matching[0].trim(), kind: period }
  }
  const period = job.salaryPeriod
  return { label: period && period in labels ? labels[period as keyof typeof labels] : 'Tiền công', text: clauses[0].trim(), kind: payKind(clauses[0], period) }
}

/** Main-page presentation only; the shared search/map/detail collection is untouched. */
export function mainCardJobs(jobs: Job[]): Job[] {
  const seen = new Set<string>()
  return jobs.filter(job => {
    if (seen.has(job.id) || !cardSalary(job)) return false
    seen.add(job.id)
    return true
  })
}

export function partitionMainCards(jobs: Job[], selected: Job[]): { featured: Job[]; remaining: Job[] } {
  const ids = new Set(selected.map(job => job.id))
  return { featured: mainCardJobs(selected), remaining: mainCardJobs(jobs).filter(job => !ids.has(job.id)) }
}
