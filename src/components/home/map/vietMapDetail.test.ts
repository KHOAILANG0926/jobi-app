import { nearbyPoiMinZoom } from './vietMapDetail.ts'
function assert(value: boolean, label: string) { if (!value) throw new Error(label) }
const company = { id: 'poiz18_company', type: 'symbol', 'source-layer': 'poi', minzoom: 18 }
assert(nearbyPoiMinZoom(company) === 15, 'company data can appear at neighborhood zoom')
assert(nearbyPoiMinZoom({ ...company, id: 'poiz16_industrial' }) === 15, 'industrial labels appear early')
assert(nearbyPoiMinZoom({ ...company, id: 'poiz18_store' }) === 17, 'shops wait until street zoom')
assert(nearbyPoiMinZoom({ ...company, minzoom: 13 }) === 13, 'never hide existing earlier labels')
assert(nearbyPoiMinZoom({ ...company, 'source-layer': 'other' }) === null, 'only known POI source')
assert(nearbyPoiMinZoom({ ...company, id: 'road-label' }) === null, 'road labels remain official')
assert(nearbyPoiMinZoom({ ...company, type: 'fill' }) === null, 'building geometry remains official')
console.log('vietMapDetail.test.ts: bounded POI zoom changes passed')
