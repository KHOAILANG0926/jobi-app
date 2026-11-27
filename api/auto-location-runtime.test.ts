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

// 지도 정상화 W3a: 저장된 지도 처리 결과가 Google·Goong 장애·한도 근거를 가지면 주소가 있어도 our_miss(비공개·저녁 목록)로 보내지 않고 보류 — 정상 '결과 없음'은 그대로 our_miss
{
  const { applyLocationVerdict } = await import('./_lib/auto-location-runtime.mjs')
  const run = async (provider_result: unknown, st: Record<string, unknown> = {}) => {
    const rpcCalls: string[] = []
    const rows: Record<string, unknown> = {
      local_jobs: { location: 'Khu phố Mao Yên, Bắc Ninh', source_text: 'Địa chỉ: Khu phố Mao Yên, Bắc Ninh' },
      map_r1_location_jobs: { state: 'done', failures: 0, calls: 1, source_points: [], provider_result, ...st },
    }
    const chain = (table: string) => {
      const q: any = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: rows[table] ?? null, error: null }),
        then: (ok: any) => ok({ data: table === 'job_work_locations' ? [{ raw_address: 'Khu phố Mao Yên, Bắc Ninh', industrial_park: null }] : [], error: null }) }
      return q
    }
    const db = { from: chain, rpc: async (name: string) => { rpcCalls.push(name); return { data: name === 'map_r1_has_exact' ? false : null, error: null } } }
    return { verdict: await applyLocationVerdict(db, 4983), rpcCalls }
  }
  const miss = await run({ kind: 'unresolved', evidence: 'google:no_verified_match\nvietmap:no_verified_match' })
  assert.equal(miss.verdict, 'our_miss', 'normal not-found keeps the existing our_miss path'); assert.ok(miss.rpcCalls.includes('map_r1_mark_unlocated'))
  for (const evidence of ['google:provider_failed\nvietmap:no_verified_match', 'google:quota', 'goong:quota', 'vietmap:provider_failed']) {
    const r = await run({ kind: 'unresolved', evidence })
    assert.equal(r.verdict, 'pending', `${evidence.split('\n')[0]} → pending`); assert.ok(!r.rpcCalls.includes('map_r1_mark_unlocated'), 'outage/quota is never hidden as our_miss')
  }
  const failedTwice = await run({ kind: 'unresolved', evidence: 'google:provider_failed' }, { state: 'failed', failures: 2, calls: 2 })
  assert.equal(failedTwice.verdict, 'pending', 'repeated outage stays pending')
  console.log('location verdict: W3a provider outage/quota → pending, normal miss → our_miss')
}

// 지도 정상화 W4·W6 마무리(Lee 2026-11-25): 원문 주소 읽기(지도 조회 없음)가 매장마다 위치 글자도 돌려준다 — 다시 처리가 이 공고가 글의
// 어느 지점인지 지도 확인 없이 가린다(지점별 독립 공고). 운영 #5992 KRIK 두 매장 모양.
{
  const { readLocationOnly } = await import('./_lib/auto-location-runtime.mjs')
  const r = readLocationOnly({ source_text: 'KRIK TUYỂN DỤNG NHÂN VIÊN BÁN HÀNG PARTTIME\n📍 Cơ sở 1: 152 Trần Hưng Đạo - Kinh Bắc - Bắc Ninh\n📍 Cơ sở 2: 148 Trần Phú, Từ Sơn, Bắc Ninh', location: '' })
  assert.equal(r.location, '152 Trần Hưng Đạo, Kinh Bắc, Bắc Ninh', 'first store stays the location text')
  assert.deepEqual(r.locations, ['152 Trần Hưng Đạo, Kinh Bắc, Bắc Ninh', '148 Trần Phú, Từ Sơn, Bắc Ninh'], 'every store from the source, no map lookup')
  console.log('read address: store list for branch identity (5992 form)')
}

// Lee 2026-11-27 #1086 운영 실증: 위치 확인 응답의 trace — 근거 종류와 외부 호출 시도 횟수(주소·키·응답 없음). 수집 실행 로그 한 줄의 원천.
{
  const { precheckLocation, locationTraceSource } = await import('./_lib/auto-location-runtime.mjs')
  const input = { company: 'Công ty TNHH Alpha', location: 'Bắc Ninh', addresses: ['Lô A1 KCN Quế Võ, Bắc Ninh'], source_text: 'Tuyển công nhân' }
  const mk = (rows: any[], memoryPoint: any[] = []) => {
    const calls: string[] = []
    const db: any = {
      rpc: async (name: string) => { calls.push('rpc:' + name); return name === 'location_site_memory' ? { data: rows, error: null } : name === 'location_memory_point' ? { data: memoryPoint, error: null } : { data: null, error: null } },
      from: () => { const q: any = { select: () => q, eq: () => q, in: async () => ({ data: [], error: null }), maybeSingle: async () => ({ data: null, error: null }), upsert: async () => ({ error: null }) }; return q },
    }
    return { db, calls }
  }
  // ① 관리자 확정 기억 → 근거 confirmed_memory, 외부 시도 0
  { const { db } = mk([], [{ candidate_id: 1 }]); const ext: string[] = []
    const r = await precheckLocation(db, async (a: string) => { ext.push(a); return null }, input, null, async () => { ext.push('google'); return null })
    assert.equal(r.trace.source, 'confirmed_memory'); assert.deepEqual(r.trace.external_attempts, { vietmap: 0, goong: 0, google: 0 }); assert.deepEqual(ext, []) }
  // ② 같은 사업장 기억(#1086) → 근거 site_memory, 외부 시도 0(Google·VietMap·Goong 모두 안 불림)
  { const { db } = mk([{ lat: 21.12, lng: 106.18, source: 'Google', work_location_id: 5, job_id: 9 }]); const ext: string[] = []
    const r = await precheckLocation(db, async (a: string) => { ext.push(a); return null }, input, async () => { ext.push('goong'); return null }, async () => { ext.push('google'); return null })
    assert.equal(r.findable, true, JSON.stringify(r)); assert.equal(r.trace.source, 'site_memory', JSON.stringify(r.trace))
    assert.deepEqual(r.trace.external_attempts, { vietmap: 0, goong: 0, google: 0 }); assert.deepEqual(ext, [], '기억을 쓰면 외부를 부르지 않음') }
  // ③ 기억이 없으면 기존 순서로 외부를 부르고 시도 횟수가 남는다(Google부터)
  { const { db } = mk([]); const ext: string[] = []
    const r = await precheckLocation(db, async (a: string) => { ext.push(a); return null }, input, null, async () => { ext.push('google'); return null }).catch(() => ({ trace: null }))
    assert.ok(ext.includes('google'), '기억 없음 → Google을 부름'); if (r.trace) assert.ok(r.trace.external_attempts.google >= 1, JSON.stringify(r.trace)) }
  // 근거 분류: 주소·키·응답 없이 한 단어
  assert.equal(locationTraceSource({ source: 'Google (site memory)', kind: 'exact' }), 'site_memory')
  assert.equal(locationTraceSource({ source: 'VietMap abc', kind: 'exact' }), 'vietmap')
  assert.equal(locationTraceSource({ source: 'admin_approved', kind: 'exact' }), 'confirmed_memory')
  assert.equal(locationTraceSource({ kind: 'unresolved' }), 'none')
  // 못 찾은 이유 코드만(주소·회사 걸러 냄) — 'none + 시도 0'이 결과 재사용인지 단계 건너뜀인지 가르는 근거
  const { locationTraceReasons } = await import('./_lib/auto-location-runtime.mjs')
  assert.deepEqual(locationTraceReasons({ kind: 'unresolved', evidence: 'vietmap:no_verified_match\ngoong:no_verified_match\ngoogle:not_configured\ngoogle:no_verified_match' }), ['vietmap:no_verified_match', 'goong:no_verified_match', 'google:not_configured', 'google:no_verified_match'])
  assert.deepEqual(locationTraceReasons({ kind: 'unresolved', evidence: 'Số 1 Lô A, KCN X, Bắc Ninh\nCông ty ABC\nhttps://x.y/z?k=1\ngoogle:quota' }), ['google:quota'], '주소·회사·주소창은 걸러 내고 코드만')
  assert.deepEqual(locationTraceReasons({ kind: 'exact', source: 'Google' }), [], '찾은 경우는 이유 없음')
  assert.deepEqual(locationTraceReasons({ kind: 'unresolved' }), [])
  console.log('precheck trace: confirmed_memory·site_memory는 외부 시도 0, 기억 없으면 Google 시도 기록, 근거는 한 단어, 못 찾은 이유는 코드만')
}
