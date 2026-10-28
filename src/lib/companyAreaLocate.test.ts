// 회사명+원문 지역(공단 밖·번지 없음) — Lee 2026-10-28. 합성 VietMap 응답만 사용(운영 호출 없음).
import * as resolver from './autoLocationResolver.ts'
import { originalStreet } from './companyAreaLocate.ts'
function assert(v: unknown, m: string) { if (!v) throw new Error(m) }

assert(originalStreet('Ngô Tất Tố - TP. Bắc Ninh') === 'ngo tat to', 'street without house number is kept')
assert(originalStreet('Phường Võ Cường, TP. Bắc Ninh') === '', 'administrative-only address has no street')
const address = 'Ngô Tất Tố - TP. Bắc Ninh'
const job = { id: 1, company: 'Bomunttl', location: address, targets: [{ address, workLocationId: 7 }] }
const shop = { ref_id: 'fixture-shop', name: 'Bomunttl', address: 'Ngô Tất Tố, Võ Cường, Bắc Ninh' }
const place = { name: 'Bomunttl', display: 'Ngô Tất Tố, Võ Cường, Bắc Ninh', lat: 21.1735, lng: 106.0610, ward: 'Võ Cường', city: 'Bắc Ninh' }
async function run(hits: unknown, detail: unknown) {
  const seen: Array<{ action: string; text?: string }> = []
  const r = await resolver.resolveAutoLocation(job, {
    async cached() { return null }, async cache() {}, async reserve() { return true },
    async request(action: string, params: Record<string, string>) { seen.push({ action, text: params.text }); return action === 'search' ? hits : detail },
  })
  return { r, seen }
}
const ok = await run([shop], place)
assert(ok.r.kind === 'exact' && ok.r.workLocationId === 7 && ok.seen.map(s => s.action).join(',') === 'search,place', 'single exact shop on the original street inside the original area is adopted')
assert(ok.seen[0].text?.startsWith('Bomunttl '), 'company name search is used outside an industrial park')
const two = await run([shop, { ...shop, ref_id: 'fixture-shop-2' }], place)
assert(two.r.kind !== 'exact' && !two.seen.some(s => s.action === 'place'), 'two same-name candidates are never adopted')
const street = await run([shop], { ...place, display: 'Lý Thái Tổ, Võ Cường, Bắc Ninh' })
assert(street.r.kind !== 'exact', 'different street is not adopted')
const outside = await run([shop], { ...place, display: 'Ngô Tất Tố, Hà Nội', lat: 21.0285, lng: 105.8542, city: 'Hà Nội' })
assert(outside.r.kind !== 'exact', 'outside the original province is not adopted')
const name = await run([{ ...shop, name: 'Bomunttl Coffee' }], place)
assert(name.r.kind !== 'exact' && !name.seen.some(s => s.action === 'place'), 'non-identical name is not adopted')
const none = await resolver.resolveAutoLocation({ id: 2, company: 'Fixture', location: 'unknown', targets: [] }, {
  async cached() { return null }, async cache() {}, async reserve() { return true }, async request() { throw new Error('no call expected') },
})
const legal = await resolver.resolveAutoLocation({ ...job, company: 'Công ty TNHH Bomunttl' }, {
  async cached() { return null }, async cache() {}, async reserve() { return true },
  async request(action: string) { return action === 'search' ? [{ ...shop, name: 'Công ty TNHH Bomunttl' }] : { ...place, name: 'Công ty TNHH Bomunttl' } },
})
assert(legal.kind !== 'exact', 'registered-company-like POI outside an industrial park is not adopted')
assert(none.kind === 'unresolved', 'no original area means no company search')
console.log('companyAreaLocate: shop name + original area/street adopted; multiple, other street, outside area, name mismatch rejected')
