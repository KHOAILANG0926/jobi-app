import { createHash, randomUUID } from 'node:crypto'
import { resolveAutoLocation } from '../../src/lib/autoLocationResolver.ts'
import { findWardCenter } from '../../src/lib/wardArea.ts'

export async function runLocationBatch(db, request, limit = 10) {
  return runClaimed(db, request, (rpc, lease) => rpc('map_r1_claim_batch', {p_limit:limit,p_lease:lease}))
}

/** 공고 한 건만(저장 즉시 위치 찾기, api/location-hook). 규칙·한도는 일괄 처리와 같다. */
export async function runLocationJob(db, request, jobId) {
  return runClaimed(db, request, (rpc, lease) => rpc('map_r1_claim_job', {p_id:jobId,p_lease:lease}))
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
