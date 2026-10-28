import type { SupabaseClient } from '@supabase/supabase-js'
import { assertJobPublishable, assertPublicJobWrite } from './jobPostingPolicy.mjs'

// App-side preflight only: separate read/write is NOT atomic DB enforcement.
export async function readJobForPolicy(client: SupabaseClient, id: string | number) {
  const { data, error } = await client.from('local_jobs')
    .select('title,company,category,salary,description,active,admin_hidden')
    .eq('id', id).single()
  if (error || !data) throw new Error(error?.message ?? 'Không đọc được tin để kiểm tra.')
  if (typeof data.active !== 'boolean' || typeof data.admin_hidden !== 'boolean')
    throw new Error('Không xác định được trạng thái công khai của tin.')
  return data
}
export async function checkedLocalJobUpdate(
  client: SupabaseClient, id: string | number, patch: Record<string, unknown>,
) {
  const previous = await readJobForPolicy(client, id)
  assertPublicJobWrite(previous, patch)
  return client.from('local_jobs').update(patch).eq('id', id)
}
// 공고 등록은 DB 입구 public.ingest_job 하나만 (Lee 2026-10-29). local_jobs에 직접 INSERT하면 DB가 거부한다.
// 원문(source_text): 붙여 넣은 글이 있으면 그 글, 없으면 입력한 칸을 그대로 묶은 글(Lee 2026-10-29 확인).
const NOT_SOURCE = new Set(['guest_manage_token', 'employer_id', 'lat', 'lng', 'images', 'image_url', 'active', 'admin_hidden', 'origin', 'posted_at'])
export function ingestSourceText(fields: Record<string, unknown>, pastedText?: string): string {
  const pasted = pastedText?.trim()
  if (pasted) return pasted
  return Object.entries(fields)
    .filter(([key, value]) => !NOT_SOURCE.has(key) && value != null && String(value).trim() !== '')
    .map(([key, value]) => `${key}: ${String(value).trim()}`)
    .join('\n')
}
type IngestChannel = 'admin' | 'employer'
async function ingestJob(client: SupabaseClient, channel: IngestChannel, payload: Record<string, unknown>,
  options: { select: string, pastedText?: string }) {
  assertJobPublishable(payload)
  const p = { ...payload, channel, source_text: ingestSourceText(payload, options.pastedText) }
  const { data: id, error } = await client.rpc('ingest_job', { p })
  if (error) return { data: null, error }
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0)
    return { data: null, error: { message: 'Máy chủ chưa trả về mã tin đã lưu.' } }
  return client.from('local_jobs').select(options.select).eq('id', id).single()
}
export async function checkedAdminCreateJob(client: SupabaseClient, payload: Record<string, unknown>, pastedText?: string) {
  return ingestJob(client, 'admin', payload, { select: 'id,active,admin_hidden', pastedText })
}
export async function checkedAdminUnhide(client: SupabaseClient, id: number, reason: string) {
  const previous = await readJobForPolicy(client, id)
  assertPublicJobWrite(previous, { admin_hidden: false })
  return client.rpc('admin_set_job_hidden', { target_job_id: id, hidden: false, reason })
}
export async function checkedGuestJobUpdate(client: SupabaseClient, params: Record<string, unknown>) {
  const { data, error } = await client.rpc('get_guest_job', {
    p_job_id: params.p_job_id, p_token: params.p_token,
  })
  const previous = data?.[0]
  if (error || !previous) throw new Error('Không đọc được tin để kiểm tra.')
  const patch: Record<string, unknown> = {}
  for (const field of ['title', 'company', 'category', 'salary', 'description', 'active']) {
    // update_guest_job COALESCE semantics: null does not clear existing fields.
    if (params['p_' + field] != null) patch[field] = params['p_' + field]
  }
  if (typeof previous.active !== 'boolean') throw new Error('Không xác định được trạng thái tin.')
  // Legacy token RPC omits admin_hidden. Check public membership rather than
  // inventing admin_hidden=false (which rejected edits to already hidden jobs).
  // No private columns/token are requested and no guest caller controls hidden.
  let currentlyPublic: boolean
  if (typeof previous.admin_hidden === 'boolean') {
    currentlyPublic = previous.active && !previous.admin_hidden
  } else {
    const { data: publicRow, error: publicError } = await client.from('local_jobs')
      .select('id').eq('id', params.p_job_id)
      .eq('active', true).eq('admin_hidden', false).maybeSingle()
    if (publicError) throw new Error('Không xác định được trạng thái công khai của tin.')
    currentlyPublic = publicRow != null
  }
  // Hidden edits preserve DB hidden state; explicit activation still requires
  // policy approval when legacy RPC cannot tell if hidden. Race/RPC bypass remains.
  const activating = params.p_active === true && previous.active === false
  if ((currentlyPublic && patch.active !== false) || activating)
    assertJobPublishable({ ...previous, ...patch })
  return client.rpc('update_guest_job', params)
}

export function checkedPublicJobInsert(client: SupabaseClient, payload: Record<string, unknown>, select = 'id,active,admin_hidden') {
  return ingestJob(client, 'employer', payload, { select })
}
