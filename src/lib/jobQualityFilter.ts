import type { Job } from '../types/job'
import { evaluateJobPolicy } from '../../policy/job-posting.mjs'

/** Compatibility wrapper; company names and incidental receivables are not role evidence. */
export function hasExcludedMoneyTerms(job: Pick<Job, 'title' | 'company' | 'description'>): boolean {
  const verdict = evaluateJobPolicy(job)
  return verdict.decision === 'exclude' && /^(finance|debt)_/.test(verdict.reason)
}
export function isPublicJobAllowed(job: Job): boolean {
  return evaluateJobPolicy(job).decision === 'allow'
}
