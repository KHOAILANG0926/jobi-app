import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) throw new Error('Supabase E2E environment is missing')
const adminApi = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
const supabaseSource = await readFile(new URL('../src/lib/supabase.ts', import.meta.url), 'utf8')
const anonKey = supabaseSource.match(/createClient\(\s*['"][^'"]+['"]\s*,\s*['"]([^'"]+)['"]/)?.[1]
if (!anonKey) throw new Error('Public Supabase client configuration is unavailable')
const marker = `VGB E2E ADMIN ${randomUUID()}`
const password = `Vgb!${randomUUID()}a9`
const users = []
const jobs = []
const photoPaths = []

async function createUser(role, appRole) {
  const email = `vgb-admin-e2e-${randomUUID()}@example.invalid`
  const { data, error } = await adminApi.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { name: marker, role },
    app_metadata: appRole ? { role: appRole } : {},
  })
  if (error || !data.user) throw error || new Error('user creation failed')
  users.push(data.user.id)
  const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const signed = await client.auth.signInWithPassword({ email, password })
  if (signed.error || !signed.data.session) throw signed.error || new Error('sign in failed')
  return { id: data.user.id, email, client, token: signed.data.session.access_token }
}

async function denied(promise, label) {
  const result = await promise
  assert.ok(result.error || (Array.isArray(result.data) && result.data.length === 0), `${label} was not denied`)
}

async function cleanup() {
  if (users.length) {
    await adminApi.from('messages').delete().in('thread_id', (await adminApi.from('message_threads').select('id').in('seeker_id', users)).data?.map(x => x.id) || [])
    await adminApi.from('message_threads').delete().in('seeker_id', users)
    await adminApi.from('interviews').delete().in('seeker_id', users)
    await adminApi.from('applications').delete().in('seeker_id', users)
    await adminApi.from('reports').delete().in('reporter_id', users)
  }
  if (jobs.length) await adminApi.from('local_jobs').delete().in('id', jobs)
  if (photoPaths.length) await adminApi.storage.from('cv-photos').remove(photoPaths)
  await adminApi.from('admin_audit_logs').delete().in('admin_user_id', users)
  for (const id of users) await adminApi.auth.admin.deleteUser(id)
}

try {
  const systemAdmin = await createUser('seeker', 'admin')
  const employerA = await createUser('employer')
  const employerB = await createUser('employer')
  const seeker = await createUser('seeker')
  const outsider = await createUser('seeker')

  const inserted = await employerA.client.from('local_jobs').insert({
    title: marker, company: marker, category: 'office', salary: '', location: '', description: marker,
    employer_id: employerA.id, origin: 'employer', admin_hidden: false, active: true,
  }).select().single()
  if (inserted.error) throw inserted.error
  const jobId = inserted.data.id; jobs.push(jobId)

  await denied(employerB.client.from('local_jobs').update({ title: `${marker} other` }).eq('id', jobId).select(), 'other employer update')
  await denied(employerA.client.from('local_jobs').update({ admin_hidden: true }).eq('id', jobId).select(), 'employer admin_hidden update')
  await denied(seeker.client.rpc('admin_set_job_hidden', { target_job_id: jobId, hidden: true, reason: marker }), 'seeker admin RPC')
  await denied(employerA.client.rpc('admin_set_job_hidden', { target_job_id: jobId, hidden: true, reason: marker }), 'employer admin RPC')

  const hidden = await systemAdmin.client.rpc('admin_set_job_hidden', { target_job_id: jobId, hidden: true, reason: marker })
  if (hidden.error) throw hidden.error
  const anon = createClient(url, anonKey, { auth: { persistSession: false } })
  assert.equal((await anon.from('local_jobs').select('id').eq('id', jobId)).data?.length, 0)
  assert.equal((await seeker.client.from('local_jobs').select('id').eq('id', jobId)).data?.length, 0)
  assert.equal((await systemAdmin.client.from('local_jobs').select('id').eq('id', jobId)).data?.length, 1)
  await systemAdmin.client.rpc('admin_set_job_hidden', { target_job_id: jobId, hidden: false, reason: marker })
  assert.equal((await anon.from('local_jobs').select('id').eq('id', jobId)).data?.length, 1)

  const report = await seeker.client.from('reports').insert({
    reporter_id: seeker.id, target_type: 'job', target_id: String(jobId), category: 'spam',
    description: marker, snapshot: { marker, title: marker },
  }).select().single()
  if (report.error) throw report.error
  assert.equal((await seeker.client.from('reports').select('id').eq('id', report.data.id)).data?.length, 1)
  assert.equal((await outsider.client.from('reports').select('id').eq('id', report.data.id)).data?.length, 0)
  assert.equal((await systemAdmin.client.from('reports').select('id').eq('id', report.data.id)).data?.length, 1)
  if ((await systemAdmin.client.rpc('admin_handle_report', { target_report_id: report.data.id, next_status: 'resolved', note: marker })).error) throw new Error('admin report handling failed')
  await denied(seeker.client.from('admin_audit_logs').insert({ admin_user_id: seeker.id, action: 'fake', target_type: 'job', target_id: String(jobId) }).select(), 'audit insert')

  const app = await seeker.client.from('applications').insert({ job_id: jobId, seeker_id: seeker.id, employer_id: employerA.id, status: 'submitted', job_title: marker, company: marker }).select().single()
  if (app.error) throw app.error
  const thread = await seeker.client.from('message_threads').insert({ job_id: jobId, seeker_id: seeker.id, employer_id: employerA.id, job_title: marker, company: marker }).select().single()
  if (thread.error) throw thread.error
  if ((await seeker.client.from('messages').insert({ thread_id: thread.data.id, from_role: 'seeker', body: marker })).error) throw new Error('active message failed')
  const interview = await employerA.client.from('interviews').insert({ job_id: jobId, seeker_id: seeker.id, employer_id: employerA.id, job_title: marker, company: marker, datetime: new Date(Date.now() + 86400000).toISOString() }).select().single()
  if (interview.error) throw interview.error
  const photoPath = `${seeker.id}/${randomUUID()}.png`; photoPaths.push(photoPath)
  if ((await seeker.client.storage.from('cv-photos').upload(photoPath, new Uint8Array([137, 80, 78, 71]), { contentType: 'image/png' })).error) throw new Error('active CV photo upload failed')

  // The clients retain their pre-suspension access tokens. Database RLS must deny those same tokens immediately.
  if ((await adminApi.auth.admin.updateUserById(employerA.id, { ban_duration: '876000h' })).error) throw new Error('employer ban failed')
  if ((await systemAdmin.client.rpc('admin_set_account_status', { target_user_id: employerA.id, next_status: 'suspended', reason: marker })).error) throw new Error('employer status failed')
  await denied(employerA.client.from('local_jobs').update({ title: marker }).eq('id', jobId).select(), 'suspended employer job update')
  await denied(employerA.client.from('local_jobs').insert({ title: marker, company: marker, employer_id: employerA.id, origin: 'employer' }).select(), 'suspended employer job insert')
  await denied(employerA.client.from('applications').update({ status: 'reviewing' }).eq('id', app.data.id).select(), 'suspended employer application update')
  await denied(employerA.client.from('messages').insert({ thread_id: thread.data.id, from_role: 'employer', body: marker }).select(), 'suspended employer message')
  await denied(employerA.client.from('interviews').update({ status: 'confirmed' }).eq('id', interview.data.id).select(), 'suspended employer interview update')

  if ((await adminApi.auth.admin.updateUserById(seeker.id, { ban_duration: '876000h' })).error) throw new Error('seeker ban failed')
  if ((await systemAdmin.client.rpc('admin_set_account_status', { target_user_id: seeker.id, next_status: 'suspended', reason: marker })).error) throw new Error('seeker status failed')
  assert.equal((await seeker.client.from('applications').select('id').eq('id', app.data.id)).data?.length, 0)
  assert.equal((await seeker.client.from('message_threads').select('id').eq('id', thread.data.id)).data?.length, 0)
  assert.equal((await seeker.client.from('interviews').select('id').eq('id', interview.data.id)).data?.length, 0)
  await denied(seeker.client.from('applications').delete().eq('id', app.data.id).select(), 'suspended seeker application delete')
  await denied(seeker.client.from('messages').insert({ thread_id: thread.data.id, from_role: 'seeker', body: marker }).select(), 'suspended seeker message')
  await denied(seeker.client.from('user_profiles').upsert({ user_id: seeker.id, full_name: marker }).select(), 'suspended profile')
  await denied(seeker.client.from('user_cvs').upsert({ user_id: seeker.id, cv_data: { marker } }).select(), 'suspended CV')
  assert.ok((await seeker.client.storage.from('cv-photos').download(photoPath)).error, 'suspended CV photo read was not denied')
  await denied(seeker.client.from('reports').insert({ reporter_id: seeker.id, target_type: 'job', target_id: String(jobId), category: 'spam' }).select(), 'suspended report')
  assert.equal((await anon.from('local_jobs').select('id').eq('id', jobId)).data?.length, 1, 'public job must remain readable')

  // Unsuspend and force a new login; old sessions are not revived intentionally.
  if ((await adminApi.auth.admin.updateUserById(seeker.id, { ban_duration: 'none' })).error) throw new Error('seeker unban failed')
  if ((await systemAdmin.client.rpc('admin_set_account_status', { target_user_id: seeker.id, next_status: 'active', reason: marker })).error) throw new Error('seeker activate failed')
  const fresh = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  if ((await fresh.auth.signInWithPassword({ email: seeker.email, password })).error) throw new Error('fresh login after unsuspend failed')
  assert.equal((await fresh.from('applications').select('id').eq('id', app.data.id)).data?.length, 1)

  console.log('Admin operations operating E2E passed')
} finally {
  await cleanup()
}
