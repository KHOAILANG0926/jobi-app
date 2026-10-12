import type { Job } from '../types/job'
import { planDirections, planJobDirections } from './directionsPlan.ts'
import { industrialParkDirectionsUrl } from './industrialPark.ts'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

const approved = [{ label: 'Chỉ đường', href: 'https://www.google.com/maps/dir/?api=1&destination=21.1,105.9' }]
const gate = 'https://www.google.com/maps/dir/?api=1&destination=21.08,105.97'

const t1 = planDirections({ approvedLinks: approved, gateHref: gate, phone: '0344849982' })
assert(t1.tier === 'approved' && t1.links[0].label === 'Chỉ đường', '승인 좌표가 있으면 1단계 Chỉ đường (정문·전화보다 우선)')

const t2 = planDirections({ approvedLinks: [], gateHref: gate, phone: '0344849982' })
assert(t2.tier === 'gate' && t2.link.label === 'Đến cổng KCN' && t2.link.href === gate, '승인 좌표 없고 정문 좌표 있으면 2단계 Đến cổng KCN')

const t3 = planDirections({ approvedLinks: [], gateHref: null, phone: '0344 849 982' })
assert(t3.tier === 'call' && t3.label === 'Gọi hỏi đường' && t3.href === 'tel:0344849982', '둘 다 없으면 3단계 전화 버튼')

assert(planDirections({ approvedLinks: [], gateHref: null, phone: '' }).tier === 'none', '연락처도 없으면 아무것도 보이지 않음')
assert(planDirections({ approvedLinks: [], gateHref: null, phone: '12' }).tier === 'none', '전화번호로 볼 수 없는 값은 버튼을 만들지 않음')

for (const plan of [t1, t2, t3]) {
  const hrefs = plan.tier === 'approved' ? plan.links.map((l) => l.href) : plan.tier === 'gate' ? [plan.link.href] : plan.tier === 'call' ? [plan.href] : []
  assert(hrefs.every((h) => h.startsWith('tel:') || /destination=-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(h)), '링크는 좌표 또는 tel: 뿐 — 이름 검색 없음')
}

const parkBase = { kind: 'gate' as const, lat: 21.08, lng: 105.97, source: { provider: 'OpenStreetMap' as const, ref: 'node/1' }, satelliteChecked: '2026-10-08' }
assert(industrialParkDirectionsUrl({ destination: parkBase }) === 'https://www.google.com/maps/dir/?api=1&destination=21.08,105.97', '정문 좌표 → 좌표 링크')
assert(industrialParkDirectionsUrl({ destination: { ...parkBase, kind: 'office' } }) === null, '관리사무소 좌표는 "정문"이 아니므로 2단계에 쓰지 않음')
assert(industrialParkDirectionsUrl({ destination: undefined }) === null, '정문 좌표 없으면 null')

console.log('directionsPlan tests: all assertions passed')

assert(t1.tier === 'approved' && t1.links[0].viewHref === 'https://www.google.com/maps/search/?api=1&query=21.1,105.9', 'approved coordinate has a Google view link')
for (const href of ['https://www.google.com/maps/dir/?api=1&destination=Company', 'https://evil.example/?destination=21.1,105.9', 'https://www.google.com/maps/dir/?api=1&destination=91,105.9']) {
  assert(planDirections({ approvedLinks: [{ label: 'Chỉ đường', href }], gateHref: null, phone: '0344849982' }).tier === 'call', 'invalid/text coordinates must fall back to telephone')
}
assert(planDirections({ approvedLinks: [], gateHref: 'https://www.google.com/maps/dir/?api=1&destination=Park' }).tier === 'none', 'text gate destination forbidden')

const job = { title: 'Synthetic job', rawLocation: '', employerPhone: '0344849982', workLocations: [{ rawAddress: 'Synthetic', locationVerified: true, verificationStatus: 'verified', geocodeStatus: 'precise', addressAccuracy: 'exact_text', lat: 10.7, lng: 106.7 }] } as unknown as Job
assert(planJobDirections(job).tier !== 'approved', 'verified coordinate without approval cannot be used')
const approvedJob = { ...job, workLocations: [{ ...job.workLocations![0], approvedPoint: { lat: 10.71, lng: 106.71, placePrecision: 'site' as const } }] }
const approvedPlan = planJobDirections(approvedJob)
assert(approvedPlan.tier === 'approved' && approvedPlan.links[0].href.endsWith('destination=10.71,106.71') && approvedPlan.links[0].viewHref?.endsWith('query=10.71,106.71') === true, 'home/detail destination is the approved point, never the marker center')
assert(planJobDirections({ ...job, workLocations: [] }).tier !== 'approved', 'no work location cannot expose Google links')
console.log('Google links: coordinate view/directions, invalid destinations and shared approval rules passed')

assert(planJobDirections({ ...job, workLocations: [] }).tier === 'call', 'no approved coordinate keeps existing telephone fallback')
assert(planJobDirections({ ...job, employerPhone: '', workLocations: [] }).tier === 'none', 'no coordinate and no phone produces no buttons')
assert(planDirections({ approvedLinks: [], gateHref: gate, gateNote: 'Verified park gate, not factory.' }).tier === 'gate', 'gate tier preserves note')

// 2026-10-12 A안: 정확한 거리 주소만 Google 주소 검색으로 (운영 주소 원문 기준 사례)
import { preciseStreetAddressQuery, ADDRESS_NOTE } from './directionsPlan.ts'
const ok: [string, string][] = [
  ['37 Lý Thái Tổ, Tp Bắc Ninh, Phường Võ Cường, Thành phố Bắc Ninh, Bắc Ninh', '37 Lý Thái Tổ, Phường Võ Cường, Thành phố Bắc Ninh, Bắc Ninh'],
  ['MEDIAMART - 37 Đ. LÝ THÁI TỔ, P. VÕ CƯỜNG, TP. BẮC NINH, TỈNH BẮC NINH, Phường Võ Cường, Thành phố Bắc Ninh, Bắc Ninh', '37 Đ. LÝ THÁI TỔ, Phường Võ Cường, Thành phố Bắc Ninh, Bắc Ninh'],
  ['1A Lý Thái Tổ, Phường Võ Cường, Thành phố Bắc Ninh, Bắc Ninh', '1A Lý Thái Tổ, Phường Võ Cường, Thành phố Bắc Ninh, Bắc Ninh'],
]
for (const [raw, want] of ok) assert(preciseStreetAddressQuery(raw) === want, 'precise street address accepted: ' + raw)
const rejected: [string, string | null][] = [
  ['Số 354 Đường Thanh Niên, Phường Tân Hưng, Thành phố Hải Phòng, Phường Võ Cường, Thành phố Bắc Ninh, Bắc Ninh', null], // 행정구역 충돌
  ['Số 6, Đường 5, KCN VSIP, Phù Chẩn, Từ Sơn, Bắc Ninh, Phường Từ Sơn, Thị xã Từ Sơn, Bắc Ninh', null], // KCN
  ['LÔ A1 VÀ A2, THỬA ĐẤT 50 VÀ 51, KHU DÂN CƯ DỊCH VỤ ĐỒNG KHU, P.ĐÌNH BẢNG, TX. TỪ SƠN, T. BẮC NINH, Phường Từ Sơn, Thị xã Từ Sơn, Bắc Ninh', null], // Lô
  ['6-8 Khu 1, phường Quế Võ, tỉnh Bắc Ninh, Phường Quế Võ, Huyện Quế Võ, Bắc Ninh', null], // Khu
  ['Đường Số 14, Xã Tam Đa, Huyện Yên Phong, Bắc Ninh', null], // 번지 없음
  ['Đường tỉnh 284, Xã Trung Chính, Huyện Lương Tài, Bắc Ninh', null], // 번지 없음
  ['KCN VSIP, Bắc Ninh', null], // 2026-09-29 오안내 사례
  ['374 Trần Phú, Phường Tam Sơn, Thị xã Từ Sơn, Bắc Ninh', 'KCN X'], // 근무지가 KCN으로 분류되면 제외
]
for (const [raw, park] of rejected) assert(preciseStreetAddressQuery(raw, park) === null, 'not precise → no address link: ' + raw)

const addr = planDirections({ approvedLinks: [], gateHref: null, addressQuery: '37 Lý Thái Tổ, Phường Võ Cường, Thành phố Bắc Ninh, Bắc Ninh', phone: '0344849982' })
assert(addr.tier === 'address' && addr.note === ADDRESS_NOTE && addr.links[0].href.startsWith('https://www.google.com/maps/dir/?api=1&destination=37%20L')
  && addr.links[0].viewHref!.startsWith('https://www.google.com/maps/search/?api=1&query=37%20L'), 'address tier → Google dir/search with encoded address and unverified note')
assert(planDirections({ approvedLinks: approved, gateHref: null, addressQuery: 'x', phone: '' }).tier === 'approved', 'approved coordinate beats address')
assert(planDirections({ approvedLinks: [], gateHref: gate, addressQuery: 'x', phone: '' }).tier === 'gate', 'KCN gate beats address')
assert(planDirections({ approvedLinks: [], gateHref: null, addressQuery: null, phone: '0344849982' }).tier === 'call', 'no precise address → telephone')
console.log('address tier (A안) tests: all assertions passed')

// 2026-10-13: 길찾기를 숨기지 않는다 — 정확한 위치가 없으면 회사명+지역으로 Google
import { companyAreaQuery, COMPANY_AREA_NOTE, AREA_ONLY_NOTE } from './directionsPlan.ts'
const wardJob = { title: 'x', company: 'Công ty Cổ phần In và Bao bì Goldsun', rawLocation: '', employerPhone: '0393708349',
  workLocations: [{ rawAddress: 'Phường Phương Liễu, Huyện Quế Võ, Bắc Ninh', locationVerified: false }] } as unknown as Job
const ward = planJobDirections(wardJob)
assert(ward.tier === 'address' && ward.note === COMPANY_AREA_NOTE && ward.links.length === 1 && ward.call?.href === 'tel:0393708349'
  && decodeURIComponent(ward.links[0].href).endsWith('destination=Công ty Cổ phần In và Bao bì Goldsun, Phường Phương Liễu, Huyện Quế Võ, Bắc Ninh'),
  'ward-only job still gets Google directions (company + area) and keeps the phone button')
assert(companyAreaQuery({ ...wardJob, company: 'Nhà tuyển dụng ẩn danh' })?.note === AREA_ONLY_NOTE, 'generic company → area-only query with explicit note')
assert(companyAreaQuery({ ...wardJob, rawLocation: '', workLocations: [] }) === null, 'no location at all → no Google link')
console.log('directions never hidden (2026-10-13): all assertions passed')
