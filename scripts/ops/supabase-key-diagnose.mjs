// Supabase 서비스 키 진단(읽기 전용, S4 #808 — 2026-11-15 status-report 401 원인 확정용).
// 출력은 정해진 값만 한다(Lee 2026-11-15 19:34): 키 값·JWT 원문 칸(ref·role·iss)·응답 원문·예외 메시지는 어떤 경우에도 출력하지 않는다.
//   키: 모양 분류(jwt·sb_secret·sb_publishable·other·empty), 앞뒤 공백·줄바꿈·따옴표 여부(참/거짓)
//   JWT이면: 주소의 프로젝트와 같은지(참/거짓), service_role인지(참/거짓)
//   요청(GET /rest/v1/local_jobs?select=id&limit=1, 쓰기 없음): HTTP 숫자 + 허용 목록 오류 코드(없으면 null) + 미리 정한 분류(ERROR_CLASSES 중 하나)
export const ERROR_CLASSES = ['ok', 'invalid_api_key', 'unregistered_api_key', 'legacy_keys_disabled', 'invalid_jwt', 'jwt_expired', 'permission_denied', 'not_found', 'server_error', 'network_error', 'unknown']
export const ALLOWED_CODES = ['PGRST301', 'PGRST302', 'PGRST303', '42501', 'PGRST205', '401', '403']

export function keyShape(raw) {
  const key = String(raw ?? ''), t = key.trim()
  return {
    kind: t.startsWith('sb_secret_') ? 'sb_secret' : t.startsWith('sb_publishable_') ? 'sb_publishable' : t.split('.').length === 3 && t.startsWith('eyJ') ? 'jwt' : t ? 'other' : 'empty',
    whitespace_edge: key !== t,
    has_newline: /[\r\n]/.test(key),
    quoted: /^["'].*["']$/.test(t),
  }
}
export const projectRef = (url) => (String(url ?? '').match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/) ?? [])[1] ?? null
// JWT 공개 칸을 읽되 원문은 돌려주지 않고 비교 결과(참/거짓)만
export function jwtChecks(raw, url) {
  const t = String(raw ?? '').trim()
  if (keyShape(t).kind !== 'jwt') return null
  try {
    const p = JSON.parse(Buffer.from(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
    const ref = projectRef(url)
    return { parse_ok: true, project_match: !!ref && p.ref === ref, role_is_service: p.role === 'service_role' }
  } catch { return { parse_ok: false, project_match: false, role_is_service: false } }
}
// 응답을 미리 정한 분류로만 바꾼다. 원문·메시지는 돌려주지 않는다.
export function classify(status, bodyText) {
  if (status >= 200 && status < 300) return { cls: 'ok', code: null }
  let j = null
  try { j = JSON.parse(bodyText) } catch { /* 원문은 쓰지 않음 */ }
  const rawCode = j && typeof j === 'object' ? String(j.code ?? j.error_code ?? '') : ''
  const code = ALLOWED_CODES.includes(rawCode) ? rawCode : null
  const msg = j && typeof j === 'object' ? String(j.message ?? j.msg ?? j.error ?? '') : ''
  let cls = 'unknown'
  if (/unregistered api key/i.test(msg)) cls = 'unregistered_api_key'
  else if (/legacy api keys are disabled/i.test(msg)) cls = 'legacy_keys_disabled'
  else if (/invalid api key/i.test(msg)) cls = 'invalid_api_key'
  else if (/jwt expired/i.test(msg) || rawCode === 'PGRST303') cls = 'jwt_expired'
  else if (/jwt|jws/i.test(msg) || rawCode === 'PGRST301' || rawCode === 'PGRST302') cls = 'invalid_jwt'
  else if (status === 403 || rawCode === '42501') cls = 'permission_denied'
  else if (status === 404 || rawCode === 'PGRST205') cls = 'not_found'
  else if (status >= 500) cls = 'server_error'
  return { cls, code }
}
export async function probe(url, key, fetchImpl = fetch) {
  const k = String(key ?? '').trim()
  const lines = []
  for (const [name, headers] of [['both_headers', { apikey: k, Authorization: `Bearer ${k}` }], ['apikey_only', { apikey: k }]]) {
    try {
      const r = await fetchImpl(`${String(url).replace(/\/$/, '')}/rest/v1/local_jobs?select=id&limit=1`, { headers })
      const { cls, code } = classify(r.status, await r.text())
      lines.push({ request: name, http: Number(r.status) || 0, code, class: cls })
    } catch { lines.push({ request: name, http: 0, code: null, class: 'network_error' }) }
  }
  return lines
}
// 출력 직전 마지막 확인: 정해진 칸·값만 남기고, 혹시 키가 섞이면 그 줄을 통째로 버린다
export function safeLine(obj, key) {
  const allowed = { kind: ['jwt', 'sb_secret', 'sb_publishable', 'other', 'empty'], class: ERROR_CLASSES, request: ['both_headers', 'apikey_only'] }
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'boolean' || v === null) out[k] = v
    else if (k === 'http' && Number.isInteger(v)) out[k] = v
    else if (k === 'code' && ALLOWED_CODES.includes(v)) out[k] = v
    else if (allowed[k]?.includes(v)) out[k] = v
    else out[k] = '(허용 밖 — 출력 안 함)'
  }
  const s = JSON.stringify(out), k = String(key ?? '').trim()
  return k && s.includes(k) ? '{"error":"출력 차단"}' : s
}

if (process.argv[1]?.endsWith('supabase-key-diagnose.mjs')) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  try {
    console.log('키 모양:', safeLine(keyShape(key), key))
    const j = jwtChecks(key, url)
    console.log('JWT 확인:', j ? safeLine(j, key) : '(JWT 아님 — 해당 없음)')
    for (const l of await probe(url, key)) console.log('요청:', safeLine(l, key))
  } catch { console.log('진단 실패(세부 내용은 출력하지 않음)'); process.exitCode = 1 }
}
