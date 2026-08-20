import { toAppJobId, toDbJobId } from './jobId'
import { supabase } from './supabase'

export type InterviewStatus = 'pending' | 'confirmed' | 'cancelled'

export interface InterviewSlot {
  id: string
  jobId: string
  jobTitle: string
  company: string
  seekerId: string
  seekerName?: string
  employerId: string
  datetime: string
  location: string
  notes: string
  status: InterviewStatus
  createdAt: string
}

function rowToSlot(row: Record<string, unknown>): InterviewSlot {
  return {
    id: row.id as string,
    jobId: toAppJobId(row.job_id as number),
    jobTitle: (row.job_title as string) ?? '',
    company: (row.company as string) ?? '',
    seekerId: row.seeker_id as string,
    seekerName: (row.seeker_name as string) ?? undefined,
    employerId: row.employer_id as string,
    datetime: row.datetime as string,
    location: (row.location as string) ?? '',
    notes: (row.notes as string) ?? '',
    status: row.status as InterviewStatus,
    createdAt: row.created_at as string,
  }
}

export async function loadSeekerInterviews(seekerId: string): Promise<InterviewSlot[]> {
  const { data, error } = await supabase
    .from('interviews')
    .select('*')
    .eq('seeker_id', seekerId)
    .neq('status', 'cancelled')
    .order('datetime', { ascending: true })
  if (error) {
    console.error('loadSeekerInterviews failed', error)
    return []
  }
  return (data ?? []).map(rowToSlot)
}

export async function loadEmployerInterviews(employerId: string): Promise<InterviewSlot[]> {
  const { data, error } = await supabase
    .from('interviews')
    .select('*')
    .eq('employer_id', employerId)
    .neq('status', 'cancelled')
    .order('datetime', { ascending: true })
  if (error) {
    console.error('loadEmployerInterviews failed', error)
    return []
  }
  return (data ?? []).map(rowToSlot)
}

export async function getInterviewForApplication(jobId: string, seekerId: string): Promise<InterviewSlot | null> {
  const { data, error } = await supabase
    .from('interviews')
    .select('*')
    .eq('job_id', toDbJobId(jobId))
    .eq('seeker_id', seekerId)
    .neq('status', 'cancelled')
    .maybeSingle()
  if (error) {
    console.error('getInterviewForApplication failed', error)
    return null
  }
  return data ? rowToSlot(data) : null
}

/** 같은 (공고, 지원자) 조합의 기존 슬롯을 대체한다 (upsert on job_id+seeker_id). */
export async function scheduleInterview(input: Omit<InterviewSlot, 'id' | 'createdAt'>): Promise<InterviewSlot> {
  const { data, error } = await supabase
    .from('interviews')
    .upsert(
      {
        job_id: toDbJobId(input.jobId),
        seeker_id: input.seekerId,
        employer_id: input.employerId,
        job_title: input.jobTitle,
        company: input.company,
        seeker_name: input.seekerName ?? null,
        datetime: input.datetime,
        location: input.location,
        notes: input.notes,
        status: input.status,
      },
      { onConflict: 'job_id,seeker_id' },
    )
    .select('*')
    .single()
  if (error || !data) {
    throw error ?? new Error('scheduleInterview failed')
  }
  window.dispatchEvent(new CustomEvent('vgb:interviews'))
  return rowToSlot(data)
}

export async function updateInterviewStatus(id: string, status: InterviewStatus): Promise<void> {
  const { error } = await supabase.from('interviews').update({ status }).eq('id', id)
  if (error) {
    console.error('updateInterviewStatus failed', error)
    return
  }
  window.dispatchEvent(new CustomEvent('vgb:interviews'))
}

/** 상대방이 만든/바꾼 면접 일정을 실시간으로 반영. */
export function subscribeInterviews(handler: () => void): () => void {
  const channel = supabase
    .channel('interviews-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'interviews' }, () => handler())
    .subscribe()
  return () => {
    supabase.removeChannel(channel)
  }
}
