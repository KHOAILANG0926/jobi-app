import assert from 'node:assert/strict'
import {administrativeBoundaryIssues} from './location-administrative-oracle.mjs'
const jobs=[{id:22,location:'Bắc Ninh'},{id:45,location:'Hải Dương'}]
const location=(id,job_id,raw_address,lat,lng)=>({id,job_id,raw_address,lat,lng,point_kind:'area',point_precision:'area',point_revision:1})
const rows=[location(8,22,'Bắc Ninh',21.1861,106.0763),location(19,45,'Hải Dương',20.9613,106.364)]
assert.deepEqual(administrativeBoundaryIssues(jobs,rows),[])
assert.ok(administrativeBoundaryIssues(jobs,[]).some(i=>i.reason==='missing_canonical_pin'))
const outside=rows.map(w=>({...w,lat:14.0583,lng:108.2772}))
assert.equal(administrativeBoundaryIssues(jobs,outside).filter(i=>i.reason==='outside_original_administrative_boundary').length,2,'원래 성 밖의 점은 계속 실패로 잡음')
console.log('administrative oracle: province containment and outside-province detection passed')
// 시 이름만 적힌 주소: 예전에는 시 대표점과 같은 좌표 말고는 전부 실패(#702·2026-11-11 MediaMart 37 Lý Thái Tổ 사례) — 원래 성 경계로 판정
const cityJob=[{id:22,location:'TP. Bắc Ninh'}]
assert.deepEqual(administrativeBoundaryIssues(cityJob,[{...rows[0],raw_address:'TP. Bắc Ninh',lat:21.18608,lng:106.07632}]),[],'시 대표점과 같은 점')
assert.deepEqual(administrativeBoundaryIssues(cityJob,[{...rows[0],raw_address:'Số 37 Đường Lý Thái Tổ, P. Võ Cường, TP. Bắc Ninh',lat:21.1676,lng:106.0674}]),[],'같은 시의 다른 점(번지 단위)도 원래 성 안이면 통과')
assert.ok(administrativeBoundaryIssues(cityJob,[{...rows[0],raw_address:'Số 37 Đường Lý Thái Tổ, TP. Bắc Ninh',lat:14.0583,lng:108.2772}]).some(i=>i.reason==='outside_original_administrative_boundary'),'시 이름 주소라도 성 밖 점은 실패')
console.log('administrative oracle: city-named addresses use the original province boundary')
// 2026-11-18 El Gaucho(vieclam24h): 통합 뒤 주소 "(…, Bình Dương cũ)" + 지역 TP.HCM — 위치 확인 서버와 같은 성 고르기(originalProvinceFor)
const oldJob=[{id:70,location:'TP.HCM'}]
const oldAddr='Hikari Bình Dương, Phường Bình Dương (Thành phố Thủ Dầu Một | Thị xã Tân Uyên, Bình Dương cũ)'
assert.deepEqual(administrativeBoundaryIssues(oldJob,[location(90,70,oldAddr,11.05904,106.68454)]),[],'"cũ"로 적힌 옛 성 안의 점은 통과')
assert.ok(administrativeBoundaryIssues(oldJob,[location(90,70,oldAddr,21.1810,106.0705)]).some(i=>i.reason==='outside_original_administrative_boundary'),'옛 성 밖 점은 실패')
console.log('administrative oracle: post-2025 "X cũ" addresses use the old province boundary')
