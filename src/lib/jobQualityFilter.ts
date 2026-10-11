import type { Job } from '../types/job'
import { hasExcludedMoneyRole } from './jobPostingPolicy.mjs'

// Shared dedicated-role rules; company alone and incidental body receivables
// are not debt-collection evidence. B2B/review gating happens on NEW writes.
export function hasExcludedMoneyTerms(job: Pick<Job, 'title' | 'company' | 'description'> & { category?: unknown }): boolean {
  return hasExcludedMoneyRole(job)
}
export function isPublicJobAllowed(job: Job): boolean {
  return !hasExcludedMoneyTerms(job)
}
