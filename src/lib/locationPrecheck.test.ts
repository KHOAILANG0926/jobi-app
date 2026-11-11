// 수집 첫 단계 = 위치 확인(Lee 2026-11-06). 지도와 같은 resolver 결과 → 찾을 수 있음/없음.
import { agencyByPhone, precheckCompany, precheckJob, precheckLocationText, precheckVerdict } from './locationPrecheck.ts'
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

// 2026-11-07 회사 이름 규정: 사이트 칸 → 원문 → 포스터. 페이스북 기본값은 이름이 아님
assert(precheckCompany({ company: 'NEW TEAM ROBOTICS VIETNAM', source_text: 'x' }).from === 'site', 'site company field wins')
assert(precheckCompany({ company: 'Nhà tuyển dụng Facebook', source_text: 'CTY BÁNH KẸO HỮU NGHỊ – TUYỂN LIÊN TỤC' }).name === 'CTY BÁNH KẸO HỮU NGHỊ', 'facebook fallback → read text')
assert(precheckCompany({ source_text: 'Nhà chị cần tuyển 3 phụ bếp' }).name === '', 'no company in text')
const fromPoster = precheckCompany({ source_text: 'Tuyển gấp LĐPT', poster_text: 'CÔNG TY TNHH HOJEONG VINA\nTuyển công nhân' })
assert(fromPoster.name === 'CÔNG TY TNHH HOJEONG VINA' && fromPoster.from === 'poster', 'poster company')
assert(precheckJob({ company: '', location: 'Bắc Ninh', source_text: 'CTY BÁNH KẸO HỮU NGHỊ – TUYỂN\nĐịa điểm: KCN Yên Phong Mở Rộng – Bắc Ninh' })?.company === 'CTY BÁNH KẸO HỮU NGHỊ', 'resolver gets read company')
// 전화번호 기록으로 소개소 보기(Lee 2026-11-07 5번 B)
assert(agencyByPhone('Nhân lực Minh Anh', [{ core: 'samsung' }]) === true, 'phone already used by another company → agency')
assert(agencyByPhone('CTY BÁNH KẸO HỮU NGHỊ', [{ core: 'banhkeohuunghi' }]) === false, 'same company name → not agency')
assert(agencyByPhone('Highlands Coffee', [{ core: 'p0912345678' }]) === false, 'nameless job record is not evidence')
assert(agencyByPhone('Highlands Coffee', []) === false, 'no record → not agency')

// 2026-11-11 Lee 매장 여러 곳: 주소 칸 없는 원문은 매장마다 위치 찾기 대상, 첫 번째는 위치 글자와 같다. 주소 칸이 있으면 그 칸 그대로.
{
  const { precheckJob: pj, precheckLocationTexts: plt } = await import('./locationPrecheck.ts')
  const src = 'KRIK TUYỂN DỤNG\nĐịa chỉ: 152 Trần Hưng Đạo - Kinh Bắc - Bắc Ninh\n148 Trần Phú - Từ Sơn - Bắc Ninh\nLiên hệ 0886530131'
  const job = pj({ company: 'KRIK', location: 'Bắc Ninh', source_text: src })!
  if (job.targets.length !== 2 || job.targets[0].address !== job.location) throw new Error('multi-store targets: ' + JSON.stringify(job))
  if (plt({ location: 'Bắc Ninh', source_text: src }).length !== 2) throw new Error('location texts per store')
  const site = pj({ company: 'KRIK', location: 'Bắc Ninh', addresses: ['1 A, Bắc Ninh'], source_text: src })!
  if (site.targets.length !== 1 || site.targets[0].address !== '1 A, Bắc Ninh') throw new Error('site address column wins')
  console.log('locationPrecheck: 매장 여러 곳 대상 통과')
}
