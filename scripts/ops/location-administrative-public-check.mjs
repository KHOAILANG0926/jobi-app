// Read-only public REST check. No SQL or privileged key, no browser.
// 공개 공고의 원본 근무지 점이 원래 행정구역(성) 안인가. 화면(메인·상세) 핀 집합은 deploy-verify의 map-summary-check가 점마다 지도를 옮겨 이미 검증한다
// (예전에는 여기서 기본 화면의 메인 핀을 읽었으나 지도는 화면 안 핀만 그려 항상 0개였다 — #728 R2 운영 검사 모순 해결).
import {supabaseServer as publicClient} from '../../src/lib/supabaseServer.ts'
import {administrativeBoundaryIssues} from './location-administrative-oracle.mjs'
try {
 const jobs=[]
 for(let from=0;;from+=500) {
  const {data,error}=await publicClient.from('local_jobs').select('id,location').eq('active',true).eq('admin_hidden',false).order('id').range(from,from+499).abortSignal(AbortSignal.timeout(15000))
  if(error)throw new Error('public_jobs_unavailable')
  jobs.push(...data)
  if(data.length<500)break
 }
 const locations=[]
 for(let from=0;from<jobs.length;from+=100) {
  const {data,error}=await publicClient.from('job_work_locations').select('id,job_id,raw_address,lat,lng,point_kind,point_precision,point_revision,location_verified').in('job_id',jobs.slice(from,from+100).map(j=>j.id)).abortSignal(AbortSignal.timeout(15000))
  if(error)throw new Error('public_source_points_unavailable')
  locations.push(...data)
 }
 const issues=administrativeBoundaryIssues(jobs,locations)
 console.log(JSON.stringify({kind:'read-only-live-public-source-boundary',jobs:jobs.length,rows:locations.length,unverifiedRows:locations.filter(w=>!w.location_verified).length,issues}))
 if(issues.length)process.exitCode=1
} catch(error) {
 console.log(JSON.stringify({kind:'read-only-live-public-source-boundary',verified:false,error:error.message}))
 process.exitCode=1
}
