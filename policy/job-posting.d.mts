export interface PolicyInput { title?: unknown; description?: unknown; category?: unknown; company?: unknown }
export interface PolicyDecision { decision: 'allow' | 'exclude' | 'review'; reason: string; version: string }
export const POLICY_VERSION: string
export function normalizePolicyText(value: unknown): string
export function evaluateJobPolicy(input: PolicyInput | null | undefined): PolicyDecision
export function policyMessage(decision: PolicyDecision): string
export function assertJobPolicy(input: PolicyInput | null | undefined): PolicyDecision
export function assertJobChange(current: PolicyInput | null | undefined, patch?: Record<string, unknown>): PolicyDecision
