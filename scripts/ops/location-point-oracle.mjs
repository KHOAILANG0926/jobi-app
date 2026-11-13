import assert from 'node:assert/strict'

// This deliberately reads raw source columns rather than importing app coordinate helpers.
export function sourcePoints(rows) {
  const resolved=rows.filter(r=>r.point_kind!=='unresolved')
  for(const r of resolved) {
    assert.ok(r.lat!=null && r.lng!=null && Number(r.lat)>=8 && Number(r.lat)<=24 && Number(r.lng)>=102 && Number(r.lng)<=110,'invalid resolved source coordinate')
    assert.ok(['exact','gate','area'].includes(r.point_kind),'invalid resolved source kind')
  }
  return resolved.map(r=>({workLocationId:r.id,lat:r.lat,lng:r.lng,kind:r.point_kind,precision:r.point_precision,revision:r.point_revision}))
}
export function canonical(points) {
  return points.map(p=>{
    assert.ok(['exact','gate','area'].includes(p.kind),'missing/invalid point kind')
    assert.ok(typeof p.precision==='string' && p.precision.length,'missing precision')
    assert.ok(Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)),'invalid coordinates')
    assert.ok(Number(p.revision)>=1,'missing revision')
    assert.ok(p.workLocationId!=null,'missing work location identity')
    return JSON.stringify([String(p.workLocationId),Number(p.lat),Number(p.lng),p.kind,p.precision,Number(p.revision)])
  }).sort()
}
export function assertPoints(expected, actual, context) {
  assert.deepEqual(canonical(actual),canonical(expected),context)
}
export function pointsForJob(markers, jobId) {
  return markers.flatMap(marker=>marker.filter(p=>String(p.jobId)===String(jobId)))
}
export async function readPublicSnapshot(client, pageSize=500) {
  const jobs=[]
  let after=0
  while(true) {
    const {rows}=await client.query('select id,category from public.local_jobs where active=true and admin_hidden=false and id>$1 order by id limit $2',[after,pageSize])
    jobs.push(...rows)
    if(rows.length<pageSize) break
    after=rows.at(-1).id
  }
  const ids=jobs.map(j=>j.id)
  const {rows:locations}=await client.query('select id,job_id,lat,lng,point_kind,point_precision,point_evidence,point_revision from public.job_work_locations where job_id=any($1::bigint[]) order by job_id,sort_order,id',[ids])
  const {rows:caches}=await client.query('select job_id,source_points from public.map_r1_location_jobs where job_id=any($1::bigint[])',[ids])
  return jobs.map(job=>({ ...job,points:sourcePoints(locations.filter(w=>String(w.job_id)===String(job.id))),cache:caches.find(c=>String(c.job_id)===String(job.id))?.source_points??[] }))
}
// 오래 걸리는 운영 감사는 공고 목록을 먼저 읽고 나중에 화면·API와 대조하므로, 그 사이 공고가 비공개로 바뀌거나 위치가 바뀌면 불일치가 난다(2026-11-12 180f24b 첫 deploy-verify 실패: 5342).
// 실패를 받으면 그 공고를 지금 상태로 다시 읽어, 더는 공개가 아니거나 원본 위치가 처음 읽은 것과 달라졌을 때만 'changed'(감사 도중 변경)로 구분하고, 그대로인데 어긋나면 원래 오류를 그대로 던진다.
export async function settleChange(error, job, readFresh) {
  const fresh=await readFresh(job.id)
  if(!fresh?.public) return 'changed'
  let same
  // 점이 검증을 통과하지 못하면 바뀌었는지 판단할 수 없으므로 '변경'으로 넘기지 않고 원래 오류를 유지한다.
  try { same=JSON.stringify(canonical(fresh.points))===JSON.stringify(canonical(job.points)) } catch { throw error }
  if(!same) return 'changed'
  throw error
}
