import assert from 'node:assert/strict'
import { keyShape, projectRef, errorFields } from './supabase-key-diagnose.mjs'
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const jwt = `eyJhbGciOiJIUzI1NiJ9.${b64({ iss: 'supabase', ref: 'abc123', role: 'service_role' })}.sig`
assert.deepEqual(keyShape(jwt).jwt, { ref: 'abc123', role: 'service_role', iss: 'supabase' })
assert.equal(keyShape(jwt).kind, 'jwt')
assert.equal(keyShape('sb_secret_xxxxxxxx').kind, 'sb_secret')
assert.equal(keyShape(` ${jwt}\n`).whitespace_edge, true)
assert.equal(keyShape(` ${jwt}\n`).has_newline, true)
assert.equal(keyShape(`"${jwt}"`).quoted, true)
assert.equal(keyShape('').kind, 'empty')
assert.equal(projectRef('https://edhuesdnuxlbcfephutq.supabase.co'), 'edhuesdnuxlbcfephutq')
// 출력에 키 값이 절대 나오지 않음
const s = JSON.stringify(keyShape(jwt)); assert.ok(!s.includes('sig') && !s.includes(jwt))
const e = errorFields(JSON.stringify({ message: `Invalid API key ${jwt}`, hint: 'sb_secret_abcdefgh leaked?' }), jwt)
assert.ok(!JSON.stringify(e).includes(jwt) && !JSON.stringify(e).includes('sb_secret_abcdefgh'), '응답 본문 속 키 모양 글자도 가림')
assert.equal(errorFields('<html>bad', jwt).raw, '<html>bad')
console.log('supabase-key-diagnose: 통과(키 값 출력 없음)')
