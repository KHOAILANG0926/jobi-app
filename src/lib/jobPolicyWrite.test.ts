import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { checkedPublicJobInsert, checkedAdminCreateJob, checkedAdminUnhide, checkedGuestJobUpdate, checkedLocalJobUpdate } from './jobPolicyWrite.ts'

const cases = JSON.parse(readFileSync(new URL('../../policy/job-posting-fixtures.json', import.meta.url), 'utf8'))
function fake(row: Record<string, unknown>, readError = false) {
  let stored = { ...row }
  const writes: string[] = []
  const client = {
    from: () => {
      const chain = {
        select: () => chain, eq: () => chain,
        single: async () => ({ data: readError ? null : stored, error: readError ? { message: 'read failed' } : null }),
        insert: (payload: Record<string, unknown>) => { writes.push('insert'); stored = { ...payload }; return chain },
        update: (payload: Record<string, unknown>) => { writes.push('update'); stored = { ...stored, ...payload }; return chain },
        then: (resolve: (value: unknown) => unknown) => resolve({ data: stored, error: null }),
      }
      return chain
    },
    rpc: async (name: string, params: Record<string, unknown>) => {
      if (name === 'get_guest_job') return { data: readError ? null : [stored], error: readError ? { message: 'read failed' } : null }
      writes.push(name)
      return { data: [stored], error: null }
    },
  } as unknown as SupabaseClient
  return { client, writes }
}
for (const fixture of cases) {
  const row = { ...fixture.input, active: true, admin_hidden: false }
  const actions = [
    (client: SupabaseClient) => checkedPublicJobInsert(client, row),
    (client: SupabaseClient) => checkedAdminCreateJob(client, row),
    (client: SupabaseClient) => checkedAdminUnhide(client, 1, ''),
    (client: SupabaseClient) => checkedLocalJobUpdate(client, 1, { urgent: true }),
    (client: SupabaseClient) => checkedLocalJobUpdate(client, 1, { active: true }),
    (client: SupabaseClient) => checkedGuestJobUpdate(client, { p_job_id: 1, p_token: 'synthetic', p_active: true }),
    (client: SupabaseClient) => checkedGuestJobUpdate(client, { p_job_id: 1, p_token: 'synthetic', p_description: fixture.input.description }),
  ]
  for (const action of actions) {
    const db = fake(row)
    if (fixture.expected === 'allow') await action(db.client)
    else {
      let rejected = false
      try { await action(db.client) } catch { rejected = true }
      assert.equal(rejected, true, fixture.id)
      assert.equal(db.writes.length, 0, fixture.id + ' must not write')
    }
  }
}
const safe = { ...cases.find((r: { expected: string }) => r.expected === 'allow').input, active: true, admin_hidden: false }
const blocked = cases.find((r: { id: string }) => r.id === 'b2b-4750-type-synthetic').input
for (const operation of [
  (client: SupabaseClient) => checkedLocalJobUpdate(client, 1, blocked),
  (client: SupabaseClient) => checkedGuestJobUpdate(client, {
    p_job_id: 1, p_token: 'synthetic', p_title: blocked.title, p_description: blocked.description,
  }),
]) {
  const db = fake(safe)
  await assert.rejects(async () => operation(db.client))
  assert.equal(db.writes.length, 0, 'allowed -> excluded edit not written')
}
const failing = fake(safe, true)
await assert.rejects(() => checkedLocalJobUpdate(failing.client, 1, { urgent: true }))
assert.equal(failing.writes.length, 0, 'read failure must not publish')
const ending = fake({ ...blocked, active: true, admin_hidden: false })
await checkedGuestJobUpdate(ending.client, { p_job_id: 1, p_token: 'synthetic', p_active: false })
assert.equal(ending.writes.length, 1, 'guest can deactivate excluded job')
// Explicitly demonstrate the boundary: raw RPC bypasses our app helper.
// This fake has no DB trigger; this is not a real DB enforcement test.
const bypass = fake(safe)
await bypass.client.rpc('admin_create_job', { payload: blocked })
assert.equal(bypass.writes.length, 1)
console.log('policy write helpers: 33 cases x 7 paths, content edit, reactivation, deactivation, read failure and unresolved raw-RPC bypass passed')
