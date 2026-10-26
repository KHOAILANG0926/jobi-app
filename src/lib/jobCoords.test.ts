import { findRegionCenter, resolveWorkLocationQuery, externalMapLinks, canonicalWorkLocationPoint, resolveMapLocations, resolveDistanceSearchPoints, verifiedWorkLocationPoint, workLocationExternalLinks, calcDistanceKm, formatDistanceLabel } from './jobCoords.ts'
import { locationPoints } from './mapR1.ts'
import { rowToWorkLocation } from './jobRows.ts'
import type { Job } from '../types/job.ts'
function equal(actual: unknown, expected: unknown, label: string) { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`) }
const rows = [
  {id:1,raw_address:'Source site',lat:21.1,lng:105.9,point_kind:'exact',location_verified:true,point_precision:'site',point_revision:4,point_evidence:{source:'admin approval',checkedAt:'2026-10-26'}},
  {id:2,raw_address:'Source area',lat:21.2,lng:106,point_kind:'area',location_verified:false,point_precision:'ward',point_revision:2,point_evidence:{source:'provider',checkedAt:'2026-10-25'}},
  {id:3,raw_address:'Source gate',lat:21.3,lng:106.1,point_kind:'gate',point_precision:'entrance',point_revision:1,point_evidence:{source:'gate survey',checkedAt:'2026-10-24'}},
  {id:4,raw_address:'Unresolved',point_kind:'unresolved'},
]
const locations = rows.map(rowToWorkLocation)
const job = {id:'synthetic',company:'Source',rawLocation:'KCN VSIP, Bắc Ninh',workLocations:locations} as Job
const points = resolveMapLocations(job).points
equal(points.length, 3, 'mixed multi-site preserves exact + area + gate')
equal(points.map(p => p.precise), [true,false,false], 'precision stays per workplace')
equal(points.map(p => p.workLocationId), [1,2,3], 'source row identity survives mapping')
equal(points[0].revision,4,'revision survives mapping')
equal(points[0].source,'admin approval','evidence survives mapping')
equal(locationPoints(job, {synthetic:{lat:20,lng:104,kind:'area',source:'stale cache',checkedAt:'old'}}).map(p => [p.lat,p.lng,p.kind]), rows.slice(0,3).map(r=>[r.lat,r.lng,r.point_kind]),'main map ignores cache and uses source set')
equal(resolveDistanceSearchPoints(job).map(p=>[p.lat,p.lng,p.precise]), points.map(p=>[p.lat,p.lng,p.precise]), 'distance uses same full source set')
equal(verifiedWorkLocationPoint(locations[0]),{lat:21.1,lng:105.9},'verified exact source is precise')
equal(verifiedWorkLocationPoint(locations[1]),null,'area remains unverified')
equal(workLocationExternalLinks(locations[0])?.directions?.endsWith('destination=21.1,105.9'),true,'directions uses source exact point')
equal(workLocationExternalLinks(locations[2])?.directions?.endsWith('destination=21.3,106.1'),true,'gate directions uses source gate point')
equal(workLocationExternalLinks(locations[1])?.directions,null,'area cannot become confirmed directions')
for (const loc of [
 {rawAddress:'KCN VSIP, Bắc Ninh'},
 {rawAddress:'Legacy',lat:21,lng:106,locationVerified:true},
 {rawAddress:'Candidate overlay',approvedPoint:{lat:21,lng:106,placePrecision:'site' as const}},
 {rawAddress:'Unresolved',lat:21,lng:106,pointKind:'unresolved' as const},
 {rawAddress:'Invalid',lat:99,lng:106,pointKind:'area' as const},
]) equal(canonicalWorkLocationPoint(loc),null,'no independent legacy/candidate/region point')
equal(resolveMapLocations({rawLat:21,rawLng:106,rawLocation:'Bắc Ninh',recruitmentRegions:['Hà Nội']}).points,[],'no code-generated region or legacy pins')
equal(formatDistanceLabel(calcDistanceKm(21,106,21,106),false),'~0.0 km đường chim bay','approximate distance retains warning')
console.log('jobCoords: canonical mixed source sets, provenance, directions, precision and no overlays passed')

// Unchanged camera/text/link utilities retain their independent regressions.
equal(resolveWorkLocationQuery({rawAddress:'Area (vị trí gần đúng)',normalizedAddress:'Area'},'Bắc Ninh'),'Area, Bắc Ninh, Vietnam','text links prefer cleaned address and retain country')
equal(resolveWorkLocationQuery({rawAddress:'Hưng Yên',normalizedAddress:''},'  '),'Hưng Yên, Vietnam','empty normalization and province retain raw text')
equal(findRegionCenter('unknown place'),null,'unknown camera region cannot invent a point')
equal(findRegionCenter('Bắc Ninh'),{lat:21.1861,lng:106.0763},'known region remains camera context')
equal(externalMapLinks({lat:NaN,lng:106},true),null,'invalid external coordinate rejected')
equal(externalMapLinks({lat:21,lng:106},false)?.viewKind,'area','unverified external view remains area only')
equal(externalMapLinks({lat:21,lng:106},false)?.directions,null,'unverified external view never exposes confirmed directions')
equal(formatDistanceLabel(1.234),'1.2 km đường chim bay','exact distance remains straight-line label')
