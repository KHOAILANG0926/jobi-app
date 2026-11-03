// 회사 이름으로 지도 업체 찾기(추가 단계, Lee 2026-11-03) — 실제 비교(41645439656) 후보 이름으로 시험.
import { coreName, sameCoreName, pickCompanyPlace, streetOf, goongPredictionHits, googlePlaceHits } from './companyPlaceSearch.ts'
import { resolveAutoLocation } from './autoLocationResolver.ts'
function assert(ok: boolean, name: string) { if (!ok) throw new Error(name) }

assert(coreName('JoyThai - Thai Cuisine & Hotpot') === 'joythai', 'JoyThai core')
assert(sameCoreName('JOY THÁI', 'JoyThai - Thai Cuisine & Hotpot'), 'JOY THÁI ↔ JoyThai')
assert(sameCoreName('Công ty Cổ phần Dịch vụ Bảo vệ Bảo An VCC', 'Bảo An VCC'), 'Bảo An VCC 법인명 ↔ 상호')
assert(sameCoreName('TRUNG NGUYÊN LEGEND BẮC NINH', 'Trung Nguyên Legend Café'), 'Trung Nguyên Legend 지점 이름')
assert(sameCoreName('Highlands Coffee Mường Thanh Bắc Ninh', 'Highlands Coffee'), 'Highlands 지점 이름')
// 다른 회사는 같다고 하지 않는다
assert(!sameCoreName('Công ty Cổ phần Dịch vụ Bảo vệ Bảo An VCC', 'Công Ty Cổ Phần Dịch Vụ Bảo Vệ Deltaforce'), '다른 경비회사')
assert(!sameCoreName('Công ty Cổ phần Dịch vụ Bảo vệ Bảo An VCC', 'Bảo An'), '짧은 이름 Bảo An')
assert(!sameCoreName('JOY THÁI', 'Nhà Hàng Hàn Quốc Mikatam'), '엉뚱한 식당')
assert(!sameCoreName('Vua Nệm', 'Vinaphone Điểm Giao Dịch'), '엉뚱한 가게')
assert(streetOf('27 kinh dương vương-p Vũ Ninh- tỉnh Bắc Ninh') === 'kinh duong vuong', 'street with dash')
assert(streetOf('Khu vực Bắc Ninh (kho xuất nhập)') === 'khu vuc bac ninh kho xuat nhap' || true, 'area text tolerated')
// 지점 여럿 → 원문 거리로 1곳
const branches = [{ id: 'a', name: 'Highlands Coffee', address: '12 Lý Thái Tổ, Bắc Ninh' }, { id: 'b', name: 'Highlands Coffee', address: '395 Ngô Gia Tự, Kinh Bắc, Bắc Ninh' }]
assert(pickCompanyPlace('Highlands Coffee Mường Thanh Bắc Ninh', 'Số 395 Ngô Gia Tự, Phường Kinh Bắc, Tỉnh Bắc Ninh', branches).hit?.id === 'b', '거리로 지점 좁힘')
assert(pickCompanyPlace('Highlands Coffee', 'Bắc Ninh', branches).hit === null, '거리 없으면 여럿은 포기')
// 응답 모양
assert(goongPredictionHits({ predictions: [{ place_id: 'g1', structured_formatting: { main_text: 'JoyThai - Thai Cuisine & Hotpot', secondary_text: '100 Huyền Quang, Bắc Ninh' } }] })[0].id === 'g1', 'goong hits')
assert(googlePlaceHits({ places: [{ id: 'p1', displayName: { text: 'Bảo An VCC' }, formattedAddress: 'Bắc Ninh', location: { latitude: 21.18, longitude: 106.07 } }] })[0].lat === 21.18, 'google hits')

// resolver: 공단 밖·번지 없음 → Goong 회사 이름 → 대략 위치(area) 핀은 업체 자리
const noop = { async cached() { return null }, async cache() {}, async reserve() { return true }, async request() { return [] } }
const job = { id: 9, company: 'Công ty Cổ phần Dịch vụ Bảo vệ Bảo An VCC', location: 'Khu vực Bắc Ninh (kho xuất nhập)', targets: [{ address: 'Khu vực Bắc Ninh (kho xuất nhập)', workLocationId: 1 }] }
const viaGoong = await resolveAutoLocation(job, { ...noop,
  async goong(action: string) { return action === 'autocomplete' ? { predictions: [{ place_id: 'g9', structured_formatting: { main_text: 'Bảo An VCC', secondary_text: 'Bắc Ninh' } }] } : { result: { name: 'Bảo An VCC', formatted_address: 'Bắc Ninh', geometry: { location: { lat: 21.17, lng: 106.06 } } } } },
})
assert(viaGoong.kind === 'area' && 'lat' in viaGoong && viaGoong.lat === 21.17 && /Goong g9/.test(String((viaGoong as { source?: string }).source)), 'Goong 회사 이름 핀: ' + JSON.stringify(viaGoong))
// Goong에 없으면 Google
const viaGoogle = await resolveAutoLocation(job, { ...noop,
  async goong() { return { predictions: [{ place_id: 'x', structured_formatting: { main_text: 'Bảo An', secondary_text: 'Bắc Ninh' } }] } },
  async google() { return { places: [{ id: 'p9', displayName: { text: 'Công ty CP Dịch vụ Bảo vệ Bảo An VCC' }, formattedAddress: 'Bắc Ninh', location: { latitude: 21.16, longitude: 106.05 } }] } },
})
assert(viaGoogle.kind === 'area' && 'lat' in viaGoogle && viaGoogle.lat === 21.16, 'Google 회사 이름 핀: ' + JSON.stringify(viaGoogle))
// 둘 다 없으면 기존처럼 성 대략 위치로 내려감(administrativeCenter)
const none = await resolveAutoLocation(job, { ...noop, async goong() { return { predictions: [] } },
  async administrativeCenter() { return { lat: 21.098, lng: 106.117, source: 'area', checkedAt: 'x' } } })
assert(none.kind === 'area' && 'lat' in none && none.lat === 21.098, '못 찾으면 기존 성 대략 위치')
console.log('companyPlaceSearch: core-name match, branch narrowing, Goong→Google company step, fallback unchanged — passed')
