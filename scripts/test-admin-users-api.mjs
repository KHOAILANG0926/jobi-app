import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createAdminUsersHandler, toAdminMemberDetails } from '../api/admin-users.js'

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
  }
}

function request(body, token = 'caller-token') {
  return { method: 'POST', headers: { authorization: `Bearer ${token}` }, body }
}

const calls = []
const deps = {
  async verifyCaller(token) {
    calls.push(['verify', token])
    return token === 'admin-token' ? { id: 'admin-id', app_metadata: { role: 'admin' } } : { id: 'user-id', app_metadata: { role: 'seeker' } }
  },
  async banUser(userId, suspended) { calls.push(['ban', userId, suspended]) },
  async setDatabaseStatus(userId, status, reason) { calls.push(['db', userId, status, reason]) },
}
const handler = createAdminUsersHandler(deps)

{
  const res = response()
  await handler({ method: 'POST', headers: {}, body: {} }, res)
  assert.equal(res.statusCode, 401)
}
{
  const res = response()
  await handler(request({ userId: 'target', status: 'suspended' }), res)
  assert.equal(res.statusCode, 403)
}
{
  const res = response()
  await handler(request({ userId: '', status: 'disabled' }, 'admin-token'), res)
  assert.equal(res.statusCode, 400)
}
{
  calls.length = 0
  const res = response()
  await handler(request({ userId: 'target', status: 'suspended', reason: 'abuse' }, 'admin-token'), res)
  assert.equal(res.statusCode, 200)
  assert.deepEqual(calls, [
    ['verify', 'admin-token'],
    ['ban', 'target', true],
    ['db', 'target', 'suspended', 'abuse'],
  ])
}
{
  calls.length = 0
  const res = response()
  await handler(request({ userId: 'target', status: 'active', reason: '' }, 'admin-token'), res)
  assert.equal(res.statusCode, 200)
  assert.deepEqual(calls, [
    ['verify', 'admin-token'],
    ['ban', 'target', false],
    ['db', 'target', 'active', ''],
  ])
}

console.log('Admin users API authorization contract passed')

{
  const auth = { id:'a1', email:'signup@example.com', user_metadata: { name:'회원가입 실명' }, last_sign_in_at:'2026-10-24T00:00:00Z' }
  const fromSignup = toAdminMemberDetails(auth, { full_name:'', email:'', phone:null })
  assert.equal(fromSignup.full_name, '회원가입 실명')
  assert.equal(fromSignup.email, 'signup@example.com')
  assert.equal(fromSignup.last_sign_in_at, auth.last_sign_in_at)
  assert.equal(toAdminMemberDetails(auth, {full_name:' 프로필 이름 '}).full_name, '프로필 이름')
  assert.equal(toAdminMemberDetails({...auth,user_metadata:{full_name:'OAuth 이름'}},null).full_name,'OAuth 이름')
  assert.equal(toAdminMemberDetails({...auth,user_metadata:{}},null).full_name,null)
}
console.log('Admin member signup-name fallback contract passed')

const memberSql = await readFile(new URL('../supabase/migrations/20261024_admin_user_details.sql', import.meta.url), 'utf8')
assert.match(memberSql, /perform public\.require_admin\(\)/i)
assert.match(memberSql, /raw_user_meta_data->>'name'/i)
assert.match(memberSql, /revoke all on function public\.admin_user_details\(\)/i)
assert.match(memberSql, /grant execute on function public\.admin_user_details\(\) to authenticated/i)
console.log('Admin-only member metadata access contract passed')
