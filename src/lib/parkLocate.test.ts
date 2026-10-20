import { parkNameFromAddresses, pickParkHit, parkPlaceOk } from './parkLocate.ts'
import { resolveAutoLocation } from './autoLocationResolver.ts'
function assert(c: boolean, m: string) { if (!c) throw new Error(`FAIL: ${m}`) }
// 실제 공고 #4824 주소(2026-10-20 운영 조회)
const p = parkNameFromAddresses(['KCN Yên Phong, Bắc Ninh', 'KCN YÊN PHONG'])!
assert(p.name === 'yen phong' && p.province === 'bac ninh' && p.searchText === 'Khu công nghiệp Yên Phong, Bắc Ninh', '#4824 park name')
assert(parkNameFromAddresses(['Khu phố Mao Yên, phường Phương Liễu, Bắc Ninh']) === null, 'khu phố is not a park')
const hits = [
  { ref_id: 'a', name: 'Khu công nghiệp Yên Phong', address: 'Long Châu, Yên Phong, Bắc Ninh' },
  { ref_id: 'b', name: 'Khu công nghiệp Yên Phong mở rộng', address: 'Bắc Ninh' },
  { ref_id: 'c', name: 'KCN Yên Phong II-A', address: 'Bắc Ninh' },
  { ref_id: 'd', name: 'Nhà hàng Yên Phong', address: 'Bắc Ninh' },
]
assert(pickParkHit(p, hits).hit?.ref_id === 'a', 'exact park name only (not mở rộng / II-A / restaurant)')
assert(pickParkHit(p, [hits[0], { ...hits[0], ref_id: 'z' }]).multiple, 'two same-name parks → do not guess')
assert(pickParkHit(p, [{ ref_id: 'x', name: 'Khu công nghiệp Yên Phong', address: 'Hà Nội' }]).hit === null, 'other province → no')
assert(!parkPlaceOk(p, { lat: 21.2, lng: 106.0, city: 'Hà Nội' }), 'place in other province → no')
assert(parkPlaceOk(p, { lat: 21.2, lng: 106.0, city: 'Tỉnh Bắc Ninh' }), 'place ok')
// 전체 흐름: 공단 표에 없는 KCN → 대략 위치 핀(area)
let calls = 0
const r = await resolveAutoLocation({ id: 4824, company: 'KDA', location: 'KCN Yên Phong, Bắc Ninh', targets: [{ address: 'KCN Yên Phong, Bắc Ninh', workLocationId: 1 }] }, {
  async cached() { return null }, async cache() {}, async reserve() { return true },
  async request(action) { calls++; return action === 'search' ? hits : { lat: 21.21, lng: 106.0, city: 'Bắc Ninh' } },
})
assert(r.kind === 'area' && (r as { source: string }).source === 'VietMap a (KCN)' && calls === 2, `#4824 → park area pin: ${JSON.stringify(r)}`)
// 실제 VietMap 응답(2026-10-20 14:40, research_artifacts map-r1-query): 같은 이름 2개 — 공단 POI(분류 6005)만 고른다
const real = [
  { ref_id: 'yt', name: 'Khu Công Nghiệp Yên Phong', address: 'Xã Yên Trung, Tỉnh Bắc Ninh', categories: [] },
  { ref_id: 'yp', name: 'Khu Công Nghiệp Yên Phong', address: 'Xã Yên Phong, Tỉnh Bắc Ninh', categories: ['6005'] },
  { ref_id: 'y1', name: 'Khu Công Nghiệp Yên Phong 1', address: 'Xã Yên Phong, Tỉnh Bắc Ninh', categories: ['6005'] },
  { ref_id: 'mr', name: 'Khu Công Nghiệp Yên Phong Mở Rộng', address: 'Xã Yên Trung, Tỉnh Bắc Ninh', categories: ['6005'] },
]
assert(pickParkHit(p, real).hit?.ref_id === 'yp', 'real VietMap result → park POI in Xã Yên Phong')
assert(pickParkHit(p, [real[0], { ...real[1], categories: [] }]).multiple, 'two plain results, no POI → do not guess')
console.log('parkLocate tests: all assertions passed')
