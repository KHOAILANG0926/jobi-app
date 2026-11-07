// 수집 첫 단계 = 위치 확인(Lee 2026-11-06). 지도와 같은 resolver 결과 → 찾을 수 있음/없음.
import { precheckJob, precheckLocationText, precheckVerdict } from './locationPrecheck.ts'
import { resolveAutoLocation } from './autoLocationResolver.ts'
function assert(ok: boolean, name: string) { if (!ok) throw new Error(name) }
const v = (d: object) => precheckVerdict(d as never)
assert(v({ kind: 'exact', lat: 21, lng: 106, source: 'VietMap x' }).findable, 'exact address → findable')
assert(v({ kind: 'gate', lat: 21, lng: 106, source: 'OSM y' }).findable, 'park gate → findable')
assert(v({ kind: 'area', lat: 21, lng: 106, source: 'Google ChIJabc (company)' }).reason === 'google_company_place', 'Google company place → findable')
assert(v({ kind: 'area', lat: 21, lng: 106, source: 'Goong g9 (company)' }).findable, 'Goong company place → findable')
assert(!v({ kind: 'area', lat: 21, lng: 106, source: 'Original administrative area province:bac ninh' }).findable, 'province center → not findable')
assert(!v({ kind: 'area', lat: 21, lng: 106, source: 'OSM park center' }).findable, 'park/ward center → not findable')
assert(v({ kind: 'area', lat: 21, lng: 106, source: 'Original administrative area province:bac ninh', evidence: 'x\nadministrative_boundary:mismatch' }).reason === 'outside_original_province', 'outside province reason')
assert(!v({ kind: 'unresolved' }).findable, 'unresolved → not findable')
assert(precheckJob({ company: 'A' }) === null, 'no location text → null')
assert(precheckJob({ company: 'A', location: 'Bắc Ninh', addresses: ['', 5, 'KCN Yên Phong, Bắc Ninh'] })?.targets[0].address === 'KCN Yên Phong, Bắc Ninh', 'addresses cleaned')

// 실제 resolver로: Google이 회사를 알면 찾음, 성 대략 위치뿐이면 못 찾음
const noop = { async cached() { return null }, async cache() {}, async reserve() { return true }, async request() { return [] } }
const job = precheckJob({ company: 'NEW TEAM ROBOTICS VIETNAM', location: 'Bắc Ninh', addresses: ['NX 2-2, lô CN1-2 và CN1-3, KCN Yên Phong (khu mở rộng), xã Yên Trung, Bắc Ninh'] })!
const found = await resolveAutoLocation(job, { ...noop, async goong() { return { predictions: [] } },
  async google() { return { places: [{ id: 'nt1', displayName: { text: 'CÔNG TY TNHH NEW TEAMROBOTICS VIETNAM' }, formattedAddress: 'KCN Yên Phong, Bắc Ninh', location: { latitude: 21.22944, longitude: 106.00377 } }] } },
  async withinAdministrativeArea() { return true } })
assert(precheckVerdict(found).findable, 'Google knows the company → collect: ' + JSON.stringify(found))
const vague = precheckJob({ company: 'Cty ABC', location: 'Bắc Ninh' })!
const none = await resolveAutoLocation(vague, { ...noop, async goong() { return { predictions: [] } }, async google() { return { places: [] } },
  async administrativeCenter() { return { lat: 21.098, lng: 106.117, source: 'Original administrative area province:bac ninh', checkedAt: 'x' } } })
assert(!precheckVerdict(none).findable, 'only province → do not collect: ' + JSON.stringify(none))
console.log('locationPrecheck: findable verdicts and real resolver cases passed')

// 2026-11-07 주소 읽기 한 곳: 주소 칸이 없으면 원문에서 읽은 주소 + 그룹 지역, 주소 칸이 있으면 그 칸(원문은 읽지 않음)
const netco = 'NETCO POST TUYỂN DỤNG TÀI XẾ – BẮC NINH\nThu nhập: 13 – 15 triệu/tháng\n📍 Tiểu KCN Ba Bên, Từ Sơn, Bắc Ninh'
assert(precheckJob({ company: 'NETCO', location: 'Bắc Ninh', source_text: netco })?.location === 'Tiểu KCN Ba Bên, Từ Sơn, Bắc Ninh, Bắc Ninh', 'source text address read for precheck')
assert(precheckJob({ company: 'NETCO', location: '', source_text: netco })?.targets[0].address === 'Tiểu KCN Ba Bên, Từ Sơn, Bắc Ninh', 'read address becomes the checked target')
assert(precheckJob({ company: 'A', location: 'Bắc Ninh', addresses: ['KCN Quế Võ, Bắc Ninh'], source_text: netco })?.location === 'Bắc Ninh', 'site address field wins; source text not read')
assert(precheckLocationText({ location: 'Bắc Ninh', source_text: 'Cần tuyển phục vụ' }) === 'Bắc Ninh', 'no address in text → region only')
