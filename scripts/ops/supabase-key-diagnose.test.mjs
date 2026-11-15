// 진단 출력에 키·인증 정보·응답 원문·JWT 원문 칸이 나오지 않는지(Lee 2026-11-15 19:34 조건 ①②③)
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { keyShape, jwtChecks, classify, safeLine, ERROR_CLASSES } from './supabase-key-diagnose.mjs'

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const REF = 'edhuesdnuxlbcfephutq', URL0 = `https://${REF}.supabase.co`
const jwt = (o) => `eyJhbGciOiJIUzI1NiJ9.${b64(o)}.SIGNATUREpart123`
const svc = jwt({ iss: 'supabase', ref: REF, role: 'service_role' })

// ① JWT 원문 칸 대신 일치 여부만
assert.deepEqual(jwtChecks(svc, URL0), { parse_ok: true, project_match: true, role_is_service: true })
assert.deepEqual(jwtChecks(jwt({ ref: 'otherproj', role: 'anon' }), URL0), { parse_ok: true, project_match: false, role_is_service: false })
assert.equal(jwtChecks('sb_secret_abc', URL0), null)
for (const v of [JSON.stringify(jwtChecks(svc, URL0)), safeLine(jwtChecks(svc, URL0), svc)]) {
  assert.ok(!v.includes(REF) && !v.includes('service_role') && !v.includes('supabase'), 'ref·role·iss 원문 없음')
}
// ② 응답 원문 대신 정해진 분류·허용 코드만
assert.deepEqual(classify(401, JSON.stringify({ message: 'Invalid API key', hint: 'Double check' })), { cls: 'invalid_api_key', code: null })
assert.deepEqual(classify(401, JSON.stringify({ code: 'PGRST301', message: 'JWSError JWSInvalidSignature' })), { cls: 'invalid_jwt', code: 'PGRST301' })
assert.deepEqual(classify(401, JSON.stringify({ message: 'Unregistered API key' })), { cls: 'unregistered_api_key', code: null })
assert.deepEqual(classify(401, JSON.stringify({ message: 'Legacy API keys are disabled' })), { cls: 'legacy_keys_disabled', code: null })
assert.deepEqual(classify(401, JSON.stringify({ code: `LEAK-${svc}`, message: 'weird' })), { cls: 'unknown', code: null }, '허용 밖 코드는 버림')
assert.deepEqual(classify(500, '<html>' + svc), { cls: 'server_error', code: null })
assert.deepEqual(classify(200, ''), { cls: 'ok', code: null })
// 출력 직전 확인: 허용 밖 값·키가 섞인 줄은 버림
assert.ok(!safeLine({ class: `x${svc}`, http: 401 }, svc).includes(svc))
assert.equal(safeLine({ kind: 'jwt', note: svc }, svc).includes(svc), false)
assert.ok(ERROR_CLASSES.includes('unknown'))
assert.deepEqual(keyShape(`"${svc}"\n`), { kind: 'other', whitespace_edge: true, has_newline: true, quoted: true }, '따옴표로 감싼 키는 other + quoted')

// ③ 실제 스크립트 실행: 가짜 서버가 키·인증 헤더를 되돌려 보내거나 예상 못 한 응답·연결 끊김을 보내도 출력에 키·인증 정보·원문이 없음
const script = fileURLToPath(new URL('./supabase-key-diagnose.mjs', import.meta.url))
const hostile = [
  (req, res) => { res.writeHead(401, { 'content-type': 'application/json' }); res.end(JSON.stringify({ message: `Invalid API key ${req.headers.apikey}`, hint: req.headers.authorization, code: req.headers.apikey })) },
  (req, res) => { res.writeHead(418); res.end(`teapot ${req.headers.authorization} ${req.headers.apikey}`) },
  (req, res) => { res.writeHead(500, { 'content-type': 'text/html' }); res.end(`<pre>${JSON.stringify(req.headers)}</pre>`) },
  (req, res) => { res.writeHead(200); res.end(JSON.stringify([{ id: 1, echo: req.headers.apikey }])) },
  (req) => { req.socket.destroy() },
]
for (const [i, handler] of hostile.entries()) {
  for (const key of [svc, 'sb_secret_REALLOOKINGSECRET_123456', `  ${svc}\n`]) {
    const srv = createServer(handler); await new Promise((r) => srv.listen(0, '127.0.0.1', r))
    const url = `http://127.0.0.1:${srv.address().port}`
    const out = await new Promise((resolve) => {
      const c = spawn(process.execPath, [script], { env: { PATH: process.env.PATH, SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } })
      let s = ''; c.stdout.on('data', (d) => (s += d)); c.stderr.on('data', (d) => (s += d)); c.on('close', () => resolve(s))
    })
    srv.close()
    const k = key.trim()
    assert.ok(!out.includes(k), `사례 ${i}: 키 값 없음`)
    assert.ok(!/Bearer|eyJ[\w-]+\.|sb_secret_|SIGNATURE|teapot|<pre>|Invalid API key|authorization|apikey"/i.test(out.replace(/both_headers|apikey_only/g, '')), `사례 ${i}: 인증 정보·응답 원문 없음\n${out}`)
    assert.ok(!out.includes(REF) && !out.includes('service_role'), `사례 ${i}: JWT 원문 칸 없음`)
    for (const line of out.split('\n').filter((l) => l.startsWith('요청:'))) {
      const o = JSON.parse(line.slice('요청:'.length).trim())
      assert.ok(ERROR_CLASSES.includes(o.class) && Number.isInteger(o.http), `사례 ${i}: 정해진 칸만 ${line}`)
    }
  }
}
console.log('supabase-key-diagnose: 통과(키·인증 정보·응답 원문·JWT 원문 칸 출력 없음, 적대적 응답 5종 × 키 3종)')
