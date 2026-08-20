import type { Job } from '../types/job'
import { toAppJobId, toDbJobId } from './jobId'
import { supabase } from './supabase'

export type MessageFrom = 'seeker' | 'employer'

export interface StoredMessage {
  id: string
  from: MessageFrom
  body: string
  sentAt: string
}

export interface MessageThread {
  id: string
  jobId: string
  jobTitle: string
  company: string
  employerPhone?: string
  seekerName?: string
  seekerId?: string
  messages: StoredMessage[]
  updatedAt: string
  unreadBySeeker?: boolean
  unreadByEmployer?: boolean
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

function dispatch() {
  window.dispatchEvent(new CustomEvent('vgb:messages'))
}

async function attachMessages(threadRows: Record<string, unknown>[]): Promise<MessageThread[]> {
  if (threadRows.length === 0) return []
  const ids = threadRows.map((t) => t.id as string)
  const { data: msgRows, error } = await supabase
    .from('messages')
    .select('*')
    .in('thread_id', ids)
    .order('sent_at', { ascending: true })
  if (error) console.error('loadThreads: fetch messages failed', error)

  const byThread = new Map<string, StoredMessage[]>()
  for (const m of msgRows ?? []) {
    const list = byThread.get(m.thread_id as string) ?? []
    list.push({ id: m.id as string, from: m.from_role as MessageFrom, body: m.body as string, sentAt: m.sent_at as string })
    byThread.set(m.thread_id as string, list)
  }

  return threadRows
    .map((t) => ({
      id: t.id as string,
      jobId: toAppJobId(t.job_id as number),
      jobTitle: (t.job_title as string) ?? '',
      company: (t.company as string) ?? '',
      employerPhone: (t.employer_phone as string) ?? undefined,
      seekerName: (t.seeker_name as string) ?? undefined,
      seekerId: (t.seeker_id as string) ?? undefined,
      messages: byThread.get(t.id as string) ?? [],
      updatedAt: t.updated_at as string,
      unreadBySeeker: (t.unread_by_seeker as boolean) ?? false,
      unreadByEmployer: (t.unread_by_employer as boolean) ?? false,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

/** 구직자 본인의 모든 대화 스레드 (RLS가 seeker_id로 범위를 제한). */
export async function loadThreads(): Promise<MessageThread[]> {
  const { data, error } = await supabase
    .from('message_threads')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) {
    console.error('loadThreads failed', error)
    return []
  }
  return attachMessages(data ?? [])
}

/** 고용주 소유 공고들의 스레드 — 지원자(seeker)별로 분리된 채 반환. */
export async function loadEmployerThreads(jobIds: string[]): Promise<MessageThread[]> {
  if (jobIds.length === 0) return []
  const dbIds = jobIds.map(toDbJobId)
  const { data, error } = await supabase
    .from('message_threads')
    .select('*')
    .in('job_id', dbIds)
    .order('updated_at', { ascending: false })
  if (error) {
    console.error('loadEmployerThreads failed', error)
    return []
  }
  return attachMessages(data ?? [])
}

export async function countUnreadForSeeker(): Promise<number> {
  const { count, error } = await supabase
    .from('message_threads')
    .select('id', { count: 'exact', head: true })
    .eq('unread_by_seeker', true)
  if (error) {
    console.error('countUnreadForSeeker failed', error)
    return 0
  }
  return count ?? 0
}

export async function countUnreadForEmployer(jobIds: string[]): Promise<number> {
  if (jobIds.length === 0) return 0
  const dbIds = jobIds.map(toDbJobId)
  const { count, error } = await supabase
    .from('message_threads')
    .select('id', { count: 'exact', head: true })
    .in('job_id', dbIds)
    .eq('unread_by_employer', true)
  if (error) {
    console.error('countUnreadForEmployer failed', error)
    return 0
  }
  return count ?? 0
}

export async function markReadBySeeker(jobId: string): Promise<void> {
  const uid = await currentUserId()
  if (!uid) return
  const { error } = await supabase
    .from('message_threads')
    .update({ unread_by_seeker: false })
    .eq('job_id', toDbJobId(jobId))
    .eq('seeker_id', uid)
  if (error) { console.error('markReadBySeeker failed', error); return }
  dispatch()
}

/** threadId 기준 — 고용주 쪽은 공고당 스레드가 여러 개(지원자별)일 수 있어 jobId로는 특정 불가. */
export async function markReadByEmployer(threadId: string): Promise<void> {
  const { error } = await supabase
    .from('message_threads')
    .update({ unread_by_employer: false })
    .eq('id', threadId)
  if (error) { console.error('markReadByEmployer failed', error); return }
  dispatch()
}

export async function appendSeekerMessage(
  job: Pick<Job, 'id' | 'title' | 'company' | 'employerPhone'> & { employerId?: string },
  body: string,
  seekerName?: string,
): Promise<boolean> {
  const uid = await currentUserId()
  if (!uid) return false
  const dbJobId = toDbJobId(job.id)

  const { data: existing, error: existingError } = await supabase
    .from('message_threads')
    .select('id')
    .eq('job_id', dbJobId)
    .eq('seeker_id', uid)
    .maybeSingle()
  if (existingError) {
    console.error('appendSeekerMessage: find thread failed', existingError)
    return false
  }

  let threadId = (existing?.id as string | undefined) ?? null
  if (!threadId) {
    if (!job.employerId) return false
    const { data: created, error: createError } = await supabase
      .from('message_threads')
      .insert({
        job_id: dbJobId,
        seeker_id: uid,
        employer_id: job.employerId ?? null,
        job_title: job.title,
        company: job.company,
        employer_phone: job.employerPhone || null,
        seeker_name: seekerName ?? null,
        unread_by_employer: true,
      })
      .select('id')
      .single()
    if (createError || !created) {
      console.error('appendSeekerMessage: create thread failed', createError)
      return false
    }
    threadId = created.id as string
  } else {
    const { error: updateError } = await supabase
      .from('message_threads')
      .update({ unread_by_employer: true, unread_by_seeker: false, updated_at: new Date().toISOString() })
      .eq('id', threadId)
    if (updateError) {
      console.error('appendSeekerMessage: update thread failed', updateError)
      return false
    }
  }

  const { error: msgError } = await supabase
    .from('messages')
    .insert({ thread_id: threadId, from_role: 'seeker', body })
  if (msgError) {
    console.error('appendSeekerMessage: insert message failed', msgError)
    return false
  }
  dispatch()
  return true
}

/** threadId 기준 (jobId→threadId로 변경 — 공고 하나에 여러 지원자 스레드가 있을 수 있어서). */
export async function appendEmployerMessage(threadId: string, body: string): Promise<boolean> {
  const { error: msgError } = await supabase
    .from('messages')
    .insert({ thread_id: threadId, from_role: 'employer', body })
  if (msgError) {
    console.error('appendEmployerMessage: insert message failed', msgError)
    return false
  }
  const { error: updateError } = await supabase
    .from('message_threads')
    .update({ unread_by_seeker: true, unread_by_employer: false, updated_at: new Date().toISOString() })
    .eq('id', threadId)
  if (updateError) {
    console.error('appendEmployerMessage: update thread failed', updateError)
    // 메시지 INSERT는 이미 확정됐다. 실패로 반환하면 UI가 초안을 복원해 재전송 시
    // 같은 메시지가 중복 저장될 수 있으므로 후속 읽음 메타데이터 오류와 구분한다.
  }
  dispatch()
  return true
}

/** 상대방이 보낸 메시지/읽음 상태 변경을 실시간으로 반영. */
export function subscribeMessages(handler: () => void): () => void {
  const channel = supabase
    .channel('messages-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => handler())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'message_threads' }, () => handler())
    .subscribe()
  return () => {
    supabase.removeChannel(channel)
  }
}
