import { createHash, randomUUID } from 'node:crypto'
import { resolveAutoLocation } from '../../src/lib/autoLocationResolver.ts'
import { findWardCenter } from '../../src/lib/wardArea.ts'
import { locationVerdict } from '../../src/lib/locationLevel.ts'

export async function runLocationBatch(db, request, limit = 10) {
  return runClaimed(db, request, (rpc, lease) => rpc('map_r1_claim_batch', {p_limit:limit,p_lease:lease}))
}

/** 공고 한 건만(저장 즉시 위치 찾기, api/location-hook). 규칙·한도는 일괄 처리와 같다. */
export async function runLocationJob(db, request, jobId, force = false) {
  return runClaimed(db, request, (rpc, lease) => rpc('map_r1_claim_job_v2', {p_id:jobId,p_lease:lease,p_force:force}))
}

/** 결정 0006(2026-10-20 Lee 수정): 찾음 → 숨김 해제(원래 공개였으면 다시 공개) / 원문에 위치 정보 없음 → 바로 삭제
 *  / 주소는 있는데 못 찾음 → 비공개 + 저녁 8시 목록(삭제하지 않음) / 판정 보류 → 그대로. */
export async function applyLocationVerdict(db, jobId) {
  const [{data:job,error:e1},{data:wl,error:e2},{data:st,error:e3},{data:exact,error:e4}] = await Promise.all([
    db.from('local_jobs').select('location,source_text').eq('id',jobId).maybeSingle(),
    db.from('job_work_locations').select('raw_address,industrial_park').eq('job_id',jobId),
    db.from('map_r1_location_jobs').select('state,failures,calls,result').eq('job_id',jobId).maybeSingle(),
    db.rpc('map_r1_has_exact',{p_id:jobId}),
  ])
  if (e1||e2||e3||e4) throw new Error('location_storage_unavailable')
  if (!job) return 'missing'
  const verdict = locationVerdict({
    hasExact: exact === true,
    state: st ? {state:st.state, failures:st.failures, calls:st.calls, kind:st.result?.kind ?? null} : null,
    texts: [job.location, ...(wl ?? []).flatMap((w) => [w.raw_address, w.industrial_park])],
    sourceText: job.source_text,
  })
  if (verdict === 'located') { const {error} = await db.rpc('map_r1_mark_located',{p_id:jobId}); if (error) throw new Error('mark_failed') }
  if (verdict === 'our_miss') { const {error} = await db.rpc('map_r1_mark_unlocated',{p_id:jobId,p_reason:'our_miss'}); if (error) throw new Error('mark_failed') }
  if (verdict === 'no_info') { const {error} = await db.rpc('map_r1_delete_no_info',{p_id:jobId}); if (error) throw new Error('delete_failed') }
  return verdict
}

async function runClaimed(db, request, claim) {
  const lease = randomUUID()
  const rpc = async (name, args) => {
    const { data, error } = await db.rpc(name, args)
    if (error) throw new Error('location_storage_unavailable')
    return data
  }
  const claimed = await claim(rpc, lease)
  const summary = {processed:0,exact:0,representative:0,unresolved:0,apiCalls:0,failed:0,deferred:0}
  for (const row of claimed ?? []) {
    let calls = 0
    try {
      const result = await resolveAutoLocation(row.snapshot, {
        remainingCalls: Math.max(0,2-row.calls),
        async cached(key) {
          const name = createHash('sha256').update(key).digest('hex')
          const {data,error} = await db.from('research_artifacts').select('payload').eq('kind','map-r1-query').eq('name',name).maybeSingle()
          if (error) throw new Error('cache_unavailable')
          return data?.payload?.data ?? null
        },
        async cache(key,data) {
          const name = createHash('sha256').update(key).digest('hex')
          const {error} = await db.from('research_artifacts').upsert({kind:'map-r1-query',name,payload:{data},meta:{}},{onConflict:'kind,name'})
          if (error) throw new Error('cache_unavailable')
        },
        reserve: () => rpc('map_r1_reserve_call',{p_id:row.job_id,p_lease:lease}),
        async wardCenter(unit) {
          const {data,error} = await db.from('research_artifacts').select('payload').eq('kind','autolocate').eq('name','ward_centers').maybeSingle()
          if (error) return null
          const e = findWardCenter(data?.payload ?? null, unit.key)
          return e && typeof e.lat==='number' && typeof e.lng==='number' ? {lat:e.lat,lng:e.lng,at:e.at||''} : null
        },
        async request(action,params) { calls++; return request(action,params) },
      })
      const saved = await rpc('map_r1_complete',{p_id:row.job_id,p_lease:lease,p_result:result})
      if (!saved) { summary.failed++; continue }
      summary.processed++
      if (result.kind==='exact') summary.exact++
      else if (result.kind==='unresolved') summary.unresolved++
      else summary.representative++
      if (result.failed) summary.failed++
      if (result.deferred) summary.deferred++
    } catch { summary.failed++ }
    finally { summary.apiCalls += calls }
  }
  return summary
}
export function vietmapRequest(key) {
  return async (action, params) => {
    const query = new URLSearchParams({...params,apikey:key, ...(action==='search'?{display_type:'1'}:{})})
    const res = await fetch(`https://maps.vietmap.vn/api/${action}/v4?${query}`,{signal:AbortSignal.timeout(15000)})
    if (!res.ok) throw new Error('upstream_failed') // Never include URLs, keys, addresses or response bodies in logs.
    return res.json()
  }
}
