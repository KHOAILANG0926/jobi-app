import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://edhuesdnuxlbcfephutq.supabase.co'
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!serviceRoleKey) {
  console.error('P0 remote E2E BLOCKED: SUPABASE_SERVICE_ROLE_KEY is unavailable')
  process.exit(2)
}

const admin = createClient(SUPABASE_URL, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const marker = `VGB E2E P0 ${randomUUID()}`
const password = `${randomUUID()}aA1!`
const createdUsers = []
const jobIds = []

async function createTestUser(label, role) {
  const email = `vgb-e2e-p0-${label}-${randomUUID()}@example.invalid`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: role, e2e_marker: marker },
  })
  if (error) throw error
  createdUsers.push(data.user.id)

  const client = createClient(SUPABASE_URL, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error: signInError } = await client.auth.signInWithPassword({ email, password })
  if (signInError) throw signInError
  return { id: data.user.id, client }
}

async function expectDenied(operation, label) {
  const result = await operation()
  assert.ok(result.error || !result.data || result.data.length === 0, `${label} unexpectedly succeeded`)
}

async function cleanup() {
  if (createdUsers.length === 0) return
  await admin.storage.from('cv-photos').remove(createdUsers.map((id) => `${id}/e2e.webp`))
  await admin.from('interviews').delete().in('seeker_id', createdUsers)
  await admin.from('applications').delete().in('seeker_id', createdUsers)
  await admin.from('user_cvs').delete().in('user_id', createdUsers)
  await admin.from('user_profiles').delete().in('user_id', createdUsers)
  if (jobIds.length > 0) await admin.from('local_jobs').delete().in('id', jobIds)
  for (const id of createdUsers) await admin.auth.admin.deleteUser(id)
}

try {
  const employerA = await createTestUser('employer-a', 'employer')
  const employerB = await createTestUser('employer-b', 'employer')
  const seeker = await createTestUser('seeker', 'seeker')
  const outsider = await createTestUser('outsider', 'seeker')

  const { data: job, error: jobError } = await employerA.client
    .from('local_jobs')
    .insert({
      title: marker,
      company: marker,
      category: 'office',
      location: 'E2E',
      employer_id: employerA.id,
      active: true,
    })
    .select('id')
    .single()
  if (jobError) throw jobError
  const jobId = job.id
  jobIds.push(jobId)

  const { data: crawlerJob, error: crawlerJobError } = await admin
    .from('local_jobs')
    .insert({ title: `${marker} crawler`, company: marker, employer_id: null, active: true })
    .select('id')
    .single()
  if (crawlerJobError) throw crawlerJobError
  jobIds.push(crawlerJob.id)

  await expectDenied(
    () => seeker.client.from('local_jobs').insert({ title: marker, employer_id: seeker.id }).select(),
    'seeker local_jobs insert',
  )
  const { error: spoofRoleError } = await seeker.client.auth.updateUser({ data: { role: 'employer' } })
  if (spoofRoleError) throw spoofRoleError
  await expectDenied(
    () => seeker.client.from('local_jobs').insert({ title: marker, company: marker, employer_id: seeker.id }).select(),
    'user_metadata role spoof',
  )
  await expectDenied(
    () => employerB.client.from('local_jobs').update({ title: `${marker} spoof` }).eq('id', jobId).select(),
    'other employer local_jobs update',
  )

  const { error: applicationError } = await seeker.client.from('applications').insert({
    job_id: jobId,
    seeker_id: seeker.id,
    employer_id: employerA.id,
    job_title: marker,
    company: marker,
    seeker_name: marker,
    status: 'submitted',
  })
  if (applicationError) throw applicationError
  await expectDenied(
    () => seeker.client.from('applications').insert({
      job_id: crawlerJob.id,
      seeker_id: seeker.id,
      employer_id: employerA.id,
      status: 'submitted',
    }).select(),
    'crawler application insert',
  )

  const interviewPayload = {
    job_id: jobId,
    seeker_id: seeker.id,
    employer_id: employerA.id,
    job_title: marker,
    company: marker,
    seeker_name: marker,
    datetime: new Date(Date.now() + 86_400_000).toISOString(),
    status: 'pending',
  }
  let realtimeResolve
  let realtimeReject
  const realtimeEvent = new Promise((resolve, reject) => {
    realtimeResolve = resolve
    realtimeReject = reject
  })
  const realtimeTimeout = setTimeout(() => realtimeReject(new Error('interviews Realtime timeout')), 15_000)
  const channel = employerA.client
    .channel(`p0-interviews-${randomUUID()}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'interviews',
      filter: `employer_id=eq.${employerA.id}`,
    }, (payload) => realtimeResolve(payload.new))
  await new Promise((resolve, reject) => {
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') resolve()
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error(`Realtime ${status}`))
    })
  })

  const { data: interview, error: interviewError } = await employerA.client
    .from('interviews').insert(interviewPayload).select().single()
  if (interviewError) throw interviewError
  const realtimePayload = await realtimeEvent
  clearTimeout(realtimeTimeout)
  assert.equal(realtimePayload.id, interview.id)
  await employerA.client.removeChannel(channel)

  assert.equal((await seeker.client.from('interviews').select('id').eq('id', interview.id)).data?.length, 1)
  assert.equal((await employerB.client.from('interviews').select('id').eq('id', interview.id)).data?.length, 0)
  assert.equal((await outsider.client.from('interviews').select('id').eq('id', interview.id)).data?.length, 0)
  await expectDenied(
    () => employerB.client.from('interviews').insert({ ...interviewPayload, employer_id: employerB.id }).select(),
    'forged interview ownership',
  )
  await expectDenied(
    () => employerA.client.from('interviews').insert({
      ...interviewPayload,
      job_id: crawlerJob.id,
    }).select(),
    'crawler interview insert',
  )
  await expectDenied(
    () => employerA.client.from('interviews').insert({
      ...interviewPayload,
      seeker_id: outsider.id,
    }).select(),
    'interview without application',
  )
  await expectDenied(
    () => employerA.client.from('interviews').update({ seeker_id: outsider.id }).eq('id', interview.id).select(),
    'interview ownership column update',
  )
  for (const status of ['confirmed', 'cancelled']) {
    const { error } = await employerA.client.from('interviews').update({ status }).eq('id', interview.id)
    if (error) throw error
  }

  const profile = { user_id: seeker.id, full_name: marker, phone: '', email: '', city: '', bio: '' }
  if ((await seeker.client.from('user_profiles').insert(profile)).error) throw new Error('own profile insert failed')
  assert.equal((await outsider.client.from('user_profiles').select().eq('user_id', seeker.id)).data?.length, 0)
  await expectDenied(
    () => outsider.client.from('user_profiles').insert({ ...profile, user_id: seeker.id }).select(),
    'other user profile insert',
  )

  const cv = { user_id: seeker.id, cv_data: { fullName: marker }, photo_path: null }
  if ((await seeker.client.from('user_cvs').insert(cv)).error) throw new Error('own CV insert failed')
  assert.equal((await outsider.client.from('user_cvs').select().eq('user_id', seeker.id)).data?.length, 0)

  const photoPath = `${seeker.id}/e2e.webp`
  const photoBytes = new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80])
  const upload = await seeker.client.storage.from('cv-photos').upload(photoPath, photoBytes, {
    contentType: 'image/webp',
  })
  if (upload.error) throw upload.error
  assert.ok((await seeker.client.storage.from('cv-photos').download(photoPath)).data)
  assert.ok((await outsider.client.storage.from('cv-photos').download(photoPath)).error)
  assert.ok((await outsider.client.storage.from('cv-photos').upload(photoPath, photoBytes, {
    contentType: 'image/webp',
  })).error)

  console.log('P0 remote E2E: PASS')
} finally {
  await cleanup()
}
