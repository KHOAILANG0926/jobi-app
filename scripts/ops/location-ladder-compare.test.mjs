// location-ladder-compare 자체 시험(네트워크 없음). 실행: node --experimental-strip-types --import ./scripts/ts-extensionless-register.mjs scripts/ops/location-ladder-compare.test.mjs
import assert from 'node:assert/strict'
import { googleClient, ladderGoogle, compareOne, summarize, precheckInputOf, siteKeyOf, maskContacts } from './location-ladder-compare.mjs'

const json = (body) => ({ ok: true, json: async () => body })
// 가짜 Google: Pro는 같은 이름 2곳(다른 거리), Autocomplete는 같은 이름 1곳, 상세는 좌표.
const proBody = { places: [
  { id: 'P1', displayName: { text: 'Công ty TNHH Woojeon Vina' }, formattedAddress: 'Lô C, KCN Quế Võ, Phường Nam Sơn, Bắc Ninh', location: { latitude: 21.13, longitude: 106.13 } },
  { id: 'P2', displayName: { text: 'Woojeon Vina' }, formattedAddress: 'Hà Nội', location: { latitude: 21.0, longitude: 105.8 } },
] }
function fakeFetch(log) {
  return async (url, init) => {
    const mask = init.headers['X-Goog-FieldMask']
    if (url.endsWith(':searchText') && mask === 'places.id') { log.push('ids'); return json({ places: [{ id: 'P1' }, { id: 'P2' }] }) }
    if (url.endsWith(':searchText')) { log.push('pro'); return json(proBody) }
    if (url.endsWith(':autocomplete')) { log.push('ac'); return json({ suggestions: [{ placePrediction: { placeId: 'P1', structuredFormat: { mainText: { text: 'Công ty TNHH Woojeon Vina' }, secondaryText: { text: 'KCN Quế Võ, Bắc Ninh' } } } }] }) }
    if (url.includes('/places/P1')) { log.push('details'); return json({ id: 'P1', formattedAddress: proBody.places[0].formattedAddress, location: proBody.places[0].location }) }
    throw new Error('unexpected ' + url)
  }
}

// 1) 사다리: 장부 없음 → Autocomplete 1곳 → 상세. Pro는 부르지 않는다.
{
  const log = [], trace = {}
  const g = googleClient('k', fakeFetch(log))
  const r = await ladderGoogle({ g, registry: new Map(), proFor: async () => { throw new Error('pro not expected') }, company: 'Woojeon Vina', address: 'KCN Quế Võ, Bắc Ninh', trace })('q')
  assert.deepEqual(log, ['ids', 'ac', 'details'])
  assert.equal(trace.step, 'autocomplete')
  assert.equal(r.places[0].id, 'P1')
}
// 2) 장부에 같은 이름 Place ID가 있으면 무료 IDs 검색만으로 끝.
{
  const log = [], trace = {}
  const g = googleClient('k', fakeFetch(log))
  const registry = new Map([['P1', { siteKey: siteKeyOf('x'), place: proBody.places[0] }]])
  await ladderGoogle({ g, registry, proFor: async () => null, company: 'Woojeon Vina', address: 'x', trace })('q')
  assert.deepEqual(log, ['ids'])
  assert.equal(trace.step, 'registry')
}
// 2-1) 장부에 같은 이름이 있어도 다른 사업장(주소 다름)이면 재사용하지 않고 다음 단계로(Codex #608 P2).
{
  const log = [], trace = {}
  const g = googleClient('k', fakeFetch(log))
  const registry = new Map([['P1', { siteKey: siteKeyOf('12 Lý Thái Tổ, Bắc Ninh'), place: proBody.places[0] }]])
  await ladderGoogle({ g, registry, proFor: async () => null, company: 'Woojeon Vina', address: 'KCN Quế Võ, Bắc Ninh', trace })('q')
  assert.notEqual(trace.step, 'registry')
  assert.equal(trace.registrySkipped, 1)
}
// 2-2) Pro는 운영 한도 예약이 거절되면 부르지 않는다(Codex #608 P1).
{
  const log = []
  const g = googleClient('k', fakeFetch(log), undefined, async () => false)
  await assert.rejects(() => g.pro('q'), /quota_exhausted/)
  assert.deepEqual(log, [])
}
// 3) 호출 상한을 넘으면 부르지 않는다.
{
  const g = googleClient('k', fakeFetch([]), { pro: 0, ids: 0, autocomplete: 0, details: 0 })
  await assert.rejects(() => g.ids('q'), /test_cap_reached/)
}
// 3-2) 시험 몫(Lee 2026-11-09): Pro·IDs 모두 시험 몫을 먼저 예약, 다 쓰면 Google을 부르지 않는다. 실행당 SearchText 합계 상한.
{
  const log = []
  let test = 0, ops = 0
  const g = googleClient('k', fakeFetch(log), undefined, async () => (ops++, true), async () => test++ < 2, 3)
  await g.ids('a'); await g.pro('b')
  await assert.rejects(() => g.ids('c'), /test_quota_exhausted/)
  assert.equal(log.length, 2); assert.equal(ops, 1, 'IDs Only는 운영 몫에 안 셈, Pro만')
  const h = googleClient('k', fakeFetch([]), undefined, async () => true, async () => true, 2)
  await h.ids('a'); await h.pro('b')
  await assert.rejects(() => h.ids('c'), /test_cap_reached/)
}
// 4) 입력 변환 = 수집기 precheck_input과 같은 칸
{
  const i = precheckInputOf({ company: 'X', _company_from_text: true, location: 'Bắc Ninh', source_text: 'abc', work_locations: [{ raw_address: ' 12 Lý Thái Tổ ' }, {}] })
  assert.deepEqual(i, { company: '', location: 'Bắc Ninh', addresses: ['12 Lý Thái Tổ'], source_text: 'abc', poster_text: '' })
}
// 5) 한 건 비교 + 집계(VietMap·Goong은 결과 없음)
{
  const log = []
  const g = googleClient('k', fakeFetch(log))
  const ctx = { g, registry: new Map(), shared: new Map(), vietmap: async () => [], goong: null }
  const row = await compareOne({ company: 'Công ty TNHH Woojeon Vina', location: 'Bắc Ninh', addresses: ['Lô C, KCN Quế Võ, Phường Nam Sơn, Bắc Ninh'], source_text: '', poster_text: '' }, ctx)
  assert.ok(row.a && row.b, JSON.stringify(row))
  assert.equal(row.b.step, 'autocomplete')
  const s = summarize([row], g.calls)
  assert.equal(s.n, 1)
  assert.equal(s.usage.a.pro, 1)
  assert.ok(s.perJobUSD.b < s.perJobUSD.a)
  console.log('row', JSON.stringify({ a: row.a, b: row.b, same: row.same }))
}
// 6) 공개 로그 가림(Codex #615 P1): 구분자가 여러 글자여도 전화번호는 가린다. 주소 번지·짧은 숫자는 남긴다.
for (const raw of ['Zalo: 0987  123  456', 'ĐT 0912.345.678', '(+84) 912 - 345 - 678', '0987 – 123 – 456', 'sđt:0912345678', 'mail a.b@gmail.com', 'https://zalo.me/0912345678']) {
  assert.ok(!/\d{3}/.test(maskContacts(raw).replace(/\+84/, '')), `masked: ${raw} → ${maskContacts(raw)}`)
}
assert.equal(maskContacts('Số 37 Đường Lý Thái Tổ, ca 8h-17h'), 'Số 37 Đường Lý Thái Tổ, ca 8h-17h')
console.log('location-ladder-compare: all assertions passed')
