import { createClient } from '@supabase/supabase-js'

// 공개 읽기 전용: xã/phường 한 곳의 "동네 지도" 중심 좌표.
// 좌표는 관리자가 서버 API로 한 번 찾아 비공개 저장소(research_artifacts)에 캐시해 둔 값이다.
// 이 엔드포인트는 요청한 key 하나의 좌표만 돌려주고, VietMap을 부르지 않으며(하루 한도를 쓰지 않음) 저장소를 바꾸지 않는다.
// 비공개 저장소는 anon/authenticated가 못 읽으므로 서비스 롤로 읽는다. 키는 응답·로그에 내보내지 않는다.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://edhuesdnuxlbcfephutq.supabase.co'
const CACHE_KIND = 'autolocate'
const CACHE_NAME = 'ward_centers'
// src/lib/wardArea.ts의 WARD_KEY_PATTERN과 같은 형식.
const KEY_PATTERN = /^(xa|phuong|thi tran):[a-z0-9 ]{1,60}\|[a-z0-9 ]{1,60}\|[a-z0-9 ]{1,60}$/

function runtimeDependencies() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) throw new Error('not_configured')
  const admin = createClient(SUPABASE_URL, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  return {
    async readCache() {
      const { data, error } = await admin.from('research_artifacts').select('payload').eq('kind', CACHE_KIND).eq('name', CACHE_NAME).maybeSingle()
      if (error) throw new Error('cache_unavailable')
      return data?.payload ?? null
    },
  }
}

const inVietnam = (lat, lng) => typeof lat === 'number' && typeof lng === 'number' && lat >= 8 && lat <= 24 && lng >= 102 && lng <= 110

export function createWardAreaHandler(injected) {
  return async function wardAreaHandler(req, res) {
    if (req.method !== 'GET') { res.setHeader('Cache-Control', 'no-store'); return res.status(405).json({ error: 'Method not allowed' }) }
    const raw = req.query?.key
    const key = typeof raw === 'string' ? raw : ''
    if (!KEY_PATTERN.test(key)) { res.setHeader('Cache-Control', 'no-store'); return res.status(400).json({ error: 'Invalid request' }) }

    let deps
    try {
      deps = injected || runtimeDependencies()
    } catch {
      res.setHeader('Cache-Control', 'no-store')
      return res.status(503).json({ error: 'not_configured' })
    }

    try {
      const cache = await deps.readCache()
      const entry = cache && typeof cache === 'object' && Object.prototype.hasOwnProperty.call(cache, key) ? cache[key] : null
      if (entry && entry.status === 'found' && inVietnam(entry.lat, entry.lng)) {
        res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
        return res.status(200).json({ found: true, lat: entry.lat, lng: entry.lng })
      }
      res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600')
      return res.status(200).json({ found: false })
    } catch {
      res.setHeader('Cache-Control', 'no-store')
      console.error('api/ward-area: failed')
      return res.status(503).json({ error: 'cache_unavailable' })
    }
  }
}

export default createWardAreaHandler()
