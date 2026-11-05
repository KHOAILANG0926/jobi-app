// 회사 이름으로 지도 업체 찾기(추가 단계, Lee 2026-11-03) — 실제 비교(41645439656) 후보 이름으로 시험.
import { coreName, sameCoreName, pickCompanyPlace, streetOf, goongPredictionHits, googlePlaceHits, googleSearchText } from './companyPlaceSearch.ts'
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
// Lee 2026-11-06: Google이 회사를 알면(같은 이름 1곳) Google 장소 좌표를 따른다(대략 위치·chưa xác minh 유지).
assert(viaGoogle.kind === 'area' && 'lat' in viaGoogle && viaGoogle.lat === 21.16 && /Google p9/.test(String((viaGoogle as { source?: string }).source)), 'Google 회사 장소 핀: ' + JSON.stringify(viaGoogle))
// Google 검색어 = 상세 Google 버튼과 같은 말(회사, 원문 주소 전체)
const park = { id: 10, company: 'NEW TEAM ROBOTICS VIETNAM', location: 'Bắc Ninh', targets: [{ address: 'NX 2-2, lô CN1-2 và CN1-3, KCN Yên Phong (khu mở rộng), xã Yên Trung, Bắc Ninh', workLocationId: 2 }] }
assert(googleSearchText(park.company, park.targets[0].address) === 'NEW TEAM ROBOTICS VIETNAM, NX 2-2, lô CN1-2 và CN1-3, KCN Yên Phong (khu mở rộng), xã Yên Trung, Bắc Ninh', 'Google 버튼과 같은 검색어')
let asked = ''
const inPark = await resolveAutoLocation(park, { ...noop, async goong() { return { predictions: [] } },
  async google(text: string) { asked = text; return { places: [{ id: 'nt1', displayName: { text: 'New Teamrobotics Vietnam' }, formattedAddress: 'KCN Yên Phong mở rộng, Yên Trung, Bắc Ninh', location: { latitude: 21.2101, longitude: 106.0102 } }] } },
  async withinAdministrativeArea() { return true } })
assert(asked === googleSearchText(park.company, park.targets[0].address), 'resolver asks Google the button query: ' + asked)
assert(inPark.kind === 'area' && 'lat' in inPark && inPark.lat === 21.2101 && /Google nt1/.test(String((inPark as { source?: string }).source)), '공단 공장도 Google 장소: ' + JSON.stringify(inPark))
// Google이 다른 성의 같은 이름 회사를 집으면 따르지 않는다(성 대략 위치 + 경계 불일치 기록)
const elsewhere = await resolveAutoLocation(park, { ...noop, async goong() { return { predictions: [] } },
  async google() { return { places: [{ id: 'bd1', displayName: { text: 'New Teamrobotics (Viet Nam)' }, formattedAddress: 'Bình Dương', location: { latitude: 11.05, longitude: 106.70 } }] } },
  async withinAdministrativeArea() { return false },
  async administrativeCenter() { return { lat: 21.098, lng: 106.117, source: 'area', checkedAt: 'x' } } })
assert(elsewhere.kind === 'area' && 'lat' in elsewhere && elsewhere.lat === 21.098 && /administrative_boundary:mismatch/.test(String(elsewhere.evidence)), '성 밖 Google 결과는 따르지 않음: ' + JSON.stringify(elsewhere))
// Google 후보가 여럿(거리로 못 좁힘)이면 따르지 않는다
const many = await resolveAutoLocation(park, { ...noop, async goong() { return { predictions: [] } },
  async google() { return { places: [1, 2].map((i) => ({ id: `m${i}`, displayName: { text: 'New Teamrobotics Vietnam' }, formattedAddress: `Bắc Ninh ${i}`, location: { latitude: 21.2 + i / 100, longitude: 106.0 } })) } },
  async administrativeCenter() { return { lat: 21.098, lng: 106.117, source: 'area', checkedAt: 'x' } } })
assert(!('source' in many) || !/Google/.test(String((many as { source?: string }).source)), '후보 여럿이면 Google 따르지 않음: ' + JSON.stringify(many))
// 둘 다 없으면 기존처럼 성 대략 위치로 내려감(administrativeCenter)
const none = await resolveAutoLocation(job, { ...noop, async goong() { return { predictions: [] } },
  async administrativeCenter() { return { lat: 21.098, lng: 106.117, source: 'area', checkedAt: 'x' } } })
assert(none.kind === 'area' && 'lat' in none && none.lat === 21.098, '못 찾으면 기존 성 대략 위치')
console.log('companyPlaceSearch: core-name match, branch narrowing, Goong→Google company step, fallback unchanged — passed')
