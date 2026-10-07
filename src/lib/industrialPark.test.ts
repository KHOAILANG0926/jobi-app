import { INDUSTRIAL_PARKS, type IndustrialPark } from '../data/industrialParks.ts'
import { INDUSTRIAL_PARK_OUTLINES } from '../data/industrialParkOutlines.ts'
import { findIndustrialPark, industrialParkDirectionsNote, industrialParkDirectionsUrl } from './industrialPark.ts'

function assert(value: boolean, label: string) { if (!value) throw new Error(label) }
const id = (...t: (string | undefined)[]) => findIndustrialPark(...t)?.id

// 데이터 무결성: 전부 출처(OSM way)가 있고, 베트남 안이며, id·출처가 중복되지 않는다
assert(INDUSTRIAL_PARKS.length === 28, `28 sourced parks (got ${INDUSTRIAL_PARKS.length})`)
assert(new Set(INDUSTRIAL_PARKS.map((p) => p.id)).size === INDUSTRIAL_PARKS.length, 'unique ids')
assert(new Set(INDUSTRIAL_PARKS.map((p) => p.source.ref)).size === INDUSTRIAL_PARKS.length, 'unique sources')
for (const p of INDUSTRIAL_PARKS) {
  assert(p.source.provider === 'OpenStreetMap' && /^way\/\d+$/.test(p.source.ref), `${p.id} has an OSM source`)
  assert(p.lat > 8 && p.lat < 24 && p.lng > 102 && p.lng < 110, `${p.id} is inside Vietnam`)
  assert(p.aliases.length > 0 && p.aliases.every((a) => a === a.toLowerCase() && !/[^a-z0-9 ]/.test(a)), `${p.id} aliases are folded`)
}

// 영역 윤곽: 모든 공단에 같은 OSM way의 닫힌 링이 있고, 중심 좌표가 윤곽 bounds 안(= bbox 중심)에 있다
for (const p of INDUSTRIAL_PARKS) {
  const o = INDUSTRIAL_PARK_OUTLINES[p.source.ref]
  assert(!!o && o.ring.length >= 4, `${p.id} has an outline`)
  assert(o.ring[0][0] === o.ring[o.ring.length - 1][0] && o.ring[0][1] === o.ring[o.ring.length - 1][1], `${p.id} outline ring is closed`)
  assert(p.lng >= o.bounds[0] && p.lng <= o.bounds[2] && p.lat >= o.bounds[1] && p.lat <= o.bounds[3], `${p.id} center is inside its outline bounds`)
  assert(Math.abs((o.bounds[0] + o.bounds[2]) / 2 - p.lng) < 2e-5 && Math.abs((o.bounds[1] + o.bounds[3]) / 2 - p.lat) < 2e-5, `${p.id} center = outline bbox center (Overpass out center)`)
}
assert(Object.keys(INDUSTRIAL_PARK_OUTLINES).length === INDUSTRIAL_PARKS.length, 'no orphan outlines')

// 길찾기: 영역 중심은 절대 목적지로 쓰지 않는다 — 출처 있는 정문·관리사무소(destination)가 있는 공단만 링크를 만든다
const vsip = findIndustrialPark('KCN VSIP, Bắc Ninh')!
assert(industrialParkDirectionsUrl(vsip) === null, 'VSIP Bắc Ninh: no sourced gate/office yet → no directions (button hidden)')
for (const p of INDUSTRIAL_PARKS) {
  const url = industrialParkDirectionsUrl(p)
  if (!p.destination) { assert(url === null, `${p.id}: no destination → no directions`); continue }
  const d = p.destination
  assert(d.source.ref.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(d.satelliteChecked), `${p.id}: destination has a source id and a satellite check date`)
  assert(url === `https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lng}`, `${p.id}: directions use the destination coordinates`)
  assert(!(d.lat === p.lat && d.lng === p.lng), `${p.id}: destination is never the area-center`)
  const o = INDUSTRIAL_PARK_OUTLINES[p.source.ref]
  const pad = 0.003 // ~300 m — 정문·사무소는 공단 윤곽 안이거나 바로 인접해야 한다
  assert(d.lng >= o.bounds[0] - pad && d.lng <= o.bounds[2] + pad && d.lat >= o.bounds[1] - pad && d.lat <= o.bounds[3] + pad, `${p.id}: destination is at the park`)
}
// 목적지가 있는 경우의 링크·안내문(합성 데이터)
const fake = { destination: { kind: 'gate', lat: 21.0801, lng: 105.968, source: { provider: 'OpenStreetMap', ref: 'node/1' }, satelliteChecked: '2026-10-07' } } as Pick<IndustrialPark, 'destination'>
assert(industrialParkDirectionsUrl(fake) === 'https://www.google.com/maps/dir/?api=1&destination=21.0801,105.968', 'URL from destination coordinates only')
assert(industrialParkDirectionsNote(fake.destination!).includes('chưa phải cổng nhà máy'), 'gate note says it is not the factory gate')
assert(industrialParkDirectionsNote({ ...fake.destination!, kind: 'office' }).includes('Ban quản lý'), 'office note')

// 실제 공고 근무지 텍스트
assert(id('KCN VSIP, Bắc Ninh') === 'vsip-bac-ninh', '"KCN VSIP, Bắc Ninh" (#4682) = VSIP Bắc Ninh — the only VSIP in Bắc Ninh')
assert(id('KCN VSIP, Hải Dương') === undefined, 'VSIP in a province without a sourced park → no guess')
assert(id('Số 10, đường 5, KCN VSIP Bắc Ninh, Phù Chẩn, Từ Sơn, Bắc Ninh, Từ Sơn') === 'vsip-bac-ninh', 'VSIP Bắc Ninh')
assert(id('Khu công nghiệp Vsip 1, Thuận An') === 'vsip-1' && id('Khu công nghiệp VSIP 2/ VSIP 2A, Tân Uyên') === 'vsip-2', 'VSIP 1 / VSIP 2')
assert(id('KCN Yên Phong Mở Rộng, Yên Phong') === 'yen-phong-mo-rong', 'Yên Phong mở rộng')
assert(id('AkzoNobel Vietnam - Lô I4-1, KCN Quế Võ 1, Phương Liễu, Quế Võ') === 'que-vo-1', 'Quế Võ 1')
assert(id('KCN Thăng Long 2 – Hưng Yên, Yên Mỹ') === 'thang-long-2-hung-yen' && id('KCN Thăng Long 2, Yên Mỹ') === 'thang-long-2-hung-yen', 'Thăng Long 2 (longest alias wins over Yên Mỹ)')
assert(id('Lô P1, KCN Thăng Long, Đông Anh') === undefined, 'KCN Thăng Long (Đông Anh) is not Thăng Long II')
assert(id('KCN Yên Mỹ, Yên Mỹ') === 'yen-my-hung-yen', 'Yên Mỹ')
assert(id('Hải Phòng (KCN Đình Vũ), Hải An') === 'dinh-vu', 'Đình Vũ')
assert(id('Lô 107 đường Amata, P. Long Bình; KCN Amata, Biên Hòa') === 'amata', 'Amata')
assert(id('KCX-CN Linh Trung 3, P. An Tịnh, Trảng Bàng') === 'linh-trung-3', 'KCX-CN Linh Trung 3')
assert(id('Lô C5 đường số 3, KCN Hiệp Phước, Hiệp Phước, TP HCM (Nhà Bè), Nhà Bè') === 'hiep-phuoc', 'Hiệp Phước')

// 이름이 비슷한 다른 공단·순번·지역 불일치는 매칭하지 않는다
assert(id('KCN Quế Võ 2, Quế Võ') === undefined, 'Quế Võ 2 is not Quế Võ 1')
assert(id('Khu công nghiệp Long Đức, Trà Vinh, Trà Vinh') === 'long-duc-tra-vinh', 'Long Đức Trà Vinh')
assert(id('Khu công nghiệp Long Đức, Biên Hòa, Đồng Nai') === undefined, 'Long Đức in another province is not matched')
assert(id('KCN Hòa Phú. Daklak, Buôn Ma Thuột') === 'hoa-phu-dak-lak', 'Hòa Phú Đắk Lắk')
assert(id('KCN Phú Tân , Hòa Phú , Thủ Dầu Một , Bình Dương, Thủ Dầu Một') === 'phu-tan-binh-duong', 'Phú Tân (Hòa Phú is a ward there)')
assert(id('Khu Công Nghiệp Tân Bình, Tân Uyên') === undefined && id('KCN Thuận Thành, Xuân Lâm, Thuận Thành') === undefined, 'parks without a sourced coordinate → none')
assert(id('Công ty Quang Minh, 12 Nguyễn Trãi, Hà Nội') === undefined, 'a company name is not a park (needs a KCN token right before the name)')
assert(id('123 Nguyễn Trãi, Quận 1') === undefined && id(undefined, '') === undefined, 'non-park texts')
// 여러 텍스트 중 처음 맞는 것
assert(id('KCN lạ, Bắc Ninh', 'KCN Đình Vũ, Hải An') === 'dinh-vu', 'first matching text wins')

console.log('industrialPark.test.ts: all assertions passed')
