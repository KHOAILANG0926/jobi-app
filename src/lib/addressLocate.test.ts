import { parseStreetAddress, isWideAreaAddress, isDetailedAddress, hasConflictingProvinces, pickAddressHit, judgeAddressPois, ADDRESS_STRATEGY } from './addressLocate.ts'
import { runAutoLocate, type AutoLocateDeps, type AutoLocateJob } from './chototAutoLocate.ts'
import { DailyLimitError } from './adminVietmapClient.ts'

function assert(cond: boolean, msg: string) { if (!cond) throw new Error(`FAIL: ${msg}`) }

const A1 = '374 Trần Phú, Phường Tam Sơn, Thị xã Từ Sơn, Bắc Ninh'
{
  const p = parseStreetAddress(A1)
  assert(p.searchable && p.numbers[0] === '374' && p.nameTokens.join(' ') === 'tran phu', 'number + street name parsed')
  const t = parseStreetAddress('Số 354 Đường Thanh Niên, Phường Tân Hưng, Thành phố Hải Phòng')
  assert(t.numbers[0] === '354' && t.nameTokens.join(' ') === 'thanh nien', '"Số … Đường …" generic words dropped')
  const m = parseStreetAddress('Pizza Hut Bắc Ninh: 1A Lê Thái Tổ, TP. Bắc Ninh, Phường Võ Cường')
  assert(m.numbers[0] === '1a' && m.nameTokens.join(' ') === 'le thai to', 'company prefix before ":" ignored, "Tổ" is kept as a name')
  const q = parseStreetAddress('Điện Máy Xanh – Lô A1 và A2, thửa đất 50 và 51, KDC dịch vụ Đồng Khu, Phường Từ Sơn')
  assert(q.detailed && !q.searchable, 'lot-only address is detailed but not searchable')
  assert(!parseStreetAddress('Đường Số 14, Xã Tam Đa, Huyện Yên Phong').searchable, 'road number only (no name) is not searchable')
  assert(!parseStreetAddress('KCN VISIP, Phường Từ Sơn, Thị xã Từ Sơn, Bắc Ninh').detailed, 'KCN name alone is not a detailed address')
  assert(!isDetailedAddress('Phường Võ Cường, Thành phố Bắc Ninh, Bắc Ninh'), 'ward-level address is not detailed')
  assert(isDetailedAddress('Phố Nguyễn Trãi, Phường Hạp Lĩnh, Thành phố Bắc Ninh'), 'street without number is detailed (but not searchable)')
}
{
  assert(isWideAreaAddress('Huyện Yên Phong, Bắc Ninh') && isWideAreaAddress('Thị xã Từ Sơn, Bắc Ninh') && isWideAreaAddress('Bắc Ninh'), 'district/province-only → Khu vực rộng')
  assert(!isWideAreaAddress('Phường Võ Cường, Thành phố Bắc Ninh, Bắc Ninh') && !isWideAreaAddress('Xã Tam Đa, Huyện Yên Phong, Bắc Ninh'), 'ward/xã present → not wide')
  assert(!isWideAreaAddress('374 Trần Phú, Huyện Yên Phong') && !isWideAreaAddress(''), 'street detail or empty → not wide')
}
{
  assert(hasConflictingProvinces('Số 354 Đường Thanh Niên, Phường Tân Hưng, Thành phố Hải Phòng, Phường Võ Cường, Thành phố Bắc Ninh, Bắc Ninh'), 'Hải Phòng + Bắc Ninh conflict')
  assert(!hasConflictingProvinces('37 Lý Thái Tổ, TP. BẮC NINH, TỈNH BẮC NINH, Phường Võ Cường, Thành phố Bắc Ninh, Bắc Ninh'), 'same province written twice is fine')
}
{
  const hit = (ref: string, name: string, address: string) => ({ ref_id: ref, name, address })
  const ok = pickAddressHit(A1, [hit('a', '374 Trần Phú', 'Phường Tam Sơn, Từ Sơn, Bắc Ninh'), hit('b', '374 Trần Phú', 'Phường Hạ Long, Hạ Long, Quảng Ninh'), hit('c', '37 Trần Phú', 'Tam Sơn, Từ Sơn')])
  assert(ok.hit?.ref_id === 'a' && !ok.multiple, 'exact number + street + district → one hit; other city / other number rejected')
  assert(pickAddressHit(A1, [hit('x', '373 Trần Phú', 'Tam Sơn, Từ Sơn')]).hit === null, 'different house number is not accepted')
  assert(pickAddressHit(A1, [hit('x', '374 Trần Phú', 'Tam Sơn, Từ Sơn'), hit('y', 'Quán A - 374 Trần Phú', 'Tam Sơn, Từ Sơn')]).multiple === true, 'two matches → multiple, no auto approval')
}
{
  const poi = (units: { ward?: string; district?: string; province?: string }) => ({ name: '374 Trần Phú', address: '', lat: 21.1, lng: 105.9, refId: 'a', units })
  assert(judgeAddressPois({ address: A1 }, { hits: 1, pois: [poi({ ward: 'Phường Tam Sơn', district: 'Thị xã Từ Sơn' })] }).approvePoi !== null, 'old ward/district names match → approve')
  assert(judgeAddressPois({ address: A1 }, { hits: 1, pois: [poi({ ward: 'Phường Hạ Long', district: 'Thành phố Hạ Long', province: 'Quảng Ninh' })] }).reason === 'address_not_inside', 'other district → no pin')
  assert(judgeAddressPois({ address: A1 }, { hits: 3, pois: [] }).reason === 'address_not_found' && judgeAddressPois({ address: A1 }, { hits: 0, pois: [] }).reason === 'no_search_result', 'no hit vs no match')
}
{
  // 러너: 공고 1곳당 Search 1 + Place 1, 승인은 번지·도로 일치 1곳일 때만.
  const calls = { search: 0, place: 0, texts: [] as string[], added: [] as number[], approved: [] as number[] }
  const deps: AutoLocateDeps = {
    async search(b) {
      calls.search++; calls.texts.push(b.text)
      const data = b.text.startsWith('374 Trần Phú')
        ? [{ ref_id: 'r1', name: '374 Trần Phú', address: 'Phường Tam Sơn, Từ Sơn, Bắc Ninh' }]
        : b.text.startsWith('125 Đường Nguyễn') ? [{ ref_id: 'r2', name: '12 Nguyễn Thị Minh Khai', address: 'Kinh Bắc, Bắc Ninh' }] : []
      return { data, used: calls.search + calls.place, limit: 250 }
    },
    async place() { calls.place++; return { data: { name: '374 Trần Phú', lat: 21.115, lng: 105.955, ward: 'Phường Tam Sơn', district: 'Thị xã Từ Sơn', city: 'Bắc Ninh' }, used: calls.search + calls.place, limit: 250 } },
    async addCandidate(i) { calls.added.push(i.jobId); return { id: 900 + i.jobId } },
    async approve(id) { calls.approved.push(id) },
    async loadCache() { return null }, async saveCache() {},
  }
  const mk = (id: number, address: string, existing: AutoLocateJob['existing'] = []): AutoLocateJob => ({ id, company: '', location: 'Bắc Ninh', existing, targets: [{ workLocationId: id, address, focus: null }] })
  const r = await runAutoLocate([
    mk(1, A1),
    mk(2, '125 Đường Nguyễn Thị Minh Khai, Phường Kinh Bắc, Thành phố Bắc Ninh, Bắc Ninh'),
    mk(3, 'Đường Số 14, Xã Tam Đa, Huyện Yên Phong, Bắc Ninh'),
    mk(4, 'Số 354 Đường Thanh Niên, Phường Tân Hưng, Thành phố Hải Phòng, Phường Võ Cường, Thành phố Bắc Ninh, Bắc Ninh'),
    mk(5, A1, [{ id: 7, address_snapshot: A1, lat: 21.1, lng: 105.9, status: 'approved' }]),
  ], deps, { strategy: ADDRESS_STRATEGY, expectedTotal: 5 })
  assert(calls.search === 2 && calls.place === 1, 'only searchable, not-yet-approved addresses call VietMap; Place only for the matching hit')
  assert(calls.texts[0] === '374 Trần Phú, Phường Tam Sơn, Thị xã Từ Sơn, Bắc Ninh', 'query = street + the old ward/district names from the posting')
  assert(r.autoApproved === 1 && r.alreadyApproved === 1 && r.noPin === 3 && r.searched === 5 && r.stopped === 'done', 'counts: 1 approved, 1 already, 3 no pin')
  const reasons = Object.fromEntries(r.outcomes.map((o) => [o.jobId, o.reason ?? o.status]))
  assert(reasons[2] === 'address_not_found' && reasons[3] === 'no_house_number' && reasons[4] === 'address_conflict', 'no-pin reasons are specific')
  assert(r.callsThisRun === 3 && calls.added.join() === '1' && calls.approved.join() === '901', 'one candidate created and approved')
  void DailyLimitError
}
console.log('addressLocate tests: all assertions passed')
