export interface PolicyInput {
  title?: unknown
  company?: unknown
  description?: unknown
  category?: unknown
  salary?: unknown
}
export interface PolicyResult {
  decision: 'allow' | 'exclude' | 'review'
  reason: string
  version: string
}
export const POLICY_VERSION: string
export function normalizePolicyText(value: unknown): string
export function evaluateJobPostingPolicy(job?: PolicyInput): PolicyResult
export function hasExcludedMoneyRole(job: PolicyInput): boolean
export function assertJobPublishable(job: PolicyInput): PolicyResult
export function assertPublicJobWrite<T extends PolicyInput & { active?: boolean; admin_hidden?: boolean }>(
  previous: T, patch?: Partial<T> & Record<string, unknown>
): T
