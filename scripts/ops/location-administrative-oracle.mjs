import {administrativeAreaForTarget,areaContains,ADMINISTRATIVE_AREAS} from '../../src/lib/administrativeArea.ts'
import {assertPoints,sourcePoints} from './location-point-oracle.mjs'
// Caller supplies points read from the real main and detail map. The default
// provider only proves original provincial containment; missing city boundaries
// fail explicitly. Never let a nationwide bounding box count as area evidence.
export function administrativePinIssues(jobs, locations, mainPoints, detailPoints, boundaryProvider=(text,job)=>administrativeAreaForTarget(text,job.location)) {
 const issues=[]
 for(const job of jobs) {
  const source=sourcePoints(locations.filter(w=>String(w.job_id)===String(job.id)))
  const main=mainPoints[String(job.id)]??[], detail=detailPoints[String(job.id)]??[]
  if(!source.length)issues.push({jobId:job.id,reason:'missing_canonical_pin'})
  for(const [view,points] of [['main',main],['detail',detail]]) {
   if(!points.length)issues.push({jobId:job.id,reason:`missing_${view}_pin`})
   try{assertPoints(source,points,view)}catch{issues.push({jobId:job.id,reason:`${view}_source_mismatch`})}
  }
  for(const p of source) {
   const row=locations.find(w=>String(w.id)===String(p.workLocationId))
   const area=boundaryProvider(row?.raw_address||job.location,job)
   if(!area)issues.push({jobId:job.id,reason:'original_boundary_unavailable'})
   else if(!areaContains(area,p)) {
    const province=area.parentKey && ADMINISTRATIVE_AREAS.find(a=>a.key===area.parentKey)
    const unproven=area.proofType==='trusted_city_representative' && province && areaContains(province,p)
    issues.push({jobId:job.id,reason:unproven?'original_boundary_unavailable':'outside_original_administrative_boundary',area:area.key})
   }
  }
 }
 return issues
}
