import { createClient } from '@supabase/supabase-js'

// 관리자 전용 "주소 → 좌표" 시험 프록시 (2026-10-13 사용자 지시: 가게 기준 말고 주소 기준).
// VietMap 검색은 이 지역에서 가게(POI)만 돌려줘 번지 주소 자체를 찾지 못하는 것이 확인됐다.
// 주소 자체를 돌려주는 지오코더(TomTom, Goong)를 같은 주소로 비교하기 위한 읽기 전용 기능이다.
// - 키(TOMTOM_API_KEY, GOONG_API_KEY)는 Vercel 서버 환경변수에만 둔다. 응답·로그·에러에 내보내지 않는다.
// - DB를 쓰지 않고 핀을 만들지 않는다. 결과를 정리해 돌려주기만 한다.
// - 관리자(app_metadata.role === 'admin')만 호출할 수 있다.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://edhuesdnuxlbcfephutq.supabase.co'
const UPSTREAM_TIMEOUT_MS = 15_000
const PROVIDERS = ['tomtom', 'goong']

function bearerToken(req) {
  const value = req.headers?.authorization || req.headers?.Authorization || ''
  return value.startsWith('Bearer ') ? value.slice(7).trim() : ''
}

export function validate(body) {
  const provider = body?.provider
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (!PROVIDERS.includes(provider) || !text || text.length > 200) return null
  return { provider, text }
}

export function upstreamUrl(provider, text, key) {
  if (provider === 'tomtom') {
    const q = new URLSearchParams({ key, countrySet: 'VN', language: 'vi-VN', limit: '5' })
    return `https://api.tomtom.com/search/2/geocode/${encodeURIComponent(text)}.json?${q}`
  }
  const q = new URLSearchParams({ address: text, api_key: key })
  return `https://rsapi.goong.io/v2/geocode?${q}`
}

// 공급자마다 다른 응답을 같은 모양으로 정리한다(필요한 칸만).
export function normalize(provider, json) {
  if (provider === 'tomtom') {
    return (json?.results ?? []).map((r) => ({
      address: r.address?.freeformAddress ?? '',
      houseNumber: r.address?.streetNumber ?? '',
      street: r.address?.streetName ?? '',
      ward: r.address?.municipalitySubdivision ?? '',
      type: r.type ?? '',
      lat: r.position?.lat, lng: r.position?.lon,
    }))
  }
  return (json?.results ?? []).map((r) => ({
    address: r.formatted_address ?? '',
    houseNumber: '',
    street: '',
    ward: (r.compound?.commune ?? ''),
    type: (r.types ?? []).join(','),
    lat: r.geometry?.location?.lat, lng: r.geometry?.location?.lng,
  }))
}

function runtimeDependencies() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) throw new Error('not_configured')
  const admin = createClient(SUPABASE_URL, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  return {
    key: (provider) => (provider === 'tomtom' ? process.env.TOMTOM_API_KEY : process.env.GOONG_API_KEY) || '',
    async verifyCaller(token) {
      const { data, error } = await admin.auth.getUser(token)
      if (error || !data.user) throw new Error('Invalid access token')
      return data.user
    },
    async fetchJson(url) {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS)
      try {
        const res = await fetch(url, { signal: ctrl.signal })
        if (!res.ok) return { ok: false, status: res.status }
        return { ok: true, json: await res.json() }
      } finally {
        clearTimeout(timer)
      }
    },
  }
}

export function createAdminGeocodeHandler(injected) {
  return async function adminGeocodeHandler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
    const token = bearerToken(req)
    if (!token) return res.status(401).json({ error: 'Authentication required' })
    const request = validate(req.body)
    if (!request) return res.status(400).json({ error: 'Invalid request' })
    try {
      const deps = injected || runtimeDependencies()
      const caller = await deps.verifyCaller(token)
      if (caller?.app_metadata?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })
      const key = deps.key(request.provider)
      if (!key) return res.status(503).json({ error: 'not_configured', provider: request.provider })
      const up = await deps.fetchJson(upstreamUrl(request.provider, request.text, key))
      if (!up.ok) return res.status(502).json({ error: 'upstream_error', upstreamStatus: up.status })
      return res.status(200).json({ ok: true, provider: request.provider, results: normalize(request.provider, up.json) })
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (message === 'Invalid access token') return res.status(401).json({ error: message })
      if (message === 'not_configured') return res.status(503).json({ error: message })
      console.error('api/admin-geocode: failed', error instanceof Error ? error.name : 'error')
      return res.status(500).json({ error: 'Operation failed' })
    }
  }
}

export default createAdminGeocodeHandler()
