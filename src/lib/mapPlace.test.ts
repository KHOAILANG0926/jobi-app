import {
  buildingNameFromInside, isWorkplacePlace, jobsNearPlace, poiCategoryLabel, pointInPolygon, poisInsideBuilding, polygonCenter,
  type PolygonRings,
} from './mapPlace.ts'

function assert(value: boolean, label: string) { if (!value) throw new Error(label) }

// 0.001° square building around (106.0005, 21.0005) with a hole in the middle quarter.
const square: PolygonRings = [[[106, 21], [106.001, 21], [106.001, 21.001], [106, 21.001], [106, 21]]]
const withHole: PolygonRings = [square[0], [[106.0004, 21.0004], [106.0006, 21.0004], [106.0006, 21.0006], [106.0004, 21.0006], [106.0004, 21.0004]]]
assert(pointInPolygon([106.0002, 21.0002], square), 'point inside building')
assert(!pointInPolygon([106.002, 21.0002], square), 'point outside building')
assert(!pointInPolygon([106.0005, 21.0005], withHole), 'point in courtyard hole is outside')
const c = polygonCenter(square)
assert(Math.abs(c.lat - 21.0005) < 1e-9 && Math.abs(c.lng - 106.0005) < 1e-9, 'center ignores closing vertex')

const inside = { name: 'Cty Hans Tech Vina', cls: 'company', lat: 21.0003, lng: 106.0003 }
const outside = { name: 'Quán Phở', cls: 'restaurant', lat: 21.0012, lng: 106.0003 } // ~20 m north, outside
const pois = [inside, { ...inside }, outside, { name: '', cls: 'atm', lat: 21.0001, lng: 106.0001 }]
const found = poisInsideBuilding(square, pois)
assert(found.length === 1 && found[0].name === 'Cty Hans Tech Vina', 'only named POIs inside the polygon, deduplicated')
assert(buildingNameFromInside(found) === 'Cty Hans Tech Vina', 'single POI inside → name shown')
assert(buildingNameFromInside([]) === null, 'no POI inside → no name (nearby outside POI is never used)')
assert(buildingNameFromInside([inside, { ...outside, lat: 21.0002 }]) === null, 'several POIs inside → no single building name')

assert(poiCategoryLabel('department_store', 'Tạp Hóa') === 'Tạp hóa', 'known class label')
assert(poiCategoryLabel('', 'Cty Minh Anh') === 'Công ty', 'unclassed company name')
assert(poiCategoryLabel('karaoke', 'Karaoke X') === 'Địa điểm', 'unknown class falls back to generic label')
assert(isWorkplacePlace({ kind: 'building', cls: null, name: null, insidePois: [inside] }), 'building containing a company is a workplace')
assert(!isWorkplacePlace({ kind: 'poi', cls: 'cafe', name: 'Cafe', insidePois: [] }), 'cafe is not a workplace')

const jobs = [
  { job: 'in-building', points: [{ lat: 21.0005, lng: 106.0005 }] },
  { job: 'near', points: [{ lat: 21.002, lng: 106.0005 }] },
  { job: 'far', points: [{ lat: 21.02, lng: 106.0005 }] },
  { job: 'two-sites', points: [{ lat: 21.03, lng: 106 }, { lat: 21.0004, lng: 106.0004 }] },
]
const b = jobsNearPlace({ lat: 21.0005, lng: 106.0005, polygon: square }, jobs)
assert(b.map((j) => j.job).join() === 'in-building,two-sites,near', 'same-building jobs first, then by distance; far excluded')
assert(b[0].samePlace && b[1].samePlace && !b[2].samePlace, 'same place flag from polygon containment')
const p = jobsNearPlace({ lat: 21.0005, lng: 106.0005, polygon: null }, jobs)
assert(p[0].job === 'in-building' && p[0].samePlace && p[0].distanceM === 0, 'POI: identical coordinates are the same place')
assert(jobsNearPlace({ lat: 10, lng: 106, polygon: null }, jobs).length === 0, 'no jobs → empty list (panel shows "no jobs")')

console.log('mapPlace.test.ts: building/POI matching and nearby job assertions passed')
