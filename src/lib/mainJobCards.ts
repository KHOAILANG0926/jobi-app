import type { Job } from '../types/job'
import { roleSalaryLines } from './jobRolePresentation.ts'

export interface CardSalary { label: string; text: string; lines?: string[] }
const labels = { hour: 'Lương giờ', day: 'Lương ngày', month: 'Lương tháng' }
const units = {
  hour: /(?:\/\s*|mỗi\s+|moi\s+)(?:giờ|gio|h)(?![\p{L}\d])/iu,
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
    return { label: 'Lương', text: roleLines.join(' · '), lines }
  }
  const text = (job.salary || '').trim()
  const amount = /(?:\d[\d.,]*\s*(?:triệu|tr\b|k\b|đồng|dong\b|vnd\b|đ|usd\b)|\$\s*\d)/iu
  if (!amount.test(text)) return null
  const clauses = text.split(/\s*[,;|\n]\s*/).filter(clause => amount.test(clause)
    && !/chuyên cần|chuyen can|phụ cấp|phu cap|thưởng|thuong/iu.test(clause))
  if (!clauses.length) return null
  for (const period of ['hour', 'day', 'month'] as const) {
    const matching = clauses.filter(clause => amount.test(clause) && units[period].test(clause))
    if (matching.length) return { label: labels[period], text: matching[0].trim() }
  }
  const period = job.salaryPeriod
  return { label: period && period in labels ? labels[period as keyof typeof labels] : 'Tiền công', text: clauses[0].trim() }
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
