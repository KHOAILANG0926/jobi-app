const assert = { equal(a: unknown, b: unknown, message = '') { if (a !== b) throw new Error(message || `${a} !== ${b}`) }, deepEqual(a: unknown, b: unknown, message = '') { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(message || 'not equal') } }
import * as model from './mapR1.ts'
import { DEFAULT_FILTERS } from './homeMapFilters.ts'
import type { Job } from '../types/job.ts'
assert.equal(typeof model.mapSearch, 'function', 'MAP-R1 search model exists')
const job = (id: string, locations: unknown[] = []) => ({ id, title: id, company: 'Fixture', salary: '15 triệu', category: 'dich_vu', workLocations: locations } as Job)
const exact = job('one', [{ lat: 21.03, lng: 105.85, locationVerified: true }])
const far = job('two', [{ lat: 21.2, lng: 106.0, locationVerified: true }])
const rep = job('three')
const reps = { three: { kind: 'gate', lat: 21.03, lng: 105.85, source: 'OSM node/test', checkedAt: '2026-10-15' } } as const
const bounds = { west: 105.8, east: 105.9, south: 21, north: 21.1 }
const all = model.mapSearch([exact, exact, far, rep, job('unknown')], DEFAULT_FILTERS, null, null, bounds, reps)
assert.equal(all.visibleCount, 2)
assert.equal(all.unresolvedCount, 1)
assert.equal(all.entries.length, 4, 'deduplicate jobs and keep unlocated list entries')
const radius = model.mapSearch([exact, far, rep], DEFAULT_FILTERS, { lat: 21.03, lng: 105.85 }, 0.5, bounds, reps)
assert.deepEqual(radius.radiusJobs.map(x => x.job.id), ['one'])
assert.equal(radius.markers.length, 2, 'representatives stay on map outside exact radius results')
assert.equal(model.mapSearch([exact, far], DEFAULT_FILTERS, null, null, { ...bounds, east: 106.1, north: 21.3 }, {}).visibleCount, 2)
assert.equal(model.readViewport('{bad'), null)
assert.equal(model.readViewport(JSON.stringify({ center: {lat: 999, lng: 105}, zoom: 10 })), null)
assert.equal(model.readViewport(JSON.stringify({ center: {lat: 21, lng: 105}, zoom: 99 })), null)
assert.deepEqual(model.readViewport(JSON.stringify({ center: {lat: 21, lng: 105}, zoom: 10 })), {center:{lat:21,lng:105},zoom:10})
assert.equal(model.locationPoints(exact, { one: reps.three })[0].kind, 'exact', 'do not downgrade exact')
assert.equal(model.locationPoints(job('bad'), {bad:{...reps.three, source:''}}).length, 0)
console.log('mapR1: search, precision, viewport, dedup assertions passed')

assert.equal(model.locationPoints(rep, {three:{...reps.three,kind:'exact'}}).length, 0, 'representative feed cannot approve exact coordinates')

const multi = model.mapSearch([job('multi', [{lat:21.03,lng:105.85,locationVerified:true},{lat:21.2,lng:106,locationVerified:true}])], DEFAULT_FILTERS, null, null, bounds, {}).entries[0]
assert.equal(model.selectedMapEntry(multi, {lat:21.2,lng:106}, {lat:21.2,lng:106})?.distanceKm, 0, 'clicked workplace supplies distance')

// PC 목록은 지도 안 핀 수와 같은 공고만 표시한다. 이동하면 전체 목록 대신 해당 화면으로 바뀐다.
assert.deepEqual(all.visibleEntries?.map(e => e.job.id), ['one', 'three'], 'viewport list excludes outside/unlocated jobs and duplicates')
assert.deepEqual(radius.visibleEntries?.map(e => e.job.id), ['one', 'three'], 'representative pins in viewport remain in the list while radius is active')
const moved = model.mapSearch([exact, far, rep], DEFAULT_FILTERS, null, null,
  { west: 105.95, east: 106.05, south: 21.15, north: 21.25 }, reps)
assert.deepEqual(moved.visibleEntries?.map(e => e.job.id), ['two'], 'panning changes the list to the other visible job')
assert.deepEqual(model.mapSearch([exact, far, rep], DEFAULT_FILTERS, null, null, null, reps).visibleEntries, [], 'unknown viewport does not show all jobs')
