// 로고 찾기(Lee 2026-11-07): 저장된 Google 결과로 장소 번호 → 웹사이트 1번(월 한도) → 기록. 사진·브랜드 있으면 건너뜀.
import { createHash } from 'node:crypto'
import { applyLogoLookup, googlePlacesRequest, retryQuotaLogos } from './_lib/auto-location-runtime.mjs'
import { googleCacheKey } from '../src/lib/logoLookup.ts'
function assert(ok: boolean, name: string) { if (!ok) throw new Error(name) }

type Row = Record<string, unknown>
function fakeDb(job: Row, opts: { reserve?: boolean; cache?: Map<string, unknown> } = {}) {
  const calls: { rpc: [string, Row][] } = { rpc: [] }
  const cache = opts.cache ?? new Map<string, unknown>()
  const tables: Record<string, Row[]> = {
    local_jobs: [job],
    job_brands: [{ id: 1, name: 'NETCO POST', slug: 'netco-post', category: 'delivery', domain: 'netco.com.vn', initial: 'N', color: '#0a0', active: true, featured: true }],
    job_brand_aliases: [{ brand_id: 1, alias: 'NETCO POST', is_primary: true }],
    map_r1_location_jobs: [{ job_id: job.id, snapshot: { company: job.company, location: 'Bắc Ninh', targets: [{ address: 'KCN Quế Võ, Bắc Ninh' }] } }],
  }
  const db = {
    from(t: string) {
      if (t === 'research_artifacts') {
        let name = ''
        const q = {
          select: () => q, eq: (k: string, v: string) => { if (k === 'name') name = v; return q },
          maybeSingle: async () => ({ data: cache.has(name) ? { payload: { data: cache.get(name) } } : null, error: null }),
          upsert: async (row: Row) => { cache.set(row.name as string, (row.payload as Row).data); return { error: null } },
        }
        return q
      }
      const rows = tables[t] ?? []
      const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: rows[0] ?? null, error: null }), then: (r: (v: unknown) => void) => r({ data: rows, error: null }) }
      return q
    },
    async rpc(name: string, args: Row) {
      calls.rpc.push([name, args])
      if (name === 'external_api_reserve') return { data: opts.reserve ?? true, error: null }
      if (name === 'job_logo_lookup_record') return { data: args.p_result, error: null }
      return { data: null, error: null }
    },
  }
  return { db, calls, cache }
}
const hashKey = (k: string) => createHash('sha256').update(k).digest('hex')
const hit = { places: [{ id: 'ChIJx', displayName: { text: 'Công ty TNHH Hojeong Vina' }, formattedAddress: 'KCN Quế Võ, Bắc Ninh', location: { latitude: 21.15, longitude: 106.15 } }] }
const base = { id: 9, company: 'Hojeong', title: 'Công nhân', image_url: null, images: null, logo_lookup: null }
const fetchOk = (website: string | null, iconStatus = 200) => async (url: string) => url.includes('places.googleapis.com')
  ? { ok: true, status: 200, json: async () => (website ? { websiteUri: website } : {}) }
  : { ok: iconStatus === 200, status: iconStatus, json: async () => ({}) }

{ // 찾음
  const cache = new Map([[hashKey(googleCacheKey('Hojeong', 'KCN Quế Võ, Bắc Ninh')), hit]])
  const { db, calls } = fakeDb(base, { cache })
  const r = await applyLogoLookup(db, 9, 'k', fetchOk('https://www.hojeong.co.kr/vn'))
  assert(r === 'found', 'found: ' + r)
  const rec = calls.rpc.find(([n]) => n === 'job_logo_lookup_record')![1]
  assert(rec.p_domain === 'hojeong.co.kr' && rec.p_place_id === 'ChIJx', 'records domain + place')
  assert(calls.rpc.filter(([n, a]) => n === 'external_api_reserve' && a.p_api === 'google_place_website').length === 1, 'one website call reserved')
}
{ // 한도 → quota, Google 안 부름
  const cache = new Map([[hashKey(googleCacheKey('Hojeong', 'KCN Quế Võ, Bắc Ninh')), hit]])
  let asked = 0
  const { db } = fakeDb(base, { cache, reserve: false })
  assert(await applyLogoLookup(db, 9, 'k', async () => { asked++; return { ok: true, status: 200, json: async () => ({}) } }) === 'quota' && asked === 0, 'quota → no call')
}
{ // 저장된 Google 결과 없음 → no_place (새로 묻지 않음)
  const { db, calls } = fakeDb(base)
  assert(await applyLogoLookup(db, 9, 'k', fetchOk('https://x.vn')) === 'no_place', 'no cached place')
  assert(!calls.rpc.some(([n]) => n === 'external_api_reserve'), 'no reserve without place')
}
{ // 아이콘 없는 사이트 → none
  const cache = new Map([[hashKey(googleCacheKey('Hojeong', 'KCN Quế Võ, Bắc Ninh')), hit]])
  const { db } = fakeDb(base, { cache })
  assert(await applyLogoLookup(db, 9, 'k', fetchOk('https://hojeong.vn', 404)) === 'none', 'no favicon → none')
}
{ // 브랜드·사진 있으면 건너뜀, 이미 기록이면 그대로
  assert(await applyLogoLookup(fakeDb({ ...base, company: 'NETCO POST' }).db, 9, 'k', fetchOk(null)) === 'has_logo', 'brand → skip')
  const own = 'https://edhuesdnuxlbcfephutq.supabase.co/storage/v1/object/public/job-images/facebook/a.jpg'
  assert(await applyLogoLookup(fakeDb({ ...base, image_url: own }).db, 9, 'k', fetchOk(null)) === 'has_logo', 'own photo → skip')
  assert(await applyLogoLookup(fakeDb({ ...base, logo_lookup: { result: 'none' } }).db, 9, 'k', fetchOk(null)) === 'done', 'recorded → done')
}
{ // Lee 2026-11-09: 한도 초과(quota)는 영구 실패가 아니다 — 다시 묻는다. Google 429도 quota로 남긴다.
  const cache = new Map([[hashKey(googleCacheKey('Hojeong', 'KCN Quế Võ, Bắc Ninh')), hit]])
  const { db } = fakeDb({ ...base, logo_lookup: { result: 'quota' } }, { cache })
  assert(await applyLogoLookup(db, 9, 'k', fetchOk('https://www.hojeong.co.kr')) === 'found', 'quota → retried → found')
  const c2 = new Map([[hashKey(googleCacheKey('Hojeong', 'KCN Quế Võ, Bắc Ninh')), hit]])
  const { db: d2 } = fakeDb(base, { cache: c2 })
  assert(await applyLogoLookup(d2, 9, 'k', async () => ({ ok: false, status: 429, json: async () => ({}) })) === 'quota', 'Google 429 → quota (retryable)')
  const c3 = new Map<string, unknown>([[hashKey(googleCacheKey('Hojeong', 'KCN Quế Võ, Bắc Ninh')), hit], [hashKey(JSON.stringify(['place-website-v1', 'ChIJx'])), { expired: true, places: [] }]])
  let asked = 0
  const { db: d3 } = fakeDb(base, { cache: c3 })
  assert(await applyLogoLookup(d3, 9, 'k', async (u: string) => { if (u.includes('places.googleapis.com')) asked++; return fetchOk('https://hojeong.vn')(u) }) === 'found' && asked === 1, '30-day expired website → asked again')
}
{ // 다시 시도 묶음: 한도가 아직이면 첫 건에서 멈춘다(헛 호출 없음)
  const rows = [{ id: 9 }, { id: 10 }]
  const inner = fakeDb(base, { cache: new Map([[hashKey(googleCacheKey('Hojeong', 'KCN Quế Võ, Bắc Ninh')), hit]]) }).db
  const filters: string[] = []
  const db = {
    from(t: string) {
      if (t === 'local_jobs') {
        const q: Record<string, unknown> = {}
        Object.assign(q, { select: (c: string) => { filters.push(c); return q }, eq: (k: string, v: string) => { filters.push(`${k}=${v}`); return q }, lt: (k: string) => { filters.push(`${k}<`); return q },
          order: () => q, limit: async () => ({ data: rows, error: null }),
          maybeSingle: async () => ({ data: { ...base, logo_lookup: { result: 'quota' } }, error: null }) })
        return q
      }
      return inner.from(t)
    },
    async rpc(name: string, args: Row) { if (name === 'external_api_reserve') return { data: false, error: null }; return { data: args.p_result ?? null, error: null } },
  }
  const out = await retryQuotaLogos(db, 'k', 10, new Date('2026-11-10T00:00:00Z'))
  assert(filters.includes('logo_lookup->>result=quota') && filters.includes('logo_lookup->>checked_at<'), 'only quota rows older than 6h')
  assert(out.tried === 1 && out.quota === 1, 'still capped → stop after first: ' + JSON.stringify(out))
}
{ // Google 위치 검색도 월 한도 안에서만
  let asked = 0
  const orig = globalThis.fetch
  globalThis.fetch = (async () => { asked++; return { ok: true, json: async () => ({}) } }) as never
  try {
    let threw = false
    try { await googlePlacesRequest('k', async () => false)('x') } catch { threw = true }
    assert(threw && asked === 0, 'text search quota → not called')
    await googlePlacesRequest('k', async () => true)('x')
    assert(asked === 1, 'within quota → called')
  } finally { globalThis.fetch = orig }
}
console.log('logo lookup runtime: 찾음·한도·장소 없음·아이콘 없음·건너뜀·위치 검색 한도 통과')
