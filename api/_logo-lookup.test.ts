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
}
{ // Codex #619 P2: 한도 초과 기록의 장소 번호로 다시 시도(저장된 검색 결과가 없어도)
  const { db, calls } = fakeDb({ ...base, logo_lookup: { result: 'quota', place_id: 'ChIJrec' } })
  assert(await applyLogoLookup(db, 9, 'k', fetchOk('https://hojeong.vn')) === 'found', 'recorded place id reused')
  assert(calls.rpc.find(([n]) => n === 'job_logo_lookup_record')![1].p_place_id === 'ChIJrec', 'same place id recorded')
}
{ // Codex #619 P2: 한도 초과로 남은 공고가 그사이 사진·브랜드를 갖게 되면 has_logo로 기록 → 다시 시도 목록(result=quota)에서 빠짐
  const own = 'https://edhuesdnuxlbcfephutq.supabase.co/storage/v1/object/public/job-images/9/a.jpg'
  for (const job of [{ ...base, image_url: own, logo_lookup: { result: 'quota', place_id: 'ChIJq' } }, { ...base, company: 'NETCO POST', logo_lookup: { result: 'quota' } }]) {
    const { db, calls } = fakeDb(job)
    let asked = 0
    assert(await applyLogoLookup(db, 9, 'k', async () => { asked++; return { ok: true, status: 200, json: async () => ({}) } }) === 'has_logo' && asked === 0, 'has logo now → no Google call')
    const rec = calls.rpc.find(([n]) => n === 'job_logo_lookup_record')
    assert(rec && rec[1].p_result === 'has_logo', 'quota row closed as has_logo: ' + JSON.stringify(rec))
  }
  const { db, calls } = fakeDb({ ...base, image_url: own })
  assert(await applyLogoLookup(db, 9, 'k', fetchOk(null)) === 'has_logo' && !calls.rpc.some(([n]) => n === 'job_logo_lookup_record'), 'never-checked job with photo → nothing recorded (unchanged)')
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
          gte: (k: string, v: string) => { filters.push(`${k}>=${v}`); return q }, order: (c: string) => { filters.push(`order:${c}`); return q }, limit: async () => ({ data: rows, error: null }),
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
  assert(filters.includes('order:logo_lookup->>checked_at'), 'longest-waiting first (deferred jobs go to the back)')
  assert(filters.includes('created_at>=2026-10-27T00:00:00.000Z'), 'no endless retry: only jobs registered within 14 days')
}
{ // Codex #619 P2: 이 공고만의 오류는 묶음을 막지 않는다. 장소 번호 무효(Google 404 NOT_FOUND)는 확정 → 다시 묻지 않음
  const res = (status: number, body: unknown = {}) => async (u: string) => u.includes('places.googleapis.com')
    ? { ok: status === 200, status, json: async () => body } : { ok: true, status: 200, json: async () => ({}) }
  // ① 404 NOT_FOUND → no_place, 무효 기록 → 같은 장소 번호는 다음부터 Google에 묻지 않음. 공고·위치는 건드리지 않음(기록 함수만 부름)
  const cache = new Map<string, unknown>()
  const quotaJob = { ...base, logo_lookup: { result: 'quota', place_id: 'ChIJgone' } }
  const a = fakeDb(quotaJob, { cache })
  assert(await applyLogoLookup(a.db, 9, 'k', res(404, { error: { status: 'NOT_FOUND' } })) === 'no_place', '404 NOT_FOUND → no_place')
  assert(a.calls.rpc.filter(([n]) => n === 'job_logo_lookup_record').every(([, x]) => x.p_result === 'no_place'), 'only the logo record changes')
  let asked = 0
  const b = fakeDb(quotaJob, { cache })
  assert(await applyLogoLookup(b.db, 9, 'k', async () => { asked++; return { ok: true, status: 200, json: async () => ({}) } }) === 'no_place' && asked === 0, 'confirmed-invalid place id never asked again')
  // 404인데 NOT_FOUND 확인이 없으면 무효로 확정하지 않는다 → 일시 오류로 다시 시도
  assert(await applyLogoLookup(fakeDb(quotaJob).db, 9, 'k', res(404, {})) === 'retry_later', '404 without NOT_FOUND → not confirmed, retry later')
  // ② 일시 오류(서버 오류·연결 끊김) → quota로 다시 기록(시각 새로) → retry_later
  for (const f of [res(500), async () => { throw new Error('network') }]) {
    const c = fakeDb(quotaJob)
    assert(await applyLogoLookup(c.db, 9, 'k', f) === 'retry_later', 'temporary error → retry_later')
    assert(c.calls.rpc.some(([n, x]) => n === 'job_logo_lookup_record' && x.p_result === 'quota' && x.p_place_id === 'ChIJgone'), 'kept as quota with same place id (checked_at refreshed)')
  }
  // ③ Google 장애(503) → 묶음 멈춤(예외)
  let threw = ''
  try { await applyLogoLookup(fakeDb(quotaJob).db, 9, 'k', res(503)) } catch (e) { threw = (e as Error).message }
  assert(threw === 'upstream_unavailable', 'Google 503 → stop batch')
  // ④ 묶음: 첫 공고 일시 오류여도 다음 공고 계속, 한도 초과일 때만 멈춤
  const ids = [{ id: 9 }, { id: 10 }, { id: 11 }]
  let n = 0
  const inner = fakeDb(quotaJob).db
  const db = {
    from(t: string) {
      if (t === 'local_jobs') {
        const q: Record<string, unknown> = {}
        Object.assign(q, { select: () => q, eq: () => q, lt: () => q, gte: () => q, order: () => q, limit: async () => ({ data: ids, error: null }),
          maybeSingle: async () => { const id = ids[n++]?.id; return { data: { ...quotaJob, id, logo_lookup: { result: 'quota', place_id: `ChIJp${id}` } }, error: null } } })
        return q
      }
      return inner.from(t)
    },
    async rpc(name: string, args: Row) { if (name === 'external_api_reserve') return { data: true, error: null }; return { data: args.p_result ?? null, error: null } },
  }
  // 공고 9: 서버 오류(일시) → 다음으로 / 10: 웹사이트 찾음 / 11: Google 한도(429) → 멈춤
  const statuses = [500, 200, 429]
  let call = 0
  const f = async (u: string) => {
    if (!u.includes('places.googleapis.com')) return { ok: true, status: 200, json: async () => ({}) }
    const s = statuses[call++]
    return { ok: s === 200, status: s, json: async () => (s === 200 ? { websiteUri: 'https://hojeong.vn' } : {}) }
  }
  const out = await retryQuotaLogos(db, 'k', 10, new Date('2026-11-10T00:00:00Z'), f)
  assert(out.tried === 3 && out.later === 1 && out.other === 1 && out.quota === 1, 'per-job error skipped, quota stops: ' + JSON.stringify(out))
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
