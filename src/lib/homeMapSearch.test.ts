import { formatSearchRadius, normalizeSearchRadius, locationAccuracyWarning, summarizeMapJobs } from './homeMapSearch.ts'
import { DEFAULT_FILTERS, findNearbyJobs } from './homeMapFilters.ts'
import type { Job } from '../types/job.ts'

function assert(value: boolean, label: string) { if (!value) throw new Error(label) }
const origin = { lat: 21.1861, lng: 106.0763 }
function fixture(id: string, meters: number, verified = true, salary = '15 triệu'): Job {
  return { id, title: id, salary, category: 'san_xuat_xay_dung', workLocations: [{
    id: 1, rawAddress: 'test', sortOrder: 0, locationVerified: verified,
    lat: origin.lat + meters / 111195.08023352181, lng: origin.lng,
  }] } as Job
}
assert(normalizeSearchRadius(0.1) === 0.1, '100m is selectable')
assert(normalizeSearchRadius(0) === 0.1 && normalizeSearchRadius(21) === 20, 'bounds are clamped')
assert(normalizeSearchRadius(0.30000000004) === 0.3, 'slider decimals do not drift')
assert(formatSearchRadius(0.1) === '100 m' && formatSearchRadius(0.3) === '300 m', 'sub-km values use meters')
assert(formatSearchRadius(1) === '1 km' && formatSearchRadius(1.5) === '1.5 km', 'km labels remain precise')
const jobs = [fixture('inside', 99), fixture('outside', 101), fixture('unknown', 20, false), fixture('salary', 50, true, '5 triệu')]
const filters = { ...DEFAULT_FILTERS, radiusKm: 0.1, minSalary: 10000000 }
const results = findNearbyJobs(jobs, origin, filters)
assert(results.length === 1 && results[0].job.id === 'inside', '99m included, 101m and unverified excluded')
const counts = summarizeMapJobs(jobs, origin, filters)
assert(counts.loaded === 4 && counts.verified === 3 && counts.inRadius === 2 && counts.matched === 1, 'funnel counts jobs at each stage')
assert(counts.unverified === 1 && counts.outsideRadius === 1 && counts.filteredOut === 1, 'exclusion categories partition jobs')
assert(locationAccuracyWarning(150, 0.1), '150m accuracy warns at 100m radius')
assert(!locationAccuracyWarning(20, 0.1), '20m accuracy is within 100m radius')
assert(locationAccuracyWarning(Number.NaN, 0.1), 'unknown accuracy is not presented as precise')
console.log('homeMapSearch.test.ts: 100m boundaries, labels, accuracy and job counts passed')
