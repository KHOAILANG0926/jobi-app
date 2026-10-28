import assert from 'node:assert/strict'
import {administrativePinIssues} from './location-administrative-oracle.mjs'
const jobs=[{id:22,location:'Bắc Ninh'},{id:45,location:'Hải Dương'}]
const location=(id,job_id,raw_address,lat,lng)=>({id,job_id,raw_address,lat,lng,point_kind:'area',point_precision:'area',point_revision:1})
const rows=[location(8,22,'Bắc Ninh',21.1861,106.0763),location(19,45,'Hải Dương',20.9613,106.364)]
const points=Object.fromEntries(rows.map(w=>[String(w.job_id),[{workLocationId:w.id,lat:w.lat,lng:w.lng,kind:'area',precision:'area',revision:1}]]))
assert.deepEqual(administrativePinIssues(jobs,rows,points,points),[])
assert.ok(administrativePinIssues(jobs,[],{},{}).some(i=>i.reason==='missing_canonical_pin'))
const outside=rows.map(w=>({...w,lat:14.0583,lng:108.2772}))
assert.equal(administrativePinIssues(jobs,outside,points,points).filter(i=>i.reason==='outside_original_administrative_boundary').length,2)
assert.ok(administrativePinIssues([{id:22,location:'TP. Bắc Ninh'}],[{...rows[0],raw_address:'TP. Bắc Ninh'}],points,points).some(i=>i.reason==='original_boundary_unavailable'))
assert.ok(administrativePinIssues(jobs,rows,points,{}).some(i=>i.reason==='missing_detail_pin'))
console.log('administrative oracle: nonempty main/detail/source sets, province containment and unavailable city evidence passed')

const cityRow={...rows[0],raw_address:'TP. Bắc Ninh',lat:21.18608,lng:106.07632}
const cityPoints={'22':[{...points['22'][0],lat:cityRow.lat,lng:cityRow.lng}]}
assert.deepEqual(administrativePinIssues([{id:22,location:'TP. Bắc Ninh'}],[cityRow],cityPoints,cityPoints),[])
