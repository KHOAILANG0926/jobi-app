import { createClient } from '@supabase/supabase-js'

// 관리자 전용 VietMap Search v4 / Place v4 프록시.
// - 키(VIETMAP_SERVICE_KEY)는 Vercel 환경변수에만 있고, 응답·로그·에러 어디에도 내보내지 않는다.
// - 하루 250회 상한(베트남 날짜 기준) — Supabase vietmap_usage_take RPC로 원자적으로 센다.
//   카운터를 쓸 수 없으면(RPC 미적용 등) VietMap을 호출하지 않는다(fail closed).
// - 호출 전에 센다(upstream 실패도 한도에 포함 — 보수적).
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://edhuesdnuxlbcfephutq.supabase.co'
const SEARCH_URL = 'https://maps.vietmap.vn/api/search/v4'
const PLACE_URL = 'https://maps.vietmap.vn/api/place/v4'
export const DAILY_LIMIT = 250
const UPSTREAM_TIMEOUT_MS = 15_000

function bearerToken(req) {
  const value = req.headers?.authorization || req.headers?.Authorization || ''
  return value.startsWith('Bearer ') ? value.slice(7).trim() : ''
}

export function vietnamDay(now = new Date()) {
  return new Date(now.getTime() + 7 * 3600e3).toISOString().slice(0, 10)
}

function runtimeDependencies() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) throw new Error('not_configured')
  const admin = createClient(SUPABASE_URL, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  return {
    vietmapConfigured: () => Boolean(process.env.VIETMAP_SERVICE_KEY),
    async verifyCaller(token) {
      const { data, error } = await admin.auth.getUser(token)
      if (error || !data.user) throw new Error('Invalid access token')
      return data.user
    },
    async takeUsage(day, limit) {
      const { data, error } = await admin.rpc('vietmap_usage_take', { p_day: day, p_limit: limit })
      if (error) throw new Error('usage_counter_unavailable')
      const row = Array.isArray(data) ? data[0] : data
      if (!row || typeof row.ok !== 'boolean') throw new Error('usage_counter_unavailable')
      return { ok: row.ok, used: Number(row.used) }
    },
    async upstream(url, params) {
      const query = new URLSearchParams({ ...params, apikey: process.env.VIETMAP_SERVICE_KEY })
      const res = await fetch(`${url}?${query}`, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) })
      // 본문은 호출자에게 그대로 주지 않는다(에러 본문에 요청 URL·키가 섞일 수 있음).
      if (!res.ok) return { ok: false, status: res.status }
      return { ok: true, status: res.status, json: await res.json() }
    },
  }
}

const REF_ID = /^[A-Za-z0-9._:\-|]{1,200}$/

function validate(body) {
  const action = body?.action
  if (action === 'search') {
    const text = typeof body.text === 'string' ? body.text.trim() : ''
    if (!text || text.length > 200) return null
    const focus = body.focus
    if (focus !== undefined && focus !== null) {
      if (typeof focus.lat !== 'number' || typeof focus.lng !== 'number' ||
          focus.lat < 8 || focus.lat > 24 || focus.lng < 102 || focus.lng > 110) return null
    }
    return { action, text, focus: focus ?? null }
  }
  if (action === 'place') {
    if (typeof body.refId !== 'string' || !REF_ID.test(body.refId)) return null
    return { action, refId: body.refId }
  }
  return null
}

export function createAdminVietmapHandler(injected) {
  return async function adminVietmapHandler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
    const token = bearerToken(req)
    if (!token) return res.status(401).json({ error: 'Authentication required' })
    const request = validate(req.body)
    if (!request) return res.status(400).json({ error: 'Invalid request' })

    let deps
    try {
      deps = injected || runtimeDependencies()
    } catch {
      return res.status(503).json({ error: 'not_configured' })
    }

    try {
      const caller = await deps.verifyCaller(token)
      if (caller?.app_metadata?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })
      if (!deps.vietmapConfigured()) return res.status(503).json({ error: 'not_configured' })

      const usage = await deps.takeUsage(vietnamDay(), DAILY_LIMIT)
      if (!usage.ok) return res.status(429).json({ error: 'daily_limit', used: usage.used, limit: DAILY_LIMIT })

      const upstream = request.action === 'search'
        ? await deps.upstream(SEARCH_URL, {
            text: request.text, display_type: '1', layers: 'POI',
            ...(request.focus ? { focus: `${request.focus.lat},${request.focus.lng}` } : {}),
          })
        : await deps.upstream(PLACE_URL, { refid: request.refId })

      if (!upstream.ok) {
        console.error(`api/admin-vietmap: upstream status ${upstream.status}`)
        return res.status(502).json({ error: 'upstream_error', upstreamStatus: upstream.status, used: usage.used, limit: DAILY_LIMIT })
      }
      return res.status(200).json({ ok: true, used: usage.used, limit: DAILY_LIMIT, data: upstream.json })
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (message === 'Invalid access token') return res.status(401).json({ error: message })
      if (message === 'usage_counter_unavailable' || message === 'not_configured') return res.status(503).json({ error: message })
      console.error('api/admin-vietmap: failed', error instanceof Error ? error.name : 'error')
      return res.status(500).json({ error: 'Operation failed' })
    }
  }
}

export default createAdminVietmapHandler()
