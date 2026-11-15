// Supabase 서비스 키 진단(읽기 전용, S4 #808 — 2026-11-15 status-report 401 원인 확정용).
// 키 값은 어디에도 출력하지 않는다. 출력: 키 모양(JWT·sb_secret·sb_publishable·기타), 길이, 앞뒤 공백·따옴표·줄바꿈 여부,
// JWT이면 공개 정보인 ref(프로젝트 ID)·role·iss만, 주소의 프로젝트 ID와 같은지, 그리고 읽기 요청 1건의 응답 코드·오류 메시지.
// 요청: GET /rest/v1/local_jobs?select=id&limit=1 (조회 1건, 쓰기 없음) — ① apikey+Authorization 같은 값(지금 코드 방식) ② apikey만.
export function keyShape(raw) {
  const key = String(raw ?? '')
  const t = key.trim()
  const out = {
    length: key.length,
    whitespace_edge: key !== t,
    has_newline: /[\r\n]/.test(key),
    quoted: /^["'].*["']$/.test(t),
    kind: t.startsWith('sb_secret_') ? 'sb_secret' : t.startsWith('sb_publishable_') ? 'sb_publishable' : t.split('.').length === 3 && t.startsWith('eyJ') ? 'jwt' : t ? 'other' : 'empty',
  }
  if (out.kind === 'jwt') {
    try {
      const p = JSON.parse(Buffer.from(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
      out.jwt = { ref: typeof p.ref === 'string' ? p.ref : null, role: typeof p.role === 'string' ? p.role : null, iss: typeof p.iss === 'string' ? p.iss : null }
    } catch { out.jwt = { parse_error: true } }
  }
  return out
}
export const projectRef = (url) => (String(url ?? '').match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/) ?? [])[1] ?? null
// 응답 본문에서 비밀이 아닌 오류 칸만(코드·메시지·힌트), 길이 제한, 키 모양 글자는 가림
export function errorFields(text, key) {
  let j = null
  try { j = JSON.parse(text) } catch { /* 본문이 JSON이 아님 */ }
  const pick = j && typeof j === 'object' ? { code: j.code ?? j.error_code ?? null, message: j.message ?? j.msg ?? j.error ?? null, hint: j.hint ?? null } : { raw: String(text).slice(0, 200) }
  const mask = (s) => (typeof s === 'string' ? s.split(String(key ?? '').trim() || '\u0000').join('[가림]').replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+|sb_(secret|publishable)_[\w-]+/g, '[가림]').slice(0, 300) : s)
  return Object.fromEntries(Object.entries(pick).map(([k, v]) => [k, mask(v)]))
}

if (process.argv[1]?.endsWith('supabase-key-diagnose.mjs')) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  const shape = keyShape(key), ref = projectRef(url)
  console.log('키 모양:', JSON.stringify(shape))
  console.log('주소 프로젝트 ID:', ref, '| JWT 안 프로젝트 ID와 같음:', shape.jwt?.ref ? shape.jwt.ref === ref : '(JWT 아님 — 비교 불가)')
  const k = key.trim()
  for (const [name, headers] of [['apikey+Authorization(같은 값, 지금 코드 방식)', { apikey: k, Authorization: `Bearer ${k}` }], ['apikey만', { apikey: k }]]) {
    try {
      const r = await fetch(`${url.replace(/\/$/, '')}/rest/v1/local_jobs?select=id&limit=1`, { headers })
      const body = await r.text()
      console.log(`요청 ${name}: HTTP ${r.status}`, r.ok ? '(성공)' : JSON.stringify(errorFields(body, key)))
    } catch (e) { console.log(`요청 ${name}: 요청 오류`, String(e?.message ?? e).slice(0, 200)) }
  }
}
