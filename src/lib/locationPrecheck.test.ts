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
// 2026-11-11 Jollibee: 글에 성 이름이 없으면 수집 그룹 지역을 Google 검색어에만 붙이고, 성 안 검사도 그 지역으로. 위치 글자는 그대로.
{
  const jb = 'ĐỢT TUYỂN DỤNG NHÂN VIÊN TẠI JOLLIBEE TRẦN HƯNG ĐẠO TỚI ĐÂY\nDo nhu cầu kinh doanh, Cửa hàng Jollibee 393 Trần Hưng Đạo tuyển dụng nhân viên part time:'
  const j = precheckJob({ company: '', location: '', source_text: jb, search_region: 'Bắc Ninh' })!
  assert(j.location === '393 Trần Hưng Đạo' && j.searchRegion === 'Bắc Ninh', 'search region kept apart from the location text: ' + JSON.stringify(j))
  const asked: string[] = []
  const { withinOriginalProvince } = await import('./administrativeArea.ts')
  const r = await resolveAutoLocation(j, { ...noop, async goong() { return { predictions: [] } },
    async google(text: string) { asked.push(text); return { places: [
      { id: 'jb1', displayName: { text: 'Jollibee Trần Hưng Đạo Bắc Ninh' }, formattedAddress: '393 Trần Hưng Đạo, Võ Cường, Bắc Ninh', location: { latitude: 21.1752, longitude: 106.0661 } },
      { id: 'jb2', displayName: { text: 'Jollibee Nguyễn Trãi' }, formattedAddress: '207 Nguyễn Trãi, Võ Cường, Bắc Ninh', location: { latitude: 21.1712, longitude: 106.0601 } }] } },
    async withinAdministrativeArea(a: string[], p: { lat: number; lng: number }) { return withinOriginalProvince(a[0], a[1] || '', p) } })
  assert(asked.length === 1 && asked[0].endsWith('393 Trần Hưng Đạo, Bắc Ninh'), 'Google asked with the group region: ' + asked[0])
  assert(precheckVerdict(r).findable && 'source' in r && /jb1/.test(String(r.source)), 'Jollibee 393 Trần Hưng Đạo found: ' + JSON.stringify(r))
  const noRegion = precheckJob({ company: '', location: '', source_text: jb })!
  assert(!noRegion.searchRegion, 'no search region when the crawler gives none')
}
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
