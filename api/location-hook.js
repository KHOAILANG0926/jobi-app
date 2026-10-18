import { createClient } from '@supabase/supabase-js'
import { runLocationJob, vietmapRequest } from './_lib/auto-location-runtime.mjs'

// 공고 저장 즉시 위치 찾기(2026-10-18 Lee 지시). DB(pg_net)가 공고 저장 직후 부른다.
// - VietMap 키는 Vercel 환경변수에만 있다. 요청이 DB에서 온 것인지 출입증(DB Vault 보관)을 DB에 물어 확인한다(Vercel에 따로 둘 비밀 없음).
// - 하루 250번·공고당 2번·같은 주소 재호출 없음은 DB 함수가 지킨다. 키·주소·응답 본문은 로그에 쓰지 않는다.
export const config = { maxDuration: 60 }
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://edhuesdnuxlbcfephutq.supabase.co'

function runtime() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY, vietmap = process.env.VIETMAP_SERVICE_KEY
  if (!key || !vietmap) throw new Error('not_configured')
  const db = createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return {
    async tokenOk(token) { const { data, error } = await db.rpc('map_r1_hook_token_ok', { p_token: token }); if (error) throw new Error('unavailable'); return data === true },
    run: (jobId) => runLocationJob(db, vietmapRequest(vietmap), jobId),
  }
}

export function createLocationHookHandler(injected) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
    const token = String(req.headers?.authorization || '').replace(/^Bearer /, '')
    let body = req.body
    if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = null } }
    const jobId = Number(body?.job_id)
    if (!token || !Number.isSafeInteger(jobId) || jobId <= 0) return res.status(400).json({ error: 'invalid_request' })
    let deps
    try { deps = injected || runtime() } catch { return res.status(503).json({ error: 'not_configured' }) }
    try {
      if (!(await deps.tokenOk(token))) return res.status(401).json({ error: 'unauthorized' })
      return res.status(200).json(await deps.run(jobId))
    } catch {
      console.error('api/location-hook: failed')
      return res.status(503).json({ error: 'location_service_unavailable' })
    }
  }
}
export default createLocationHookHandler()
