// @ts-nocheck
import assert from 'node:assert/strict'
import { createMapLocationsHandler } from './map-locations.js'
const rows = [{job_id:7,source_points:[
 {workLocationId:31,kind:'exact',lat:21,lng:106,precision:'site',revision:3,source:'source row',checkedAt:'2026-10-26'},
 {workLocationId:32,kind:'area',lat:21.1,lng:106.1,precision:'ward',revision:1,source:'source row',checkedAt:'2026-10-25'},
 {workLocationId:33,kind:'gate',lat:99,lng:106,precision:'entrance',revision:1},
]}, {job_id:8,result:{kind:'area',lat:21,lng:106,source:'provider',checkedAt:'old'}}]
const handler = createMapLocationsHandler({read:async()=>rows})
const res = {code:0,body:null,setHeader(){},status(code){this.code=code;return this},json(body){this.body=body;return this}}
await handler({method:'GET',query:{ids:'7,8'}},res)
assert.equal(res.code,200)
assert.equal(res.body.points['sb-7'].length,2,'full mixed source set returned')
assert.equal(res.body.points['sb-7'][0].revision,3)
assert.deepEqual(res.body.points['sb-8'],[],'legacy provider result cannot become source')
await handler({method:'GET',query:{ids:'0'}},res)
assert.equal(res.code,400)
console.log('map-locations: canonical full source sets, invalid bounds and legacy result exclusion passed')
