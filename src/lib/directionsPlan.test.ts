import { planDirections } from './directionsPlan.ts'
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
