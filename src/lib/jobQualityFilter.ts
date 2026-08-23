import type { Job } from '../types/job'

function normalizeForPolicy(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/đ/g, 'd')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const EXCLUDED_MONEY_JOB_RE =
  /thu hoi cong no|cong no|thu hoi no|doi no|thu no\b|xu ly no|no xau|nhac no|vay tien|cho vay|ho tro vay|tu van vay|tin dung|the tin dung|tai chinh tieu dung|cong ty tai chinh|fe credit|home credit|mcredit|mirae asset|shinhan finance|vpbank finance|collection|collector|debt|loan/i

export function hasExcludedMoneyTerms(job: Pick<Job, 'title' | 'company' | 'description'>): boolean {
  const text = normalizeForPolicy(`${job.title} ${job.company} ${job.description}`)
  return EXCLUDED_MONEY_JOB_RE.test(text)
}

export function isPublicJobAllowed(job: Job): boolean {
  return !hasExcludedMoneyTerms(job)
}
