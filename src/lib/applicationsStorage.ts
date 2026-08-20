import { supabase } from './supabase'
import { toAppJobId, toDbJobId } from './jobId'

export type ApplicationStatus =
  | 'submitted'
  | 'reviewing'
  | 'interview'
  | 'accepted'
  | 'rejected'

export interface StatusHistoryEntry {
  status: ApplicationStatus
  changedAt: string
}

export interface JobApplication {
  id?: string
  jobId: string
  jobTitle: string
  company: string
  employerId?: string
  seekerId?: string
  seekerName?: string
  seekerPhone?: string
  appliedAt: string
  status: ApplicationStatus
  statusHistory?: StatusHistoryEntry[]
}

export const APPLICATION_STATUS_META: Record<
  ApplicationStatus,
  { labelVi: string; badgeClass: string }
> = {
  submitted: { labelVi: 'Đã nộp', badgeClass: 'app-status--submitted' },
  reviewing: { labelVi: 'Đang xem xét', badgeClass: 'app-status--reviewing' },
  interview: { labelVi: 'Phỏng vấn', badgeClass: 'app-status--interview' },
  accepted: { labelVi: 'Đã nhận', badgeClass: 'app-status--accepted' },
  rejected: { labelVi: 'Từ chối', badgeClass: 'app-status--rejected' },
}

function rowToApplication(row: Record<string, unknown>): JobApplication {
  return {
    id: row.id as string,
    jobId: toAppJobId(row.job_id as number),
    jobTitle: (row.job_title as string) ?? '',
    company: (row.company as string) ?? '',
    employerId: (row.employer_id as string) ?? undefined,
    seekerId: (row.seeker_id as string) ?? undefined,
    seekerName: (row.seeker_name as string) ?? undefined,
    seekerPhone: (row.seeker_phone as string) ?? undefined,
    appliedAt: row.applied_at as string,
    status: row.status as ApplicationStatus,
    statusHistory: (row.status_history as StatusHistoryEntry[]) ?? [],
  }
}

export async function loadApplications(): Promise<JobApplication[]> {
  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .order('applied_at', { ascending: false })
  if (error) {
    console.error('loadApplications failed', error)
    return []
  }
  return (data ?? []).map(rowToApplication)
}

export async function hasAppliedToJob(jobId: string, seekerId?: string): Promise<boolean> {
  if (!seekerId) return false
  const { data, error } = await supabase
    .from('applications')
    .select('id')
    .eq('job_id', toDbJobId(jobId))
    .eq('seeker_id', seekerId)
    .maybeSingle()
  if (error) {
    console.error('hasAppliedToJob failed', error)
    return false
  }
  return !!data
}

export async function addApplication(entry: {
  jobId: string
  jobTitle: string
  company: string
  employerId?: string
  seekerId?: string
  seekerName?: string
  seekerPhone?: string
}): Promise<{ ok: true } | { ok: false; reason: 'duplicate' | 'unauthenticated' | 'error' }> {
  if (!entry.seekerId) return { ok: false, reason: 'unauthenticated' }
  const now = new Date().toISOString()
  const { error } = await supabase.from('applications').insert({
    job_id: toDbJobId(entry.jobId),
    seeker_id: entry.seekerId,
    employer_id: entry.employerId ?? null,
    job_title: entry.jobTitle,
    company: entry.company,
    seeker_name: entry.seekerName ?? null,
    seeker_phone: entry.seekerPhone ?? null,
    status: 'submitted',
    status_history: [{ status: 'submitted', changedAt: now }],
    applied_at: now,
  })
  if (error) {
    if (error.code === '23505') return { ok: false, reason: 'duplicate' }
    console.error('addApplication failed', error)
    return { ok: false, reason: 'error' }
  }
  window.dispatchEvent(new CustomEvent('vgb:applications'))
  return { ok: true }
}

export async function updateApplicationStatus(id: string, status: ApplicationStatus): Promise<boolean> {
  const { data: current, error: fetchError } = await supabase
    .from('applications')
    .select('status_history')
    .eq('id', id)
    .single()
  if (fetchError) {
    console.error('updateApplicationStatus fetch failed', fetchError)
    return false
  }
  const prevHistory = (current?.status_history as StatusHistoryEntry[]) ?? []
  const nextHistory = [...prevHistory, { status, changedAt: new Date().toISOString() }]
  const { error } = await supabase
    .from('applications')
    .update({ status, status_history: nextHistory })
    .eq('id', id)
  if (error) {
    console.error('updateApplicationStatus update failed', error)
    return false
  }
  window.dispatchEvent(new CustomEvent('vgb:applications'))
  return true
}

/** 구직자 본인의 지원 취소(철회) — 상태값 변경이 아니라 행 삭제. */
export async function cancelApplication(id: string): Promise<void> {
  const { error } = await supabase.from('applications').delete().eq('id', id)
  if (error) {
    console.error('cancelApplication failed', error)
    return
  }
  window.dispatchEvent(new CustomEvent('vgb:applications'))
}

/** 상대방(구직자↔고용주)이 만든/바꾼 지원 내역을 실시간으로 반영하기 위한 구독. */
export function subscribeApplications(handler: () => void): () => void {
  const channel = supabase
    .channel('applications-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'applications' }, () => handler())
    .subscribe()
  return () => {
    supabase.removeChannel(channel)
  }
}
