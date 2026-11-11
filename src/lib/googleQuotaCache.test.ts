// Lee 2026-11-09 Google 한도 지시 시험: ① 같은 검색 다시 쓰기(완전 일치만, 비슷한 사업장 병합 없음) ② 한도 초과 ≠ 위치 없음
// 크롤러 보류·재시도는 crawler/test_ingest_gateway.py, 로고 재시도는 api/_logo-lookup.test.ts.
import { googleCacheKeys, googlePlaceHits } from './companyPlaceSearch.ts'
import { precheckJob, precheckVerdict } from './locationPrecheck.ts'
import { resolveAutoLocation } from './autoLocationResolver.ts'
import { cachedGooglePlace } from './logoLookup.ts'
function assert(v: unknown, m: string) { if (!v) throw new Error(m) }

// ① 저장된 Google 결과는 검색 글자(회사 이름 + 원문 주소)가 완전히 같을 때만 다시 쓴다(Lee 2026-11-10 "나": 비슷한 사업장 자동 병합 없음)
assert(googleCacheKeys('Highlands Coffee', '12 Lý Thái Tổ, Bắc Ninh').length === 1, 'one exact text key')
assert(googleCacheKeys('Highlands Coffee', '12 Lý Thái Tổ, Bắc Ninh')[0] === JSON.stringify(['company-v2', 'google', 'Highlands Coffee, 12 Lý Thái Tổ, Bắc Ninh']), 'same key as before #619 (stored results stay usable)')
assert(googleCacheKeys('Hojeong Vina', 'Lô C3, KCN Quế Võ, Bắc Ninh')[0] !== googleCacheKeys('Hojeong Vina', 'Lô D5, KCN Quế Võ, Bắc Ninh')[0], 'other lot → other key')

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
const job2 = precheckJob({ company: 'CTY HOJEONG VINA', location: 'Bắc Ninh', addresses: ['lô số C3 KCN Quế Võ, Quế Võ, Bắc Ninh'] })!
const hoj = { places: [place('hj1', 'Công ty TNHH Hojeong Vina', 'Lô C3, KCN Quế Võ, Bắc Ninh')] }
const r1 = await resolveAutoLocation(job1, deps(async () => hoj))
const r1b = await resolveAutoLocation(job1, deps(async () => hoj))
assert(precheckVerdict(r1).findable && precheckVerdict(r1b).findable && asked === 1, `same text → Google asked once (asked ${asked})`)
const r2 = await resolveAutoLocation(job2, deps(async () => hoj))
assert(precheckVerdict(r2).findable && asked === 2, `different wording → asked again, never merged (asked ${asked})`)

// 다른 지점(같은 회사 이름, 다른 공단)은 저장된 결과를 쓰지 않고 따로 묻는다 — 잘못된 사업장 연결 없음
asked = 0
const job3 = precheckJob({ company: 'Công ty TNHH Hojeong Vina', location: 'Bắc Ninh', addresses: ['KCN Yên Phong, Bắc Ninh'] })!
const r3 = await resolveAutoLocation(job3, deps(async () => ({ places: [place('hj2', 'Hojeong Vina', 'KCN Yên Phong, Bắc Ninh', 21.22, 106.0)] })))
assert(asked === 1 && r3.kind !== 'unresolved' && String((r3 as { source?: string }).source).includes('hj2'), 'other park → own Google search, own place: ' + JSON.stringify((r3 as { source?: string }).source))
// 같은 공단 열쇠에 남의 지점 결과가 저장돼 있어도 판정(pickCompanyPlace)이 다시 막는다: 공단이 다른 후보는 고르지 않음
store.set(googleCacheKeys('Hojeong Vina', 'KCN Quế Võ 2, Bắc Ninh')[0], { places: [place('x', 'Hojeong Vina', 'KCN Yên Phong, Bắc Ninh')] })
asked = 0
const r4 = await resolveAutoLocation(precheckJob({ company: 'Hojeong Vina', location: 'Bắc Ninh', addresses: ['KCN Quế Võ 2, Bắc Ninh'] })!, deps(async () => ({ places: [] })))
assert(!String((r4 as { source?: string }).source ?? "").includes('Google x'), 'cached other-park place never linked: ' + JSON.stringify((r4 as { source?: string }).source))

// 이미 저장된 결과(예전과 같은 열쇠)는 그대로 쓴다 — 위치 확인·로고·업종 모두
store.clear(); asked = 0
const [textKey] = googleCacheKeys(job1.company, job1.targets[0].address)
store.set(textKey, hoj)
const r5 = await resolveAutoLocation(job1, deps(async () => hoj))
assert(precheckVerdict(r5).findable && asked === 0, 'stored result reused, no new request')
assert((await cachedGooglePlace(job1, async (k) => store.get(k) ?? null, async () => true))?.id === 'hj1', 'logo/business lookup reads the same key')

// ② 한도 초과(우리 월 한도·Google 429)는 '위치 없음'이 아니라 google_quota(보류)
for (const msg of ['quota_exhausted', 'upstream_failed_429']) {
  store.clear()
  const q = await resolveAutoLocation(job1, deps(async () => { throw new Error(msg) }))
  const v = precheckVerdict(q)
  assert(!v.findable && v.reason === 'google_quota', `${msg} → google_quota: ${JSON.stringify(v)}`)
  assert(!store.has(textKey), 'failed Google call stores nothing (no false "not found" cached)')
}
// Codex #619: 한도 초과 뒤 VietMap 공단(표에 없는 공단)·동 중심 대략 위치가 나와도 '한도 초과'(보류)로 남는다 — 7일 뒤 '못 찾음'이 아님
{
  const vm = (hits: unknown[], place: unknown) => async (action: string) => action === 'search' ? hits : place
  const quotaDeps = (request: (a: string) => Promise<unknown>) => ({ ...deps(async () => { throw new Error('quota_exhausted') }), request })
  store.clear()
  const parkJob = precheckJob({ company: 'Công ty TNHH Hojeong Vina', location: 'Bắc Ninh', addresses: ['KCN Thuận Thành 9, Bắc Ninh'] })!
  const pr = await resolveAutoLocation(parkJob, quotaDeps(vm([{ ref_id: 'vm1', name: 'KCN Thuận Thành 9', address: 'Bắc Ninh', display: 'Bắc Ninh' }], { lat: 21.03, lng: 106.08, city: 'Bắc Ninh' })))
  // 2026-11-11 Lee 절대 원칙 "위치를 모르면 마음대로 찍지 마": 대략 위치(동·시·공단 중심)는 핀 없이 못 찾음 — 예전 대략 핀 기대값을 바꿈
  assert(pr.kind === 'unresolved' && !('lat' in pr) && /google:quota/.test(String(pr.evidence)), 'unlisted park center not pinned, quota kept: ' + JSON.stringify(pr))
  assert(precheckVerdict(pr).reason === 'google_quota', 'quota then unlisted park center → still google_quota: ' + precheckVerdict(pr).reason)
}
// Codex #619: '못 찾음' 7일 뒤 다시 확인(refreshGoogle)은 저장된 Google '없음'을 다시 쓰지 않고 새로 묻는다 → 이번엔 찾음
{
  store.clear(); asked = 0
  const first = precheckVerdict(await resolveAutoLocation(job1, deps(async () => ({ places: [] }))))
  assert(!first.findable && asked === 1, 'first: Google knows nothing')
  const again = precheckVerdict(await resolveAutoLocation(job1, deps(async () => hoj)))
  assert(!again.findable && asked === 1, 'normal run reuses stored negative (no new request)')
  const fresh = precheckVerdict(await resolveAutoLocation(job1, { ...deps(async () => hoj), refreshGoogle: true }))
  assert(fresh.findable && asked === 2, 'recheck asks Google again and finds it: ' + JSON.stringify(fresh))
  assert(googlePlaceHits(store.get(googleCacheKeys(job1.company, job1.targets[0].address)[0])).length === 1, 'new result stored over the old negative')
  store.clear()
}
const other = precheckVerdict(await resolveAutoLocation(job1, deps(async () => { throw new Error('upstream_failed') })))
assert(other.reason !== 'google_quota', 'other provider error is not quota')
const nf = precheckVerdict(await resolveAutoLocation(job1, deps(async () => ({ places: [] }))))
assert(!nf.findable && nf.reason !== 'google_quota', 'Google knows nothing → still not found (not held): ' + nf.reason)

console.log('googleQuotaCache: exact-text reuse, branch separation, quota hold reason passed')
