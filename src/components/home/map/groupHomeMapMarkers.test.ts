import { groupHomeMapMarkers } from './groupHomeMapMarkers'

function assert(condition: boolean, label: string): void {
  if (!condition) throw new Error(label)
}

const groups = groupHomeMapMarkers([
      { id: 'reception', label: 'Reception', lat: 21.1868716, lng: 106.0685263 },
      { id: 'pizza', label: 'Pizza', lat: 21.1719011, lng: 106.061922 },
      { id: 'bar', label: 'Bar', lat: 21.1868716, lng: 106.0685263 },
      { id: 'service', label: 'Service', lat: 21.1868716, lng: 106.0685263 },
    ])
assert(groups.length === 2, 'two physical locations')
assert(groups[0].map((marker) => marker.id).join(',') === 'reception,bar,service', 'all three roles stay selectable')
assert(groups[0][0].lat === 21.1868716 && groups[0][0].lng === 106.0685263, 'workplace is not jittered')
assert(groups[1].map((marker) => marker.id).join(',') === 'pizza', 'other location remains separate')
console.log('groupHomeMapMarkers.test.ts: same-coordinate jobs remain individually addressable')
