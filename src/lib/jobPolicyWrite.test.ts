import cases from '../../policy/job-posting-fixtures.mjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { checkedPublicJobInsert, checkedAdminCreateJob, checkedAdminUnhide, checkedGuestJobUpdate, checkedLocalJobUpdate } from './jobPolicyWrite.ts'

const assert = {
  equal(actual: unknown, expected: unknown, label = '') {
    if (actual !== expected) throw new Error(label + ': expected ' + String(expected) + ', got ' + String(actual))
  },
  deepEqual(actual: unknown, expected: unknown, label = '') {
    this.equal(JSON.stringify(actual), JSON.stringify(expected), label)
  },
  throws(fn: () => unknown) {
    let rejected = false
    try { fn() } catch { rejected = true }
    this.equal(rejected, true, 'expected rejection')
  },
  doesNotThrow(fn: () => unknown) { fn() },
  async rejects(fn: () => Promise<unknown>) {
    let rejected = false
    try { await fn() } catch { rejected = true }
    this.equal(rejected, true, 'expected async rejection')
  },
}
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
    rpc: async (name: string, _params: Record<string, unknown>) => {
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
    if (fixture.expected === 'allow') {
      await action(db.client)
      assert.equal(db.writes.length, 1, fixture.id + ' allowed write must reach mocked boundary')
    }
    else {
      let rejected = false
      try { await action(db.client) } catch { rejected = true }
      assert.equal(rejected, true, fixture.id)
      assert.equal(db.writes.length, 0, fixture.id + ' must not write')
    }
  }
}
const safe = { ...cases.find((r: { expected: string }) => r.expected === 'allow')!.input, active: true, admin_hidden: false }
const blocked = cases.find((r: { id: string }) => r.id === 'b2b-4750-type-synthetic')!.input
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
console.log('policy write helpers: ' + cases.length + ' cases x 7 paths, content edit, reactivation, deactivation, read failure and unresolved raw-RPC bypass passed')

function legacyGuest(row: Record<string, unknown>, visible: boolean, publicReadError = false) {
  const writes: Record<string, unknown>[] = []
  const publicReads: string[] = []
  const client = {
    from: () => {
      const chain = {
        select: (columns: string) => { publicReads.push(columns); return chain },
        eq: () => chain,
        maybeSingle: async () => ({
          data: visible ? { id: 1 } : null,
          error: publicReadError ? { message: 'read failed' } : null,
        }),
      }
      return chain
    },
    rpc: async (name: string, params: Record<string, unknown>) => {
      if (name === 'get_guest_job') return { data: [row], error: null }
      writes.push(params)
      return { data: [{ id: 1, active: row.active }], error: null }
    },
  } as unknown as SupabaseClient
  return { client, writes, publicReads }
}
const { admin_hidden: _hidden, ...legacyBlocked } = { ...blocked, active: true, admin_hidden: true }
const hiddenEdit = legacyGuest(legacyBlocked, false)
await checkedGuestJobUpdate(hiddenEdit.client, { p_job_id: 1, p_token: 'synthetic', p_description: blocked.description })
assert.equal(hiddenEdit.writes.length, 1, 'legacy hidden edit must be saved')
assert.equal(Object.hasOwn(hiddenEdit.writes[0], 'admin_hidden'), false, 'hidden not changed by guest')
assert.deepEqual(hiddenEdit.publicReads, ['id'], 'no private fields read')
const publicEdit = legacyGuest(legacyBlocked, true)
await assert.rejects(() => checkedGuestJobUpdate(publicEdit.client, {
  p_job_id: 1, p_token: 'synthetic', p_description: blocked.description,
}))
assert.equal(publicEdit.writes.length, 0, 'same public excluded edit must fail')
const unknownVisibility = legacyGuest(legacyBlocked, false, true)
await assert.rejects(() => checkedGuestJobUpdate(unknownVisibility.client, { p_job_id: 1, p_token: 'synthetic' }))
assert.equal(unknownVisibility.writes.length, 0, 'public SELECT errors fail closed')
const legacyActivation = legacyGuest({ ...legacyBlocked, active: false }, false)
await assert.rejects(() => checkedGuestJobUpdate(legacyActivation.client, {
  p_job_id: 1, p_token: 'synthetic', p_active: true,
}))
assert.equal(legacyActivation.writes.length, 0, 'legacy activation still blocked')
const knownHidden = fake({ ...blocked, active: true, admin_hidden: true })
await checkedGuestJobUpdate(knownHidden.client, { p_job_id: 1, p_token: 'synthetic', p_description: blocked.description })
assert.equal(knownHidden.writes.length, 1, 'future token RPC known hidden edit allowed')
console.log('guest hidden regression: legacy hidden/public, SELECT errors, activation and known-hidden cases passed')
