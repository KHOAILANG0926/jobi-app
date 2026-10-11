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
export async function checkedAdminCreateJob(client: SupabaseClient, payload: Record<string, unknown>) {
  assertJobPublishable(payload)
  return client.rpc('admin_create_job', { payload })
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
  // Guest RPC exposes active but not admin_hidden; conservatively check any active
  // write without requesting hidden/private/token columns via public SELECT.
  assertPublicJobWrite({ ...previous, admin_hidden: false }, patch)
  return client.rpc('update_guest_job', params)
}

export function checkedPublicJobInsert(client: SupabaseClient, payload: Record<string, unknown>) {
  assertJobPublishable(payload)
  return client.from('local_jobs').insert(payload)
}
