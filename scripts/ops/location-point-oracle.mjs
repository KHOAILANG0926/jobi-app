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
