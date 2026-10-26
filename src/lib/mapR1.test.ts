const assert = { equal(a: unknown, b: unknown, message = '') { if (a !== b) throw new Error(message || `${a} !== ${b}`) }, deepEqual(a: unknown, b: unknown, message = '') { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(message || 'not equal') } }
import * as model from './mapR1.ts'
import { DEFAULT_FILTERS } from './homeMapFilters.ts'
import type { Job } from '../types/job.ts'
assert.equal(typeof model.mapSearch, 'function', 'MAP-R1 search model exists')
const job = (id: string, locations: unknown[] = []) => ({ id, title: id, company: 'Fixture', salary: '15 triệu', category: 'dich_vu', workLocations: locations } as Job)
const exact = job('one', [{ lat: 21.03, lng: 105.85, locationVerified: true, pointKind: 'exact' }])
const far = job('two', [{ lat: 21.2, lng: 106.0, locationVerified: true, pointKind: 'exact' }])
const rep = job('three', [{lat:21.03,lng:105.85,pointKind:'gate'}])
const reps = { three: { kind: 'gate', lat: 21.03, lng: 105.85, source: 'OSM node/test', checkedAt: '2026-10-15' } } as const
const bounds = { west: 105.8, east: 105.9, south: 21, north: 21.1 }
const all = model.mapSearch([exact, exact, far, rep, job('unknown')], DEFAULT_FILTERS, null, null, bounds, reps)
assert.equal(all.visibleCount, 2)
assert.equal(all.unresolvedCount, 1)
assert.equal(all.entries.length, 4, 'deduplicate jobs and keep unlocated list entries')
const radius = model.mapSearch([exact, far, rep], DEFAULT_FILTERS, { lat: 21.03, lng: 105.85 }, 0.5, bounds, reps)
assert.deepEqual(radius.radiusJobs.map(x => x.job.id), ['one', 'three'])
assert.equal(radius.markers.length, 2, 'representatives stay on map outside exact radius results')
assert.equal(model.mapSearch([exact, far], DEFAULT_FILTERS, null, null, { ...bounds, east: 106.1, north: 21.3 }, {}).visibleCount, 2)
assert.equal(model.readViewport('{bad'), null)
assert.equal(model.readViewport(JSON.stringify({ center: {lat: 999, lng: 105}, zoom: 10 })), null)
assert.equal(model.readViewport(JSON.stringify({ center: {lat: 21, lng: 105}, zoom: 99 })), null)
assert.deepEqual(model.readViewport(JSON.stringify({ center: {lat: 21, lng: 105}, zoom: 10 })), {center:{lat:21,lng:105},zoom:10})
assert.equal(model.locationPoints(exact, { one: reps.three })[0].kind, 'exact', 'do not downgrade exact')
assert.equal(model.locationPoints(job('bad'), {bad:{...reps.three, source:''}}).length, 0)
console.log('mapR1: search, precision, viewport, dedup assertions passed')

assert.equal(model.locationPoints(job('no-source'), {three:{...reps.three,kind:'exact'}}).length, 0, 'representative feed cannot approve exact coordinates')

const multi = model.mapSearch([job('multi', [{lat:21.03,lng:105.85,locationVerified:true,pointKind:'exact'},{lat:21.2,lng:106,locationVerified:true,pointKind:'exact'}])], DEFAULT_FILTERS, null, null, bounds, {}).entries[0]
assert.equal(model.selectedMapEntry(multi, {lat:21.2,lng:106}, {lat:21.2,lng:106})?.distanceKm, 0, 'clicked workplace supplies distance')

// PC 목록은 지도 안 핀 수와 같은 공고만 표시한다. 이동하면 전체 목록 대신 해당 화면으로 바뀐다.
assert.deepEqual(all.visibleEntries?.map(e => e.job.id), ['one', 'three'], 'viewport list excludes outside/unlocated jobs and duplicates')
assert.deepEqual(radius.visibleEntries?.map(e => e.job.id), ['one', 'three'], 'representative pins in viewport remain in the list while radius is active')
const moved = model.mapSearch([exact, far, rep], DEFAULT_FILTERS, null, null,
  { west: 105.95, east: 106.05, south: 21.15, north: 21.25 }, reps)
assert.deepEqual(moved.visibleEntries?.map(e => e.job.id), ['two'], 'panning changes the list to the other visible job')
assert.deepEqual(model.mapSearch([exact, far, rep], DEFAULT_FILTERS, null, null, null, reps).visibleEntries, [], 'unknown viewport does not show all jobs')

const broad = {west:105,east:107,south:20,north:22}
const area = {...reps.three, kind:'area' as const,lat:21.2,lng:106}
const small = model.mapSearch([job('three', [{lat:area.lat,lng:area.lng,pointKind:'area'}])], DEFAULT_FILTERS, {lat:21.03,lng:105.85}, 1, broad, {three:area})
assert.equal(small.markers.length, 1, 'representative pin stays on the map outside radius (Lee 10-13: pins always on main map)')
assert.equal(small.visibleEntries.length, 0, 'list must exclude representative outside radius')
const large = model.mapSearch([job('three', [{lat:area.lat,lng:area.lng,pointKind:'area'}])], DEFAULT_FILTERS, {lat:21.03,lng:105.85}, 30, broad, {three:area})
assert.equal(large.markers.length, 1, 'representative pin still on map with large radius')
assert.equal(large.visibleEntries.length, 1, 'expanding radius brings representative back into the list')
assert.equal(large.radiusJobs.length, 1, 'radius results include representative without upgrading precision')
assert.equal(large.radiusJobs[0].point?.kind, 'area')

const tefalUnverified = job('sb-4878', [{
  rawAddress: '33 Lý Thái Tổ, P. Ninh Xá, TP. Bắc Ninh',
  lat: 21.1737775, lng: 106.0650338, geocodeStatus: 'success', locationVerified: false, pointKind: 'area',
}])
const t = model.locationPoints(tefalUnverified, {})
assert.equal(t.length, 1, 'sourced address with unapproved workplace still appears on map')
assert.equal(t[0].kind, 'area', 'approximate address can never be an approved factory pin')
assert.equal(t[0].lat, 21.1737775, 'address map does not silently relocate to a ward center')
const nearTefal = model.mapSearch([tefalUnverified], DEFAULT_FILTERS, null, null,
  { west: 106, east: 106.1, south: 21.1, north: 21.2 }, {})
assert.equal(nearTefal.markers.length, 1, 'approximate address shows on main map')
assert.equal(nearTefal.visibleCount, 1, 'approximate address contributes to map viewport list')

const exactNotePoint = {lat:21,lng:106,kind:'exact' as const,precise:true}
const areaNotePoint = {lat:21.1,lng:106.1,kind:'area' as const,precise:false}
const mixedNote = model.mapPointAccuracyNote([exactNotePoint,areaNotePoint])
assert.equal(mixedNote.includes('1 địa điểm làm việc đã xác minh và 1 vị trí tham khảo'),true,'mixed accuracy note counts both verified and reference points')
assert.equal(model.mapPointAccuracyNote([{...areaNotePoint,precise:true}]).includes('đã xác minh'),false,'area kind is never counted as a verified workplace')
assert.equal(model.mapPointAccuracyNote([{...exactNotePoint,lat:99}]).includes('đã xác minh'),false,'invalid exact coordinate is never counted as verified')
assert.equal(model.mapPointAccuracyNote([{...exactNotePoint,precise:false}]).includes('đã xác minh'),false,'unverified exact metadata is never counted as verified')
