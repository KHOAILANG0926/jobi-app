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
