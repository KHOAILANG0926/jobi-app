import type { Job } from '../types/job'
import { evaluateJobPolicy } from '../../policy/job-posting.mjs'

/** Compatibility wrapper; company names and incidental receivables are not role evidence. */
export function hasExcludedMoneyTerms(job: Pick<Job, 'title' | 'company' | 'description'>): boolean {
  const verdict = evaluateJobPolicy(job)
  return verdict.decision === 'exclude' && /^(finance|debt)_/.test(verdict.reason)
}
// Preserve visibility allowed by the master display predicate or the corrected policy.
// New/content-edit/reopen writes use the shared policy; reads must not retrospectively
// hide legacy ambiguous/B2B rows. Historical exceptions are recorded in master 9157ced.
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
  /thu hoi no|doi no|thu no\b|vay tien|cho vay|ho tro vay|tu van vay|tin dung|the tin dung|tai chinh tieu dung|cong ty tai chinh|fe credit|home credit|mcredit|mirae asset|shinhan finance|vpbank finance|debt collector|debt collection|loan/i

export function isPublicJobAllowed(job: Job): boolean {
  return evaluateJobPolicy(job).decision === 'allow' || !EXCLUDED_MONEY_JOB_RE.test(normalizeForPolicy(`${job.title} ${job.company} ${job.description}`))
}
