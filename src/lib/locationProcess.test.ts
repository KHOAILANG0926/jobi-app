import { resolveAutoLocation } from './autoLocationResolver.ts'
function assert(ok: unknown, message: string) { if (!ok) throw new Error(message) }
const original = 'KCN Yên Phong (khu mở rộng), xã Yên Trung, Bắc Ninh'
const street = '12 Nguyễn Trãi, Phường Võ Cường, Bắc Ninh'
const calls: string[] = []
const result = await resolveAutoLocation({ id: 900001, company: 'Example Robotics', location: original, targets: [{ address: original, workLocationId: 55 }] }, {
  async cached() { return null }, async cache() {}, async reserve() { return true },
  async request(action, params) {
    calls.push(`vietmap:${action}`)
    if (!params.text?.includes('12 Nguyễn Trãi') && action === 'search') return []
    return action === 'search' ? [{ ref_id: 'street', name: '12 Nguyễn Trãi', address: street }]
      : { name: '12 Nguyễn Trãi', display: street, lat: 21, lng: 105.8, ward: 'Võ Cường', district: '', city: 'Bắc Ninh' }
  },
  async google() { calls.push('google:company'); return { places: [{ id: 'company', displayName: { text: 'Example Robotics' }, formattedAddress: street, location: { latitude: 21.2, longitude: 106 } }] } },
  async goong(action, params) {
    calls.push(`goong:${action}`)
    if (action !== 'geocode' || !params.address?.includes('12 Nguyễn Trãi')) return { predictions: [] }
    return { results: [{ place_id: 'street', compound: { commune: 'Võ Cường', district: '', province: 'Bắc Ninh' }, formatted_address: street, geometry: { location: { lat: 21, lng: 105.8 } }, address_components: [
      { long_name: '12', types: ['street_number'] }, { long_name: 'Nguyễn Trãi', types: ['route'] },
      { long_name: 'Võ Cường', types: ['administrative_area_level_3'] },
      { long_name: 'Thanh Xuân', types: ['administrative_area_level_2'] }, { long_name: 'Bắc Ninh', types: ['administrative_area_level_1'] },
    ] }] }
  },
})
assert(calls.includes('google:company'), 'known industrial parks must not skip Google address recovery after a miss')
// #560(Lee 2026-11-09 "잘못된 위치 확정 0건"): 원문은 KCN Yên Phong인데 Google 장소 주소가 그 공단이 아닌 시내 거리면
// 같은 이름의 다른 사업장(사무실 등)일 수 있어 따르지 않는다 — Google 좌표도, 그 주소의 번지 검증 좌표도 쓰지 않고 공단 단계로 내려간다.
assert(!(result.kind === 'exact' && result.lat === 21 && result.lng === 105.8), 'Google place outside the named park must not become an exact pin')
assert(!('source' in result) || !/^Google /.test(String((result as { source?: string }).source)), 'never the Google company coordinate')
// 2026-11-11 Lee 절대 원칙 "위치를 모르면 마음대로 찍지 마": 대략 위치(동·시·공단 중심)는 핀 없이 못 찾음 — 예전 대략 핀 기대값을 바꿈
assert(result.kind === 'unresolved' ? !('lat' in result) : (result.address === original && result.workLocationId === 55), 'canonical writer target identity must remain the original work location (or no pin)')
assert(result.evidence?.includes('google:park_mismatch'), 'why Google was not followed must be retained as evidence')
console.log('locationProcess: industrial-park recovery, address replay and canonical target passed')
const missed = await resolveAutoLocation({ id: 900002, company: 'Example Robotics', location: original, targets: [] }, {
  async cached() { return null }, async cache() {}, async reserve() { return true }, async request() { return [] },
  async google() { return { places: [] } },
})
assert(missed.evidence?.includes('google:no_core_name'), 'failed company lookup must retain its reason in location evidence')
let googleCalls = 0, goongCalls = 0
await resolveAutoLocation({ id: 900003, company: 'Example Robotics', location: original, targets: [{ address: street, workLocationId: 1 }, { address: original, workLocationId: 2 }] }, {
  async cached() { return null }, async cache() {}, async reserve() { return true }, async request() { return [] },
  async goong() { goongCalls++; return { predictions: [] } },
  async google() { googleCalls++; return { places: [] } },
})
// 한 매장의 단계들은 상한(Google 1·Goong 3)을 나눠 쓴다. 매장이 여러 곳이면 매장마다 따로(Codex #697) — 이 공고는 2곳.
assert(googleCalls <= 2 && goongCalls <= 6, `each store shares provider caps across its stages: Google=${googleCalls}, Goong=${goongCalls}`)
