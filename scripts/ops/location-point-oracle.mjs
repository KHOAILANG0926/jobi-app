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

// 외부 지도(VietMap) 요청 실패와 우리 위치 데이터·핀 오류를 가른다(2026-11-23, MAP-1 #946·#948 반복 실패의 근본 구조).
// 지도 화면을 기다리다 시간이 지난 실패(TimeoutError)를 '외부'로 보는 조건 — 모두 만족해야 한다:
//  ① 비교·검증 오류(AssertionError)가 아니다(데이터 불일치는 언제나 실패)
//  ② 이 공고를 여는 동안 VietMap 스타일 요청이 실제로 실패했다(끊김·시간 초과·5xx·429). 401·403은 우리 열쇠 문제라 외부가 아니다. 요청 기록이 없으면 원인을 못 묻히므로 실패 유지
//  ③ 그 화면이 그리려던 점(data-planned-location-points)이 있으면 원본 점과 같아야 한다 — 다르면 데이터 오류
// 외부로 분류돼도 이 공고의 '화면에 그려짐'은 확인하지 못한 것이다(호출한 쪽이 따로 기록하고, 한 건도 그려 보지 못하면 실패시킨다).
export function classifyMapFailure(error, { state, styleRequests, points }) {
  if(error?.name==='AssertionError' || error?.code==='ERR_ASSERTION') return {external:false,reason:'비교 오류(데이터 불일치)'}
  if(error?.name!=='TimeoutError') return {external:false,reason:'화면 대기 시간 초과가 아님'}
  const failed=(styleRequests??[]).filter(r=>r.failure || !(r.status>=200 && r.status<300))
  if(!failed.length) return {external:false,reason:'이 공고를 여는 동안 실패한 지도 스타일 요청이 없음'}
  // 외부로 볼 수 있는 것은 VietMap 서버(maps.vietmap.vn)로 간 요청의 실패뿐이다. 우리 쪽 사본(/vietmap/styles/…)이나 주소를 모르는 요청의 실패는 우리 배포 문제일 수 있어 외부로 묻지 않는다.
  const host=r=>{ try { return new URL(r.url).hostname } catch { return '' } }
  if(failed.some(r=>host(r)!=='maps.vietmap.vn')) return {external:false,reason:'VietMap 서버가 아닌 스타일 요청(우리 쪽 사본 등)이 실패'}
  if(failed.some(r=>r.status===401 || r.status===403)) return {external:false,reason:'지도 스타일 요청이 401·403(우리 열쇠 문제)'}
  if(state?.planned) {
    try { assertPoints(points,JSON.parse(state.planned),'planned points') }
    catch { return {external:false,reason:'화면이 그리려던 점이 원본 점과 다름'} }
  }
  return {external:true,reason:`VietMap 스타일 요청 실패 ${failed.length}건(${[...new Set(failed.map(r=>r.failure??('HTTP '+r.status)))].join(', ')})`}
}
