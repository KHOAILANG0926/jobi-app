import assert from 'node:assert/strict'
import { createAdminUsersHandler } from '../api/admin-users.js'

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
