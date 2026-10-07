import { INDUSTRIAL_PARKS } from '../data/industrialParks.ts'
import { findIndustrialPark } from './industrialPark.ts'

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
