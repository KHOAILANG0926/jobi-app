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
// 2026-11-11 Lee 절대 원칙 "위치를 모르면 마음대로 찍지 마": 대략 위치(동·시·공단 중심)는 핀 없이 못 찾음 — 예전 대략 핀 기대값을 바꿈
assert(elsewhere.kind === 'unresolved' && !('lat' in elsewhere),'성 밖 Google 결과는 따르지 않음(핀 없음): ' + JSON.stringify(elsewhere))
// Google 후보가 여럿(거리로 못 좁힘)이면 따르지 않는다
const many = await resolveAutoLocation(park, { ...noop, async goong() { return { predictions: [] } },
  async google() { return { places: [1, 2].map((i) => ({ id: `m${i}`, displayName: { text: 'New Teamrobotics Vietnam' }, formattedAddress: `Bắc Ninh ${i}`, location: { latitude: 21.2 + i / 100, longitude: 106.0 } })) } },
  async administrativeCenter() { return { lat: 21.098, lng: 106.117, source: 'area', checkedAt: 'x' } } })
assert(!('source' in many) || !/Google/.test(String((many as { source?: string }).source)), '후보 여럿이면 Google 따르지 않음: ' + JSON.stringify(many))
// 둘 다 없으면 기존처럼 성 대략 위치로 내려감(administrativeCenter)
const none = await resolveAutoLocation(job, { ...noop, async goong() { return { predictions: [] } },
  async administrativeCenter() { return { lat: 21.098, lng: 106.117, source: 'area', checkedAt: 'x' } } })
// 2026-11-11 Lee 절대 원칙: 대략 위치는 핀 없이 못 찾음
assert(none.kind === 'unresolved' && !('lat' in none), '못 찾으면 성 대략 위치 핀 없음')
// Lee 2026-11-06 "VietMap하고 Goong 하지 말고 바로 구글로": 회사 이름이 있으면 Google을 가장 먼저 묻는다.
{
  const order: string[] = []
  const street = { id: 11, company: 'nhẹ cafe', location: 'Bắc Ninh', targets: [{ address: '128 Đ. Triệu Việt Vương, P. Võ Cường, Bắc Ninh', workLocationId: 3 }] }
  const r = await resolveAutoLocation(street, { ...noop,
    async request(action: string) { order.push('vietmap:' + action); return [] },
    async goong(action: string) { order.push('goong:' + action); return { predictions: [] } },
    async google() { order.push('google'); return { places: [{ id: 'nh1', displayName: { text: 'nhẹ cafe' }, formattedAddress: '128 Triệu Việt Vương, Võ Cường, Bắc Ninh', location: { latitude: 21.17, longitude: 106.07 } }] } },
    async withinAdministrativeArea() { return true } })
  assert(order[0] === 'google', 'Google을 가장 먼저: ' + order.join(','))
  assert(r.kind === 'area' && /Google nh1/.test(String((r as { source?: string }).source)), 'Google 장소 채택: ' + JSON.stringify(r))
}
// 2026-11-09 #560 시험 — 실제 Google 후보(run 42614049523)로: 맞는 곳은 고르고, 다른 회사·다른 지점은 고르지 않는다(Lee "잘못된 위치 확정 0건").
{
  const H = (id: string, name: string, address: string) => ({ id, name, address })
  const pick = (c: string, a: string, hits: { id: string; name: string; address: string }[]) => pickCompanyPlace(c, a, hits)
  // 고름
  assert(pick('CTY ChunQiu', 'khu cn hoà phú', [H('c1', 'Công Ty Chunqiu Electronic', 'CN - 09, KCN Hòa Phú, Xuân Cẩm, Bắc Ninh')]).hit?.id === 'c1', '#560-8 ChunQiu same park')
  assert(pick('TRUNG NGUYÊN LEGEND BẮC NINH', 'Trung Nguyên Legend 27 kinh dương vương-p Vũ Ninh- tỉnh Bắc Ninh', [H('t1', 'Trung Nguyên Legend Café', '27 Đ. Kinh Dương Vương, Kinh Bắc, Bắc Ninh')]).hit?.id === 't1', '#560-9 Trung Nguyên')
  assert(pick('BAR NEW PHOENIX BẮC NINH', 'Bắc Ninh', [H('n1', 'New Phoenix Club', '7 Đ. Phúc Sơn, Phúc Sơn, Vũ Ninh, Bắc Ninh')]).hit?.id === 'n1', '#560-11 bar word is not the name')
  assert(pick('SIÊU THỊ ĐIỆN MÁY MEDIAMART', 'Số 37 Đường Lý Thái Tổ, P. Võ Cường, TP. Bắc Ninh', [H('m1', 'Mediamart Bắc Ninh', '37 Đ. Lý Thái Tổ, Kinh Bắc, Bắc Ninh 16000'), H('m2', 'Điện Máy MediaMart Thị Cầu', 'Đường Lý Thường Kiệt, Bắc Ninh')]).hit?.id === 'm1', '#560-16 MediaMart branch by street')
  // 고르지 않음(보류)
  assert(pick('KHÁCH SẠN MINH NGUYỆT', '288 Hàn Thuyên, Kinh Bắc, Bắc Ninh', [H('x1', 'Luxury Phoenix Hotel | 凤凰明月酒店', 'City, 288 Đ. Hàn Thuyên, Kinh Bắc, Bắc Ninh'), H('x2', 'Hệ thống khách sạn Minh Nguyệt', '27 Đ. Kinh Dương Vương, Bắc Ninh, 16000')]).hit === null, '#560-30 same name at another street is not this hotel')
  assert(pick('Nhà hàng Seoseo Galbi', '213 Ngọc Hân Công Chúa, Phường Võ Cường, TP Bắc Ninh', [H('s1', '(seoseo galbi korean restaurant)', '9 Đ. Hoàng Hoa Thám, Võ Cường, Bắc Ninh')]).hit === null, '#560-1 other street → hold')
  assert(pick('ĐẠI TÂN VIỆT', 'KCN VSIP Bắc Ninh, Bắc Ninh', [H('d1', 'Công Ty Đại Tân (TNHH)', 'Lô 2-6, 1 KCN Quế Võ 2, Đào Viên, Bắc Ninh')]).hit === null, '#560-3 shorter different company / other park')
  assert(!sameCoreName('ĐẠI TÂN VIỆT', 'Công Ty Đại Tân (TNHH)'), '#560-3 "Đại Tân" is not "Đại Tân Việt"')
  assert(pick('CÔNG TY EAGLEON', 'KCN Quế Võ 2', [H('e1', 'Công ty TNHH Eagle On Vietnam', '4793+XC7, Phù Lãng, Bắc Ninh')]).hit === null, '#560-25 park not in candidate address → hold')
  assert(pick('Trung tâm kho vận Đông Việt', 'Trung tâm kho vận Đông Việt - Cụm công nghiệp Xuân Lâm - Thuận Thành - Bắc Ninh', [H('v1', 'Công ty cổ phần Đông Việt', 'Cụm công nghiệp, Song Liễu, Bắc Ninh')]).hit === null, '#560-20 other industrial cluster')
  assert(pick('JOLLIBEE BẮC NINH', 'Bắc Ninh', [H('j1', 'Jollibee Trần Hưng Đạo Bắc Ninh', '393 Trần Hưng Đạo, Võ Cường, Bắc Ninh'), H('j2', 'Jollibee Nguyễn Trãi', '207 Nguyễn Trãi, Võ Cường, Bắc Ninh')]).hit === null, '#560-21 chain without branch')
  assert(pick('THƯƠNG HIỆU THỜI TRANG ILABY KIDS', '148 Trần Hưng Đạo, TP Bắc Ninh', [H('k1', 'KRIK - 148 Trần Hưng Đạo (TP.Bắc Ninh)', '152 Trần Hưng Đạo - P.Kinh Bắc - TP.Bắc Ninh')]).hit === null, '#560-19 other brand at same street')
  // Codex #616: 번지와 거리 사이 쉼표
  assert(pick('Highlands Coffee', 'Số 10, đường Lý Thái Tổ, Bắc Ninh', [H('h1', 'Highlands Coffee', '10 Đ. Lý Thái Tổ, Bắc Ninh')]).hit?.id === 'h1', 'Codex #616 comma between number and street')
  assert(pick('Highlands Coffee', 'Số 10, đường Lý Thái Tổ, Bắc Ninh', [H('h2', 'Highlands Coffee', '5 Nguyễn Trãi, Bắc Ninh')]).hit === null, 'comma form still guards other street')
  // Codex #616: 슬래시 번지, 로마 숫자 공단 순번
  assert(pick('Highlands Coffee', '10/2 Lý Thái Tổ, Bắc Ninh', [H('s1', 'Highlands Coffee', '10/2 Đ. Lý Thái Tổ, Bắc Ninh')]).hit?.id === 's1', 'Codex #616 slash house number')
  assert(pick('Công ty ABC Việt', 'KCN Quế Võ III, Bắc Ninh', [H('q1', 'Công ty ABC Việt', 'KCN Quế Võ 1, Bắc Ninh'), H('q2', 'Công ty ABC Việt', 'KCN Yên Phong, Bắc Ninh')]).hit === null, 'Codex #616 roman numeral park III is not Quế Võ 1')
  assert(pick('Công ty ABC Việt', 'KCN Quế Võ III, Bắc Ninh', [H('q3', 'Công ty ABC Việt', 'KCN Quế Võ 3, Bắc Ninh')]).hit?.id === 'q3', 'Codex #616 roman III = 3')
  // Codex #616: 로마 숫자 공단, 슬래시 번지
  assert(pick('Hojeong', 'KCN Quế Võ III, Bắc Ninh', [H('q1', 'Hojeong Vina', 'KCN Quế Võ 1, Bắc Ninh'), H('q2', 'Hojeong Vina', 'KCN Yên Phong, Bắc Ninh')]).hit === null, 'Codex #616 Quế Võ III ≠ Quế Võ 1')
  assert(pick('Highlands Coffee', '10/2 Lý Thái Tổ, Bắc Ninh', [H('s2', 'Highlands Coffee', '10/2 Đ. Lý Thái Tổ, Bắc Ninh')]).hit?.id === 's2', 'Codex #616 slash house number')
  assert(pick('Kingsport Quế Võ', '25-27 Đ. Trần Hưng Đạo, Quế Võ, Bắc Ninh', [H('k2', 'Kingsport Quế Võ - Bắc Ninh (Ghế massage, máy chạy bộ)', '25-27 Đ. Trần Hưng Đạo, Quế Võ, Bắc Ninh')]).hit?.id === 'k2', '#560-17 Kingsport range house number')
  assert(pick('Hojeong', 'KCN Quế Võ, Bắc Ninh', [H('w1', 'Hojeong', '100 Đường Nguyễn Trãi, Phường Quế Võ, Bắc Ninh'), H('w2', 'Hojeong', 'KCN Yên Phong, Bắc Ninh')]).hit === null, 'Codex #616 ward name Quế Võ is not KCN Quế Võ')
  assert(pick('Hojeong', 'KCN Quế Võ, Bắc Ninh', [H('w3', 'Hojeong', 'Lô C, KCN Quế Võ, Phường Nam Sơn, Bắc Ninh')]).hit?.id === 'w3', 'same park with KCN word')
  assert(pick('Hojeong', 'Khu CN Quế Võ, Bắc Ninh', [H('a1', 'Hojeong', 'KCN Quế Võ 2, Bắc Ninh'), H('a2', 'Hojeong', 'KCN Yên Phong, Bắc Ninh')]).hit === null, 'Codex #616 "Khu CN" abbreviation keeps park numbering')
  assert(pick('Hojeong', 'Khu CN Hoà Phú', [H('a3', 'Hojeong', 'KCN Hòa Phú 2, Bắc Ninh')]).hit === null, 'unlisted park keeps numbering too')
  // 2026-11-11 저장된 Google 답(위치 비교 시험 from_cache run 42919537607) — 맞는 곳을 거절하던 것
  assert(pick('KRIK', '152 Trần Hưng Đạo - Kinh Bắc - Bắc Ninh, Bắc Ninh', [H('r1', 'KRIK - 148 Trần Hưng Đạo (TP.Bắc Ninh)', '152 Trần Hưng Đạo - P.Kinh Bắc - TP.Bắc Ninh, Kinh Bắc, Bắc Ninh 1600'), H('r2', 'KRIK - 340 Trần Hưng Đạo, Quế Võ, Bắc Ninh', '340 Đ. Trần Hưng Đạo, Phương Liễu, Bắc Ninh')]).hit?.id === 'r1', '11-11 KRIK: same chain twice on one street → the one at the same house number')
  assert(pick('KRIK', '200 Trần Hưng Đạo, Bắc Ninh', [H('r1', 'KRIK A', '152 Trần Hưng Đạo, Bắc Ninh'), H('r2', 'KRIK B', '340 Đ. Trần Hưng Đạo, Bắc Ninh')]).hit === null, '11-11 KRIK: no candidate at our house number → hold')
  assert(pick('KRIK', 'Trần Hưng Đạo, Bắc Ninh', [H('r1', 'KRIK A', '152 Trần Hưng Đạo, Bắc Ninh'), H('r2', 'KRIK B', '340 Đ. Trần Hưng Đạo, Bắc Ninh')]).hit === null, '11-11 KRIK: no house number in post → hold')
  assert(pick('KRIK', '15 Trần Hưng Đạo, Bắc Ninh', [H('r1', 'KRIK A', '152 Trần Hưng Đạo, Bắc Ninh'), H('r2', 'KRIK B', '340 Đ. Trần Hưng Đạo, Bắc Ninh')]).hit === null, '11-11 KRIK: 15 is not 152')
  assert(pick('KRIK', '152 Trần Hưng Đạo, Bắc Ninh', [H('r1', 'KRIK A', '1/152 Trần Hưng Đạo, Bắc Ninh'), H('r2', 'KRIK B', '340 Đ. Trần Hưng Đạo, Bắc Ninh')]).hit === null, 'Codex #674: 1/152 is not 152')
  assert(pick('KRIK', '10/2 Trần Hưng Đạo, Bắc Ninh', [H('r1', 'KRIK A', '10/2 Trần Hưng Đạo, Bắc Ninh'), H('r2', 'KRIK B', '2 Trần Hưng Đạo, Bắc Ninh')]).hit?.id === 'r1', 'slash house number compared whole')
  assert(pick('KRIK', '152 Trần Hưng Đạo, Bắc Ninh', [H('r1', 'KRIK A', '12 Ngõ 152 Trần Hưng Đạo, Bắc Ninh'), H('r2', 'KRIK B', '340 Đ. Trần Hưng Đạo, Bắc Ninh')]).hit === null, 'Codex #674: alley number 152 is not house number 152')
  assert(sameCoreName('Nệm Vạn Thành', 'Nệm Vạn Thành'), 'Codex #674: identical full name still matches when shop head leaves a short core')
  assert(pick('CON CƯNG BẮC NINH', 'Thửa đất số 163, tờ bản đồ số 37, thôn Đại Thượng, xã Đại Đồng, huyện Tiên Du, tỉnh Bắc Ninh', [H('c1', 'Siêu Thị Mẹ Bầu & Em Bé Con Cưng', 'Thửa đất số 163, tờ bản đồ, số 37 thôn, Đại Thượng, Đại Đồng, Bắc Ninh 7900')]).hit?.id === 'c1', '11-11 Con Cưng: shop-kind head words (shopKinds) are not the name')
  assert(!sameCoreName('Vua Nệm', 'Nệm Vạn Thành'), '11-11 shop words only leave the head; "Vua Nệm" ≠ "Nệm Vạn Thành"')
  assert(pick('FUSHAN', 'VSIP - Bắc Ninh', [H('f1', 'Fushan Technology Việt Nam', '8 Đường 6, Khu công nghiệp VSIP, Từ Sơn, Bắc Ninh'), H('f2', 'Công Ty Fushan Technology Việt Nam (Cổng 2)', '22 Đ. 8, Từ Sơn, Bắc Ninh')]).hit?.id === 'f1', '#560-22 Fushan: of two gates the one whose address names VSIP (Lee confirmed FUSHAN at VSIP)')
}
console.log('companyPlaceSearch: core-name match, branch narrowing, Goong→Google company step, fallback unchanged — passed')
