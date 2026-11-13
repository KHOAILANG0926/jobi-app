import {administrativeAreaForTarget,areaContains,ADMINISTRATIVE_AREAS} from '../../src/lib/administrativeArea.ts'
import {sourcePoints} from './location-point-oracle.mjs'
// 도시 경계 자료가 없으면 전국 사각형 같은 것으로 대신하지 않고 original_boundary_unavailable로 실패한다.
// 방법 변경(#728 R2, 운영 검사 모순 해결): 예전에는 공개 지도의 메인·상세 핀을 여기서도 읽었으나 ① 메인 지도는 화면 안의 핀만 그리므로(homeMapClusters.ts) 기본 화면에서는 항상 0개 —
// 운영 실측: provider vietmap, 마커 0개, data-matched=0, 공고 23건 전부 missing_main_pin — ② 같은 일(원본↔캐시↔화면 핀 집합)을 점마다 지도를 옮겨 보는
// scripts/ops/map-summary-check.mjs(deploy-verify)가 이미 한다. 그래서 화면 핀 부분은 지우고(중복), 이 파일은 그 검사가 안 보는 '원래 행정구역 안인가'만 맡는다.
// 경계 기준은 원래 성(province) 경계다(Lee 2026-11-06 "원래 성 안", src/lib/administrativeArea.ts withinOriginalProvince). 시 대표점(trusted_city_representative)은
// 그 점 하나의 시 소속만 증명하는 자료라 다른 좌표의 경계 검사에 쓰면 전부 '밖'이 된다(#702, 2026-11-11 MediaMart 37 Lý Thái Tổ) — 같은 오류를 이 검사가 되풀이하고 있었다.
export function administrativeBoundaryIssues(jobs, locations, boundaryProvider=(text,job)=>administrativeAreaForTarget(text,job.location)) {
 const issues=[]
 for(const job of jobs) {
  const source=sourcePoints(locations.filter(w=>String(w.job_id)===String(job.id)))
  if(!source.length)issues.push({jobId:job.id,reason:'missing_canonical_pin'})
  for(const p of source) {
   const row=locations.find(w=>String(w.id)===String(p.workLocationId))
   const area=boundaryProvider(row?.raw_address||job.location,job)
   const province=area&&(area.parentKey?ADMINISTRATIVE_AREAS.find(a=>a.key===area.parentKey):area)
   if(!province)issues.push({jobId:job.id,reason:'original_boundary_unavailable'})
   else if(!areaContains(province,p))issues.push({jobId:job.id,reason:'outside_original_administrative_boundary',area:province.key})
  }
 }
 return issues
}
