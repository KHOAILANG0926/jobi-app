import { createVietMapStyleUrl } from './vietMapStyle.ts'

function assert(condition: boolean, label: string): void {
  if (!condition) throw new Error(label)
}

const url = createVietMapStyleUrl('key with symbols/+')
assert(url.startsWith('https://maps.vietmap.vn/maps/styles/tm/style.json?'), 'street mode uses the official VIETMAP Vector Street style')
assert(new URL(url).searchParams.get('apikey') === 'key with symbols/+', 'encodes the Tilemap key')
assert(!url.includes('/styles/lm/') && !url.includes('/styles/hm/'), 'street mode does not select Light or Hybrid')

const satellite = createVietMapStyleUrl('k', 'satellite')
assert(satellite.startsWith('https://maps.vietmap.vn/maps/styles/hm/style.json?'), 'satellite mode uses the official VIETMAP Hybrid style')
assert(new URL(satellite).searchParams.get('apikey') === 'k', 'satellite mode keeps the same Tilemap key')

let emptyKeyRejected = false
try {
  createVietMapStyleUrl('  ')
} catch {
  emptyKeyRejected = true
}
assert(emptyKeyRejected, 'rejects an empty Tilemap key before requesting map assets')

console.log('vietMapStyle.test.ts: official Vector Street / Hybrid style assertions passed')
