// Lee 2026-11-09 Google 한도 지시 시험: ① 같은 사업장 중복 검색 줄이기(지점이 다르면 합치지 않음) ② 한도 초과 ≠ 위치 없음
// ④ Google 결과 30일(약관). 크롤러 보류·재시도는 crawler/test_ingest_gateway.py, 로고 재시도는 api/_logo-lookup.test.ts.
import { googleCacheKeys, googleFresh, siteCacheKey } from './companyPlaceSearch.ts'
import { precheckJob, precheckVerdict } from './locationPrecheck.ts'
import { resolveAutoLocation } from './autoLocationResolver.ts'
import { cachedGooglePlace } from './logoLookup.ts'
function assert(v: unknown, m: string) { if (!v) throw new Error(m) }

// ① 같은 사업장 = 회사 핵심 이름 + (번지+도로 또는 공단) + 원래 성
const a = siteCacheKey('Công ty TNHH Hojeong Vina', 'Lô C3, KCN Quế Võ, phường Phương Liễu, Bắc Ninh')
const b = siteCacheKey('CTY HOJEONG VINA', 'KCN Quế Võ, Quế Võ, Bắc Ninh')
assert(a && a === b, `same company + same park → one key: ${a} / ${b}`)
assert(siteCacheKey('Hojeong Vina', 'KCN Quế Võ 2, Bắc Ninh') !== a, 'numbered park (Quế Võ 2) is another site')
assert(siteCacheKey('Hojeong Vina', 'KCN Yên Phong, Bắc Ninh') !== a, 'same name, other park → not merged')
const s1 = siteCacheKey('Highlands Coffee', '12 Lý Thái Tổ, Suối Hoa, Bắc Ninh')
const s2 = siteCacheKey('HIGHLANDS COFFEE', 'số 12 Lý Thái Tổ, P. Suối Hoa, TP Bắc Ninh')
assert(s1 && s1 === s2, `same house number + street → one key: ${s1} / ${s2}`)
assert(siteCacheKey('Highlands Coffee', '15 Lý Thái Tổ, Bắc Ninh') !== s1, 'other house number = other branch')
assert(siteCacheKey('Highlands Coffee', '12 Nguyễn Văn Cừ, Bắc Ninh') !== s1, 'other street = other branch')
assert(siteCacheKey('Highlands Coffee', '12 Lý Thái Tổ, Hoàn Kiếm, Hà Nội') !== s1, 'other province = other branch')
assert(siteCacheKey('Highlands Coffee', '12 Lý Thái Tổ, Từ Sơn, Bắc Ninh') !== s1, 'Codex #619: same house+street, other locality in same province = other branch')
assert(siteCacheKey('Highlands Coffee', '12 Lý Thái Tổ, Bắc Ninh') !== s1, 'locality missing → not merged with a locality-named address')
assert(siteCacheKey('Highlands Coffee', 'Lý Thái Tổ, Bắc Ninh') === '', 'street without house number → no site key (old text key)')
assert(siteCacheKey('ABC', 'KCN Quế Võ, Bắc Ninh') === '', 'too-short core name → no site key')
assert(googleCacheKeys('Highlands Coffee', 'Lý Thái Tổ, Bắc Ninh').length === 1, 'no site → only text key')
assert(googleCacheKeys('Highlands Coffee', '12 Lý Thái Tổ, Bắc Ninh').length === 2, 'site key first, old text key second')

const store = new Map<string, unknown>()
let asked = 0
const place = (id: string, name: string, address: string, lat = 21.18, lng = 106.07) => ({ id, displayName: { text: name }, formattedAddress: address, location: { latitude: lat, longitude: lng }, types: ['establishment'] })
const deps = (google: () => Promise<unknown>) => ({
  async cached(k: string) { return store.has(k) ? store.get(k) : null },
  async cache(k: string, v: unknown) { store.set(k, v) },
  async reserve() { return true }, async request() { return [] },
  async google() { asked++; return google() },
  async withinAdministrativeArea() { return true },
})
const job1 = precheckJob({ company: 'Công ty TNHH Hojeong Vina', location: 'Bắc Ninh', addresses: ['Lô C3, KCN Quế Võ, phường Phương Liễu, Bắc Ninh'] })!
const job2 = precheckJob({ company: 'CTY HOJEONG VINA', location: 'Bắc Ninh', addresses: ['KCN Quế Võ, Quế Võ, Bắc Ninh'] })!
const hoj = { places: [place('hj1', 'Công ty TNHH Hojeong Vina', 'Lô C3, KCN Quế Võ, Bắc Ninh')] }
const r1 = await resolveAutoLocation(job1, deps(async () => hoj))
const r2 = await resolveAutoLocation(job2, deps(async () => hoj))
assert(precheckVerdict(r1).findable && precheckVerdict(r2).findable && asked === 1, `same site, different wording → Google asked once (asked ${asked})`)
assert([...store.values()].some((v) => typeof (v as { cachedAt?: string }).cachedAt === 'string'), 'Google result stored with cachedAt')

// 다른 지점(같은 회사 이름, 다른 공단)은 저장된 결과를 쓰지 않고 따로 묻는다 — 잘못된 사업장 연결 없음
asked = 0
const job3 = precheckJob({ company: 'Công ty TNHH Hojeong Vina', location: 'Bắc Ninh', addresses: ['KCN Yên Phong, Bắc Ninh'] })!
const r3 = await resolveAutoLocation(job3, deps(async () => ({ places: [place('hj2', 'Hojeong Vina', 'KCN Yên Phong, Bắc Ninh', 21.22, 106.0)] })))
assert(asked === 1 && r3.kind !== 'unresolved' && String((r3 as { source?: string }).source).includes('hj2'), 'other park → own Google search, own place: ' + JSON.stringify((r3 as { source?: string }).source))
// 같은 공단 열쇠에 남의 지점 결과가 저장돼 있어도 판정(pickCompanyPlace)이 다시 막는다: 공단이 다른 후보는 고르지 않음
store.set(googleCacheKeys('Hojeong Vina', 'KCN Quế Võ 2, Bắc Ninh')[0], { places: [place('x', 'Hojeong Vina', 'KCN Yên Phong, Bắc Ninh')], cachedAt: new Date().toISOString() })
asked = 0
const r4 = await resolveAutoLocation(precheckJob({ company: 'Hojeong Vina', location: 'Bắc Ninh', addresses: ['KCN Quế Võ 2, Bắc Ninh'] })!, deps(async () => ({ places: [] })))
assert(!String((r4 as { source?: string }).source ?? "").includes('Google x'), 'cached other-park place never linked: ' + JSON.stringify((r4 as { source?: string }).source))

// 예전 검색 글자 열쇠(company-v2)에 저장된 결과도 그대로 쓴다(이미 낸 요청을 다시 내지 않음)
store.clear(); asked = 0
const [siteKey, textKey] = googleCacheKeys(job1.company, job1.targets[0].address)
store.set(textKey, hoj)
const r5 = await resolveAutoLocation(job1, deps(async () => hoj))
assert(precheckVerdict(r5).findable && asked === 0 && !store.has(siteKey), 'legacy text-key result reused, no new request')
assert((await cachedGooglePlace(job1, async (k) => store.get(k) ?? null, async () => true))?.id === 'hj1', 'logo/business lookup reads legacy key too')
store.clear(); store.set(siteKey, { ...hoj, cachedAt: new Date().toISOString() })
assert((await cachedGooglePlace(job1, async (k) => store.get(k) ?? null, async () => true))?.id === 'hj1', 'logo/business lookup reads site key')

// ② 한도 초과(우리 월 한도·Google 429)는 '위치 없음'이 아니라 google_quota(보류)
for (const msg of ['quota_exhausted', 'upstream_failed_429']) {
  store.clear()
  const q = await resolveAutoLocation(job1, deps(async () => { throw new Error(msg) }))
  const v = precheckVerdict(q)
  assert(!v.findable && v.reason === 'google_quota', `${msg} → google_quota: ${JSON.stringify(v)}`)
  assert(!store.has(siteKey) && !store.has(textKey), 'failed Google call stores nothing (no false "not found" cached)')
}
const other = precheckVerdict(await resolveAutoLocation(job1, deps(async () => { throw new Error('upstream_failed') })))
assert(other.reason !== 'google_quota', 'other provider error is not quota')
const nf = precheckVerdict(await resolveAutoLocation(job1, deps(async () => ({ places: [] }))))
assert(!nf.findable && nf.reason !== 'google_quota', 'Google knows nothing → still not found (not held): ' + nf.reason)

// ④ 30일: 지난 결과·정리된 결과는 쓰지 않고 다시 묻는다
const now = '2026-11-10T00:00:00Z'
assert(googleFresh({ places: [], cachedAt: '2026-10-20T00:00:00Z' }, now), '21 days → fresh')
assert(!googleFresh({ places: [], cachedAt: '2026-10-10T00:00:00Z' }, now), '31 days → stale')
assert(!googleFresh({ places: [{ id: 'a' }], expired: true }, now), 'expired (ids only) → stale')
assert(googleFresh({ places: [] }, now), 'legacy without cachedAt → fresh until cleanup job expires it')
assert(googleFresh([{ ref_id: 'v' }], now), 'non-Google cache untouched')
store.clear(); asked = 0
store.set(siteKey, { places: [{ id: 'hj1' }], expired: true })
await resolveAutoLocation(job1, deps(async () => hoj))
assert(asked === 1 && (store.get(siteKey) as { expired?: boolean }).expired !== true, 'expired entry → asks Google again and refreshes')
console.log('googleQuotaCache: same-site reuse, branch separation, quota hold reason, 30-day cache passed')
