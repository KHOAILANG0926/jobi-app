import { administrativeArea, areaContains, ADMINISTRATIVE_AREAS, administrativeAreaForTarget } from './administrativeArea'
function assert(value:unknown,message:string):asserts value {if(!value)throw new Error(message)}
const bacNinh = administrativeArea('Đường Nguyễn Văn Cừ, Bắc Ninh')
assert(bacNinh, 'original province gets administrative representative')
assert(bacNinh.key==='province:bac ninh','province identity retained')
assert(areaContains(bacNinh, {lat:21.1861,lng:106.0763}),'known city center inside original province')
assert(!areaContains(bacNinh,{lat:14.0583,lng:108.2772}),'Vietnam center is outside original province')
assert(administrativeArea('Không có vị trí')===null,'unknown text never creates nationwide point')
assert(administrativeArea('Bắc Ninh, Hà Nội')===null,'conflicting provinces not guessed')
const city=administrativeArea('TP. Bắc Ninh, Bắc Ninh')
assert(city && city.key==='city:bac ninh','explicit city uses sourced city representative before province')
assert(areaContains(city,{lat:21.18608,lng:106.07632}),'gazetteer witness proves representative lies in named city')
assert(!areaContains(city,{lat:21.098,lng:106.117}),'provincial interior point cannot pass city witness')
assert(administrativeArea('TP. Hải Dương, Hải Dương')===null,'unavailable other city boundary fails honestly')
for (const area of ADMINISTRATIVE_AREAS) assert(areaContains(area,area),area.key+' reference representative inside original polygon')
for(const name of ['Hải Dương','Bình Phước','Bà Rịa - Vũng Tàu'])assert(administrativeArea(name),name+' original province retained')
console.log('administrativeArea: province containment and unavailable city boundary assertions passed')

assert(administrativeArea('Đường A - TP. Hải Dương, Hải Dương')===null,'embedded unknown city never broadens to province')
assert(administrativeArea('Ngô Tất Tố - TP. Bắc Ninh')?.key==='city:bac ninh','hyphen embedded explicit city uses known locality witness')

assert(administrativeAreaForTarget('Hải Dương','Hải Dương, Hà Nội')?.key==='province:hai duong','concrete workplace does not inherit unrelated province conflict from summary')

// 2026-11-06: simplified Natural Earth outline cuts KCN Yên Phong mở rộng (Google place of NEW TEAMROBOTICS, Yên Trung, Bắc Ninh) — edge tolerance keeps it inside
assert(areaContains(bacNinh, {lat:21.22944,lng:106.00377}),'Yên Phong expansion park near simplified border is inside Bắc Ninh')
assert(!areaContains(bacNinh, {lat:21.0285,lng:105.8542}),'Hà Nội center stays outside Bắc Ninh')
assert(!areaContains(bacNinh, {lat:11.05,lng:106.70}),'Bình Dương stays outside Bắc Ninh')

// 2026-11-11 MediaMart(37 Lý Thái Tổ, Kinh Bắc): 원문 "TP. Bắc Ninh"이어도 "원래 성 안" 검사는 성 경계로 — 시 대표점과 다른 좌표도 성 안이면 통과
{
  const { withinOriginalProvince } = await import('./administrativeArea.ts')
  const addr = 'Số 37 Đường Lý Thái Tổ, P. Võ Cường, TP. Bắc Ninh'
  assert(withinOriginalProvince(addr, 'Bắc Ninh', { lat: 21.1810, lng: 106.0705 }), 'TP. Bắc Ninh address: point in Bắc Ninh province passes')
  assert(!withinOriginalProvince(addr, 'Bắc Ninh', { lat: 10.7626, lng: 106.6602 }), 'TP. Bắc Ninh address: Hồ Chí Minh point fails')
  // 시 중심 핀(대표점) 규칙은 그대로: 시 대표 자료는 그 점만 증명
  const city = administrativeAreaForTarget(addr, 'Bắc Ninh')
  assert(city?.key === 'city:bac ninh' && !areaContains(city, { lat: 21.1810, lng: 106.0705 }), 'city representative still proves only its own point')
}

// 2026-11-18 El Gaucho Hikari Bình Dương(vieclam24h): 통합 뒤 주소 "(…, Bình Dương cũ)" + 지역 TP.HCM, 시 이름(Thủ Dầu Một)은 시 경계 자료 없음 →
// 성 경계는 "cũ"로 적힌 옛 성(Bình Dương)으로 본다. Google 장소 11.05904,106.68454.
{
  const { withinOriginalProvince } = await import('./administrativeArea.ts')
  const addr = 'Hikari Bình Dương, Phường Bình Dương (Thành phố Thủ Dầu Một | Thị xã Tân Uyên, Bình Dương cũ)'
  assert(withinOriginalProvince(addr, 'TP.HCM', { lat: 11.05904, lng: 106.68454 }), 'old province marked cũ: Bình Dương point passes')
  assert(withinOriginalProvince(addr + ', TP.HCM', '', { lat: 11.05904, lng: 106.68454 }), 'new + old province in one line: cũ one decides')
  assert(!withinOriginalProvince(addr, 'TP.HCM', { lat: 21.1810, lng: 106.0705 }), 'old province marked cũ: Bắc Ninh point fails')
  assert(!withinOriginalProvince('Bắc Ninh, Hà Nội', '', { lat: 21.1810, lng: 106.0705 }), 'two provinces without cũ stay unknown')
  assert(administrativeArea(addr) === null, 'city stage unchanged: unknown city boundary is still unknown')
}

// 2026-11-25 vieclam24h 시험 10건(검증 저장 45588882480): 호찌민 주소를 "TP.HCM"으로만 적은 공고는 원래 성을 몰라
// Google이 같은 회사·같은 번지를 찾아도 '성 밖'으로 떨어졌다(Tiêu Điểm Mới 10.80601,106.66420 · A Mà Kitchen 10.76692,106.68754, business-search-compare 45617007308·45617149028).
{
  const { withinOriginalProvince } = await import('./administrativeArea.ts')
  const a = '2 Nguyễn Văn Mại, Phường Tân Sơn Nhất, TP.HCM, Phường Tân Sơn Nhất (Quận Tân Bình, TP.HCM cũ)'
  const b = '189 Cống Quỳnh, Phường Cầu Ông Lãnh (Quận 1, TP.HCM cũ)'
  assert(withinOriginalProvince(a, 'TP.HCM', { lat: 10.80601, lng: 106.66420 }), 'TP.HCM written address: HCMC point passes')
  assert(withinOriginalProvince(b, 'TP.HCM', { lat: 10.76692, lng: 106.68754 }), 'TP.HCM cũ written address: HCMC point passes')
  assert(!withinOriginalProvince(b, 'TP.HCM', { lat: 21.1810, lng: 106.0705 }), 'TP.HCM address: Bắc Ninh point still fails')
}
