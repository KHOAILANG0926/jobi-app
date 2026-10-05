import { classifyPoi, formatMeters, summarizeNearby } from './nearbyFacilities.ts'

function assert(value: boolean, label: string) { if (!value) throw new Error(label) }

assert(classifyPoi('eatery', 'Quán Ăn Phương Loan') === 'restaurant', 'eatery counts as restaurant')
assert(classifyPoi('department_store', 'Tạp Hóa Bà Tám') === 'convenience', 'tạp hóa counts as convenience')
assert(classifyPoi('housing', 'Nhà Nghỉ Thành Tâm') === 'lodging', 'guest houses tagged as housing count as lodging')
assert(classifyPoi('housing', 'Chung Cư Hoàng Gia 2') === null, 'apartments are not lodging')
assert(classifyPoi('housing', 'KTX Canon') === 'lodging', 'factory dormitories (KTX) count as lodging')
assert(classifyPoi('', 'Cty Bình Minh') === 'workplace', 'unclassed company names are workplaces')
assert(classifyPoi('', 'Sở TNMT T. Bắc Ninh') === null, 'unknown unclassed POIs are ignored')
assert(classifyPoi('food', 'Chè Thái Nguyên') === null, 'food shops are not restaurants')
assert(classifyPoi('industrial', 'Cty Toyoplas') === 'workplace', 'industrial is a workplace')

const center = { lat: 21.0, lng: 106.0 }
const north = (m: number) => center.lat + m / 111_320
const s = summarizeNearby(center, [
  { name: 'Phở A', cls: 'restaurant', lat: north(100), lng: 106 },
  { name: 'Phở A', cls: 'restaurant', lat: north(100), lng: 106 }, // duplicate from tile edge
  { name: 'Cơm B', cls: 'eatery', lat: north(450), lng: 106 },
  { name: 'Far', cls: 'restaurant', lat: north(900), lng: 106 },
  { name: 'Circle K', cls: 'convenience', lat: north(250), lng: 106 },
  { name: 'Cty X', cls: 'company', lat: north(200), lng: 106 },
  { name: '', cls: 'cafe', lat: north(50), lng: 106 },
  { name: 'Tennis', cls: 'tennis', lat: north(10), lng: 106 },
])
assert(s.counts[300].restaurant === 1 && s.counts[500].restaurant === 2, 'counts by radius, duplicates removed, far ones excluded')
assert(s.counts[300].convenience === 1, 'convenience inside 300 m')
assert(s.counts[500].cafe === 0, 'nameless POIs are not counted')
assert(s.nearest.restaurant?.name === 'Phở A' && Math.abs(s.nearest.restaurant.distanceM - 100) <= 1, 'nearest restaurant with real distance')
assert(s.nearest.pharmacy === undefined, 'missing categories stay empty, never invented')
assert(s.workplaces.length === 1 && s.workplaces[0].name === 'Cty X', 'workplaces listed separately')
assert(s.items.every((i, k) => k === 0 || s.items[k - 1].distanceM <= i.distanceM), 'items sorted by distance')
assert(formatMeters(87) === '90 m' && formatMeters(4) === '10 m' && formatMeters(1234) === '1.2 km', 'distance labels')

console.log('nearbyFacilities.test.ts: nearby facility summary assertions passed')
