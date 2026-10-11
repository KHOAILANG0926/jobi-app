// api/status-recheck.js 회귀 테스트: GitHub OIDC 검증과 재확인 흐름(네트워크·DB·VietMap 없음, 전부 가짜 응답).
import { generateKeyPairSync, createSign } from 'node:crypto'
import { verifyGithubOidc, createStatusRecheckHandler, AUDIENCE, ALLOWED } from './status-recheck.js'

function assert(cond: unknown, msg: string) { if (!cond) throw new Error(`FAIL: ${msg}`) }

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const other = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' }
const fetchJwks = async () => ({ keys: [jwk] })
const NOW = 1_760_000_000_000
const now = () => NOW
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')

function token(claims: Record<string, unknown>, opts: { kid?: string; key?: typeof privateKey } = {}) {
  const head = b64({ alg: 'RS256', kid: opts.kid ?? 'k1', typ: 'JWT' })
  const body = b64(claims)
  const sig = createSign('RSA-SHA256').update(`${head}.${body}`).sign(opts.key ?? privateKey).toString('base64url')
  return `${head}.${body}.${sig}`
}
const good = {
  iss: 'https://token.actions.githubusercontent.com', aud: AUDIENCE, exp: NOW / 1000 + 300, nbf: NOW / 1000 - 10,
  repository: ALLOWED.repository, ref: ALLOWED.ref, job_workflow_ref: `${ALLOWED.workflowPrefix}refs/heads/master`,
}
async function rejects(t: string, reason: string, label: string) {
  try { await verifyGithubOidc(t, { fetchJwks, now }); assert(false, `${label} should be rejected`) }
  catch (e) { assert((e as Error).message === reason, `${label}: expected ${reason}, got ${(e as Error).message}`) }
}

assert((await verifyGithubOidc(token(good), { fetchJwks, now })).repository === ALLOWED.repository, 'valid STATUS token accepted')
await rejects(token(good, { key: other.privateKey }), 'bad_signature', 'token signed by another key')
await rejects(token(good, { kid: 'zz' }), 'unknown_key', 'unknown kid')
await rejects(token({ ...good, aud: 'other' }), 'bad_audience', 'other audience')
await rejects(token({ ...good, repository: 'someone/fork' }), 'bad_repository', 'fork repository')
await rejects(token({ ...good, ref: 'refs/heads/feature' }), 'bad_ref', 'non-master branch')
await rejects(token({ ...good, job_workflow_ref: 'KHOAILANG0926/jobi-app/.github/workflows/crawl.yml@refs/heads/master' }), 'bad_workflow', 'another workflow')
await rejects(token({ ...good, exp: NOW / 1000 - 600 }), 'expired', 'expired token')
await rejects(token({ ...good, iss: 'https://evil.example' }), 'bad_issuer', 'wrong issuer')
await rejects('abc', 'malformed_token', 'garbage')

function res() {
  const r: { code?: number; body?: any; headers: Record<string, string>; status(c: number): any; json(b: unknown): any; setHeader(k: string, v: string): void } = {
    headers: {}, status(c) { r.code = c; return r }, json(b) { r.body = b; return r }, setHeader(k, v) { r.headers[k] = v },
  }
  return r
}
let placeCalls = 0
const deps = {
  configured: true, fetchJwks, now,
  readApproved: async () => [
    { job_id: 4713, lat: 21.1719011, lng: 106.061922, evidence: 'Tìm theo địa chỉ chi tiết trên VietMap: x\nVietMap ref: geocode:AAA' },
    { job_id: 9999, lat: 21.2, lng: 106.0, evidence: 'Chọn thủ công trên bản đồ' },
  ],
  place: async (ref: string) => { placeCalls++; return ref === 'geocode:AAA' ? { lat: 21.17191, lng: 106.06193 } : { error: 'x' } },
}
const handler = createStatusRecheckHandler(deps)

const r1 = res(); await handler({ method: 'POST', headers: {} }, r1)
assert(r1.code === 401 && placeCalls === 0, 'no token → 401, no VietMap call')
const r2 = res(); await handler({ method: 'POST', headers: { authorization: `Bearer ${token({ ...good, repository: 'x/y' })}` } }, r2)
assert(r2.code === 403 && placeCalls === 0, 'foreign token → 403, no VietMap call')
const r3 = res(); await handler({ method: 'GET', headers: {} }, r3)
assert(r3.code === 405, 'GET not allowed')
const r4 = res(); await handler({ method: 'POST', headers: { authorization: `Bearer ${token(good)}` } }, r4)
assert(r4.code === 200 && r4.body.calls === 1 && placeCalls === 1, 'valid token → one VietMap lookup per ref')
assert(r4.body.results[0].state === 'ok' && r4.body.results[0].fetched.lat === 21.17191, 'stored and fetched coordinates returned')
assert(r4.body.results[1].state === 'no_ref', 'evidence without ref → no_ref (no call)')
assert(r4.headers['Cache-Control'] === 'no-store', 'never cached')
assert(!JSON.stringify(r4.body).includes('apikey'), 'no key in response')
const r5 = res(); await createStatusRecheckHandler({ ...deps, configured: false })({ method: 'POST', headers: {} }, r5)
assert(r5.code === 503, 'server without keys → 503')

console.log('status-recheck tests: all assertions passed')
