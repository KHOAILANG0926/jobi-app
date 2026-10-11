// STATUS 전용 VietMap 재확인 창구 (2026-10-11 사용자 결정 A안).
// GitHub Actions의 STATUS 실행(.github/workflows/status-report.yml, master)만 호출할 수 있다.
// 호출자는 GitHub OIDC 토큰으로 확인한다 — GitHub이 서명한 토큰이라 새 키를 따로 등록할 필요가 없다.
//
// 하는 일: 승인된 근무지 핀마다 근거에 적힌 VietMap ref로 VietMap Place를 다시 조회해,
//          받은 좌표와 DB에 저장된 핀 좌표를 함께 돌려준다(판정은 STATUS 쪽 judgeRecheck).
// 하지 않는 일: DB 쓰기 없음. 키·토큰을 응답·로그에 내보내지 않음. 최대 MAX_LOOKUPS회만 조회.
import { createPublicKey, createVerify } from 'node:crypto'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://edhuesdnuxlbcfephutq.supabase.co'
const PLACE_URL = 'https://maps.vietmap.vn/api/place/v4'
const ISSUER = 'https://token.actions.githubusercontent.com'
export const AUDIENCE = 'viecganban-status'
export const ALLOWED = {
  repository: 'KHOAILANG0926/jobi-app',
  ref: 'refs/heads/master',
  workflowPrefix: 'KHOAILANG0926/jobi-app/.github/workflows/status-report.yml@',
}
export const MAX_LOOKUPS = 20

const b64url = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')

/** GitHub OIDC 토큰 검증. 성공하면 claims, 실패하면 이유 문자열을 던진다. */
export async function verifyGithubOidc(token, { fetchJwks, now = () => Date.now() }) {
  const parts = String(token ?? '').split('.')
  if (parts.length !== 3) throw new Error('malformed_token')
  let header, claims
  try {
    header = JSON.parse(b64url(parts[0]).toString('utf8'))
    claims = JSON.parse(b64url(parts[1]).toString('utf8'))
  } catch { throw new Error('malformed_token') }
  if (header.alg !== 'RS256' || !header.kid) throw new Error('bad_alg')
  const jwks = await fetchJwks()
  const jwk = (jwks?.keys ?? []).find((k) => k.kid === header.kid)
  if (!jwk) throw new Error('unknown_key')
  const ok = createVerify('RSA-SHA256').update(`${parts[0]}.${parts[1]}`).verify(createPublicKey({ key: jwk, format: 'jwk' }), b64url(parts[2]))
  if (!ok) throw new Error('bad_signature')
  const t = Math.floor(now() / 1000)
  if (claims.iss !== ISSUER) throw new Error('bad_issuer')
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
  if (!aud.includes(AUDIENCE)) throw new Error('bad_audience')
  if (typeof claims.exp !== 'number' || claims.exp < t - 30) throw new Error('expired')
  if (typeof claims.nbf === 'number' && claims.nbf > t + 30) throw new Error('not_yet_valid')
  if (claims.repository !== ALLOWED.repository) throw new Error('bad_repository')
  if (claims.ref !== ALLOWED.ref) throw new Error('bad_ref')
  if (!String(claims.job_workflow_ref ?? '').startsWith(ALLOWED.workflowPrefix)) throw new Error('bad_workflow')
  return claims
}

export function extractRef(evidence) {
  const m = String(evidence ?? '').match(/VietMap ref:\s*(\S+)/)
  return m ? m[1] : null
}

function runtimeDependencies() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const vietmapKey = process.env.VIETMAP_SERVICE_KEY
  return {
    configured: Boolean(serviceKey && vietmapKey),
    fetchJwks: async () => (await fetch(`${ISSUER}/.well-known/jwks`)).json(),
    async readApproved() {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/job_location_candidates?select=job_id,lat,lng,evidence&status=eq.approved&order=reviewed_at.asc`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      })
      if (!r.ok) throw new Error('db_unavailable')
      return r.json()
    },
    async place(refId) {
      const q = new URLSearchParams({ apikey: vietmapKey, refid: refId })
      const r = await fetch(`${PLACE_URL}?${q}`)
      if (!r.ok) return { error: `HTTP ${r.status}` }
      const p = await r.json()
      return typeof p?.lat === 'number' && typeof p?.lng === 'number' ? { lat: p.lat, lng: p.lng } : { error: '응답에 좌표 없음' }
    },
  }
}

export function createStatusRecheckHandler(injected) {
  return async function statusRecheckHandler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
    const deps = injected ?? runtimeDependencies()
    if (!deps.configured) return res.status(503).json({ error: 'not_configured' })
    const auth = String(req.headers?.authorization ?? '')
    if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'missing_token' })
    try {
      await verifyGithubOidc(auth.slice(7), { fetchJwks: deps.fetchJwks, now: deps.now })
    } catch (e) {
      return res.status(403).json({ error: e.message })
    }
    let rows
    try { rows = await deps.readApproved() } catch { return res.status(502).json({ error: 'db_unavailable' }) }
    const results = []
    let calls = 0
    for (const row of rows) {
      const ref = extractRef(row.evidence)
      const stored = { lat: row.lat, lng: row.lng }
      if (!ref) { results.push({ jobId: row.job_id, state: 'no_ref' }); continue }
      if (calls >= MAX_LOOKUPS) { results.push({ jobId: row.job_id, state: 'skipped' }); continue }
      calls++
      try {
        const p = await deps.place(ref)
        results.push(p.error ? { jobId: row.job_id, state: 'error', error: p.error } : { jobId: row.job_id, state: 'ok', stored, fetched: p })
      } catch {
        results.push({ jobId: row.job_id, state: 'error', error: '연결 실패' })
      }
    }
    return res.status(200).json({ calls, results })
  }
}

export default createStatusRecheckHandler()
