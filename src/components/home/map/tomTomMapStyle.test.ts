import { createTomTomOrbisStyleUrl } from './tomTomMapStyle.ts'

function assert(condition: boolean, label: string): void {
  if (!condition) throw new Error(label)
}

const url = createTomTomOrbisStyleUrl('key with symbols/+')
assert(url.startsWith('https://api.tomtom.com/maps/orbis/assets/styles/0.*/style?'), 'uses official Orbis Assets API style endpoint')
assert(url.includes('apiVersion=1'), 'uses Assets API version 1')
assert(url.includes('map=basic_street-light'), 'uses the standard light street map')
assert(new URL(url).searchParams.get('key') === 'key with symbols/+', 'encodes the API key')
assert(!url.includes('trafficFlow=') && !url.includes('trafficIncidents='), 'does not add unrelated overlays')

let emptyKeyRejected = false
try {
  createTomTomOrbisStyleUrl('  ')
} catch {
  emptyKeyRejected = true
}
assert(emptyKeyRejected, 'rejects an empty key before requesting map assets')

console.log('tomTomMapStyle.test.ts: Orbis style URL assertions passed')
