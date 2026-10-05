import { createVietMapStyleUrl } from './vietMapStyle.ts'

function assert(condition: boolean, label: string): void {
  if (!condition) throw new Error(label)
}

const url = createVietMapStyleUrl('key with symbols/+')
assert(url.startsWith('https://maps.vietmap.vn/maps/styles/tm/style.json?'), 'uses the official VIETMAP Vector Street style')
assert(new URL(url).searchParams.get('apikey') === 'key with symbols/+', 'encodes the Tilemap key')
assert(!url.includes('/styles/lm/') && !url.includes('/styles/hm/'), 'does not select Light, Satellite, or Hybrid')

let emptyKeyRejected = false
try {
  createVietMapStyleUrl('  ')
} catch {
  emptyKeyRejected = true
}
assert(emptyKeyRejected, 'rejects an empty Tilemap key before requesting map assets')

console.log('vietMapStyle.test.ts: official Vector Street style assertions passed')
