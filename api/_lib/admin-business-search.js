// 관리자 전용 "업체 검색 비교" (Lee 2026-10-28). 주소가 아니라 업체명 + 원문 거리·시로 장소를 찾는다.
// - VietMap 업체 검색(search/v4 POI → place/v4)과 Goong 장소 검색(Place AutoComplete → Place Detail)을 같은 질문으로 비교.
// - 키(VIETMAP_SERVICE_KEY, GOONG_API_KEY)는 Vercel 서버 환경변수만 쓴다. 키·URL·공급자 원문 응답은 응답·로그에 내보내지 않는다.
// - DB를 쓰지 않고 핀을 만들지 않는다. 검색은 후보 이름·id 목록만, 상세는 정리된 좌표·주소만 돌려준다.
//   이름 정확 일치 판정은 호출하는 쪽(scripts/ops/business-search-compare.mjs)이 한다.
// - src/의 .ts를 import하지 않는다: Vercel에서 api/admin.js 전체가 시작부터 실패한다(api/location-hook.js 주석, 2026-10-28 재발).
// - 관리자 확인은 api/admin.js 라우터가 먼저 한다(app_metadata.role === 'admin').

const UPSTREAM_TIMEOUT_MS = 15_000
const PROVIDERS = ['vietmap', 'goong']

export function validate(body) {
  const provider = body?.provider
  const company = typeof body?.company === 'string' ? body.company.trim() : ''
  const area = typeof body?.area === 'string' ? body.area.trim() : ''
  const id = typeof body?.id === 'string' ? body.id.trim() : ''
  if (!PROVIDERS.includes(provider) || id.length > 200) return null
  if (id) return { provider, id }
  if (!company || company.length > 120 || area.length > 200) return null
  return { provider, text: `${company} ${area}`.trim() }
}

export function upstreamUrls(provider, key) {
  if (provider === 'vietmap') return {
    search: (text) => `https://maps.vietmap.vn/api/search/v4?${new URLSearchParams({ text, layers: 'POI', display_type: '1', apikey: key })}`,
    detail: (id) => `https://maps.vietmap.vn/api/place/v4?${new URLSearchParams({ refid: id, apikey: key })}`,
  }
  return {
    search: (text) => `https://rsapi.goong.io/Place/AutoComplete?${new URLSearchParams({ input: text, limit: '10', api_key: key })}`,
    detail: (id) => `https://rsapi.goong.io/Place/Detail?${new URLSearchParams({ place_id: id, api_key: key })}`,
  }
}

/** 검색 결과를 같은 모양(이름·id)으로 정리. */
export function normalizeHits(provider, json) {
  if (provider === 'vietmap') return (Array.isArray(json) ? json : []).map((h) => ({ id: h.ref_id, name: h.name ?? '' }))
  return (json?.predictions ?? []).map((p) => ({ id: p.place_id, name: p.structured_formatting?.main_text ?? '' }))
}
export function normalizeDetail(provider, json) {
  if (provider === 'vietmap') return { lat: json?.lat, lng: json?.lng, address: json?.display || json?.address || '' }
  const r = json?.result
  return { lat: r?.geometry?.location?.lat, lng: r?.geometry?.location?.lng, address: r?.formatted_address || '' }
}

function runtimeDependencies() {
  return {
    key: (provider) => (provider === 'vietmap' ? process.env.VIETMAP_SERVICE_KEY : process.env.GOONG_API_KEY) || '',
    async fetchJson(url) {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS)
      try {
        const res = await fetch(url, { signal: ctrl.signal })
        if (!res.ok) return { ok: false, status: res.status }
        return { ok: true, json: await res.json() }
      } finally { clearTimeout(timer) }
    },
  }
}

export function createAdminBusinessSearchHandler(injected) {
  return async function adminBusinessSearchHandler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
    const request = validate(req.body)
    if (!request) return res.status(400).json({ error: 'Invalid request' })
    try {
      const deps = injected || runtimeDependencies()
      const key = deps.key(request.provider)
      if (!key) return res.status(503).json({ error: 'not_configured', provider: request.provider })
      const urls = upstreamUrls(request.provider, key)
      const up = await deps.fetchJson(request.id ? urls.detail(request.id) : urls.search(request.text))
      if (!up.ok) return res.status(502).json({ error: 'upstream_error', provider: request.provider, upstreamStatus: up.status })
      if (!request.id) return res.status(200).json({ ok: true, provider: request.provider, hits: normalizeHits(request.provider, up.json).filter((h) => h.id).slice(0, 10) })
      const place = normalizeDetail(request.provider, up.json)
      const found = Number.isFinite(place.lat) && Number.isFinite(place.lng)
      return res.status(200).json({ ok: true, provider: request.provider, found, ...(found ? place : {}) })
    } catch (error) {
      console.error('api/admin business-search: failed', error instanceof Error ? error.name : 'error')
      return res.status(500).json({ error: 'Operation failed' })
    }
  }
}
