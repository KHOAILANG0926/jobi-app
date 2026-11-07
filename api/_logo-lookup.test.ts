// 로고 찾기(Lee 2026-11-07): 저장된 Google 결과로 장소 번호 → 웹사이트 1번(월 한도) → 기록. 사진·브랜드 있으면 건너뜀.
import { createHash } from 'node:crypto'
import { applyLogoLookup, googlePlacesRequest } from './_lib/auto-location-runtime.mjs'
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
const hit = { places: [{ id: 'ChIJx', displayName: { text: 'Công ty TNHH Hojeong Vina' }, formattedAddress: 'Quế Võ, Bắc Ninh', location: { latitude: 21.15, longitude: 106.15 } }] }
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
