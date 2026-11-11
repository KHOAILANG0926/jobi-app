import assert from 'node:assert/strict'
import { canonicalVerdictKind } from './_lib/auto-location-runtime.mjs'

assert.equal(canonicalVerdictKind({source_points:[],provider_result:{kind:'exact',lat:21,lng:106}}),null)
assert.equal(canonicalVerdictKind({source_points:[],provider_result:{kind:'unresolved'}}),'unresolved')
assert.equal(canonicalVerdictKind({source_points:[{kind:'area',lat:21,lng:106}],provider_result:{kind:'unresolved'}}),'area')
assert.equal(canonicalVerdictKind({source_points:[{kind:'exact',lat:null,lng:null}]}),null)
console.log('canonical location verdict: source-derived points only, provider failure retained')
const {missingVerifiedCoordinate}=await import('./_lib/admin-location-review.js')
assert.equal(missingVerifiedCoordinate({active:true,admin_hidden:false,company:'Any employer',location:'TP. Bắc Ninh'},[{raw_address:'TP. Bắc Ninh',lat:21.18608,lng:106.07632,location_verified:false}],[]),true,'administrative approximation remains in existing confirmation queue')

// Lee 2026-10-28: 원문에 성 이름뿐(no_info)이어도 위치 판정은 공고를 지우지 않는다.
{
  const { applyLocationVerdict } = await import('./_lib/auto-location-runtime.mjs')
  const rpcCalls: string[] = []
  const rows: Record<string, unknown> = {
    local_jobs: { location: 'Bắc Ninh', source_text: 'Bắc Ninh' },
    map_r1_location_jobs: { state: 'done', failures: 0, calls: 1, source_points: [], provider_result: { kind: 'unresolved' } },
  }
  const chain = (table: string) => {
    const q: any = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: rows[table] ?? null, error: null }),
      then: (ok: any) => ok({ data: table === 'job_work_locations' ? [{ raw_address: 'Bắc Ninh', industrial_park: null }] : [], error: null }) }
    return q
  }
  const db = { from: chain, rpc: async (name: string) => { rpcCalls.push(name); return { data: name === 'map_r1_has_exact' ? false : null, error: null } } }
  const verdict = await applyLocationVerdict(db, 4982)
  assert.equal(verdict, 'no_info', 'province-only source is still classified as no_info')
  assert.ok(!rpcCalls.includes('map_r1_delete_no_info'), 'no_info must not delete the job')
  console.log('location verdict: no_info keeps the job (no delete)')
}

// Lee 2026-11-09·11-10: 관리자 확정 위치(같은 회사 + 같은 주소)가 있으면 Google·지도에 묻지 않고 찾음으로 본다. 조회 실패·없음은 기존 순서.
{
  const { precheckLocation } = await import('./_lib/auto-location-runtime.mjs')
  const input = { company: 'Công ty TNHH Alpha', location: 'Bắc Ninh', addresses: ['Lô A1 KCN Quế Võ, Bắc Ninh'], source_text: 'Tuyển công nhân' }
  const calls: string[] = []
  const request = async (action: string) => { calls.push(action); return null }
  const google = async () => { calls.push('google'); return null }
  const memoryDb = (result: any) => ({
    rpc: async (name: string, args: any) => { calls.push('rpc:' + name); if (name === 'location_memory_point') { assert.deepEqual(args, { p_company: 'Công ty TNHH Alpha', p_addresses: ['Lô A1 KCN Quế Võ, Bắc Ninh'] }); return result } return { data: null, error: null } },
    from: () => { const q: any = { select: () => q, eq: () => q, in: async () => ({ data: [], error: null }), maybeSingle: async () => ({ data: null, error: null }), upsert: async () => ({ error: null }) }; return q },
  })
  const hit = await precheckLocation(memoryDb({ data: [{ candidate_id: 1 }], error: null }), request, input, null, google)
  assert.equal(hit.findable, true); assert.equal(hit.reason, 'confirmed_memory'); assert.equal(hit.kind, 'exact')
  assert.deepEqual(calls.filter((c) => !c.startsWith('rpc:')), [], 'confirmed memory → no map/Google call')
  for (const result of [{ data: [], error: null }, { data: null, error: { message: 'x' } }]) {
    calls.length = 0
    const miss = await precheckLocation(memoryDb(result), request, input, null, google).catch(() => ({ reason: 'resolver_ran' }))
    assert.notEqual(miss.reason, 'confirmed_memory', 'no memory / lookup error → existing order')
    assert.ok(calls.some((c) => !c.startsWith('rpc:')) || miss.reason === 'resolver_ran', 'existing resolver still runs')
  }
  console.log('precheck: confirmed memory skips Google, miss/error keeps existing order')
}

// Codex #697: 매장 여러 곳 — 확정 위치는 매장마다 맞춰 본다. 두 번째 매장만 확정이고 첫 매장을 못 찾으면 두 번째 매장이 공고 위치(못 찾은 첫 매장은 안 넣음)
{
  const { precheckLocation } = await import('./_lib/auto-location-runtime.mjs')
  const src = 'KRIK TUYỂN DỤNG\nĐịa chỉ: 152 Trần Hưng Đạo - Kinh Bắc - Bắc Ninh\n148 Trần Phú - Từ Sơn - Bắc Ninh\nLiên hệ 0886530131'
  const db = {
    rpc: async (name: string, args: any) => name === 'location_memory_point' ? { data: String(args.p_addresses[0]).startsWith('148') ? [{ candidate_id: 1 }] : [], error: null } : { data: null, error: null },
    from: () => { const q: any = { select: () => q, eq: () => q, in: async () => ({ data: [], error: null }), maybeSingle: async () => ({ data: null, error: null }), upsert: async () => ({ error: null }) }; return q },
  }
  const r = await precheckLocation(db, async () => null, { company: 'KRIK', location: 'Bắc Ninh', source_text: src }, null, async () => ({ places: [] }))
  assert.equal(r.findable, true, 'confirmed second store makes the posting findable')
  assert.ok(String(r.location).startsWith('148 Trần Phú'), 'location = confirmed store, not the unfound first: ' + r.location)
  assert.ok(!r.stores || r.stores.length === 1, 'only the one found store')
  // Codex #697: 확정 매장 + 다른 매장 Google 한도 → 공고 전체 보류(google_quota)
  const db2 = { ...db, rpc: async (name: string, args: any) => name === 'location_memory_point' ? { data: String(args.p_addresses[0]).startsWith('152') ? [{ candidate_id: 1 }] : [], error: null } : { data: null, error: null } }
  const q = await precheckLocation(db2, async () => null, { company: 'KRIK', location: 'Bắc Ninh', source_text: src }, null, async () => { throw new Error('quota_exhausted') })
  assert.equal(q.findable, false); assert.equal(q.reason, 'google_quota', 'quota on the other store holds the posting: ' + q.reason)
  console.log('precheck: confirmed memory per store passed')
}
