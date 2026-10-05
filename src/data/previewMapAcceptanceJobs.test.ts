import { DEFAULT_FILTERS, findNearbyJobs, verifiedJobPoints } from '../lib/homeMapFilters.ts'
import { previewMapAcceptanceJobs } from './previewMapAcceptanceJobs.ts'

function assert(condition: boolean, label: string): void {
  if (!condition) throw new Error(label)
}

assert(previewMapAcceptanceJobs.length === 5, 'five reviewed advertisements')
assert(previewMapAcceptanceJobs.every((job) => verifiedJobPoints(job).length === 1), 'each ad has one verified workplace')
assert(new Set(previewMapAcceptanceJobs.map((job) => {
  const point = verifiedJobPoints(job)[0]
  return `${point.lat},${point.lng}`
})).size === 3, 'five ads have exactly three physical sites')

const city = { lat: 21.1861, lng: 106.0763 }
const terminal = { lat: 21.1868716, lng: 106.0685263 }
for (const radiusKm of [0.1, 0.2, 0.5]) {
  const filters = { ...DEFAULT_FILTERS, radiusKm }
  assert(findNearbyJobs(previewMapAcceptanceJobs, city, filters).length === 0, `${radiusKm}km from city center has no fixture sites`)
  assert(findNearbyJobs(previewMapAcceptanceJobs, terminal, filters).length === 3, `${radiusKm}km from verified Terminal site has all three roles`)
}
assert(findNearbyJobs(previewMapAcceptanceJobs, city, DEFAULT_FILTERS).length === 5, 'default 8km shows all five')
assert(!/hoteljob\.vn|muaban\.net|source_url_internal|\/viec-lam\/\d{6}/i.test(JSON.stringify(previewMapAcceptanceJobs)), 'source links and ids do not enter the browser bundle')
console.log('previewMapAcceptanceJobs.test.ts: five ads, three sites, 100/200/500m filtering and no source links passed')
