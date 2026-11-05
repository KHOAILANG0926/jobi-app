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
assert(result.kind === 'exact' && result.lat === 21 && result.lng === 105.8, 'pin must come from street verification, never the Google company coordinate')
assert(result.address === original && result.workLocationId === 55, 'canonical writer target identity must remain the original work location')
assert(result.evidence?.includes(street), 'recovered street must be retained as evidence')
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
assert(googleCalls <= 1 && goongCalls <= 3, `all stages share provider caps: Google=${googleCalls}, Goong=${goongCalls}`)
