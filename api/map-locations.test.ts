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
// Lee 2026-11-23 지도 위치 절대 원칙: 공개 위치 요약(핀 원천)은 확정 좌표(exact·gate)만 — 대략 위치(area)는 원본·캐시에 남아도 핀으로 내보내지 않는다(#990, 공고 5599 캐시/원본 불일치).
assert.deepEqual(res.body.points['sb-7'].map(p=>p.workLocationId),[31],'confirmed exact only: area row 32 withheld, out-of-bounds gate 33 rejected')
assert.equal(res.body.points['sb-7'][0].revision,3)
assert.deepEqual(res.body.points['sb-8'],[],'legacy provider result cannot become source')
await handler({method:'GET',query:{ids:'0'}},res)
assert.equal(res.code,400)
console.log('map-locations: confirmed-only source sets (area withheld), invalid bounds and legacy result exclusion passed')
