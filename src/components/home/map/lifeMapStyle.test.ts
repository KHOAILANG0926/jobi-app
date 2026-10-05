import { APP_LAYER_PREFIX, SATELLITE_BUILDING_HIT_LAYER, applyLifeMapStyle, lifePoiMinZoom } from './lifeMapStyle.ts'

function assert(value: boolean, label: string) { if (!value) throw new Error(label) }

const poi = (id: string, minzoom = 18) => ({ id, type: 'symbol', source: 'openmaptiles', 'source-layer': 'poi', minzoom, layout: { 'text-field': '{name}' }, paint: { 'text-color': '#999' } })
const style = {
  version: 8,
  sources: { openmaptiles: { type: 'vector' } },
  layers: [
    { id: 'background', type: 'background', paint: {} },
    { id: 'road_minor', type: 'line', source: 'openmaptiles', 'source-layer': 'road', paint: { 'line-color': '#fff', 'line-width': { base: 1.2, stops: [[14, 3], [16, 8]] } } },
    { id: 'road_minor_casing', type: 'line', source: 'openmaptiles', 'source-layer': 'road', paint: { 'line-color': '#ACACA9', 'line-width': { stops: [[14, 3]] } } },
    { id: 'road_primary', type: 'line', source: 'openmaptiles', 'source-layer': 'road', paint: { 'line-color': '#ff0', 'line-width': 4 } },
    { id: 'building', type: 'fill', source: 'openmaptiles', 'source-layer': 'building', minzoom: 17, paint: { 'fill-color': '#ccc' } },
    poi('poiz18_company'),
    poi('poiz18_restaurant'),
    poi('poiz18_tennis'),
    poi('poiz12_hospital', 12),
    { id: 'road_minor_label', type: 'symbol', source: 'openmaptiles', 'source-layer': 'road', layout: {} },
    { id: 'place_town', type: 'symbol', source: 'openmaptiles', 'source-layer': 'admin_point', layout: {} },
  ],
}

assert(lifePoiMinZoom(poi('poiz18_company')) === 13, 'companies appear from district zoom')
assert(lifePoiMinZoom(poi('poiz18_restaurant')) === 15, 'daily-life POIs appear from neighborhood zoom')
assert(lifePoiMinZoom(poi('poiz12_hospital', 12)) === 12, 'never delays a layer that was already earlier')
assert(lifePoiMinZoom(poi('poiz18_tennis')) === null, 'unrelated POIs keep the official zoom')
assert(lifePoiMinZoom({ id: 'poiz18_company', type: 'fill', 'source-layer': 'poi', minzoom: 18 }) === null, 'only symbol layers')

const street = applyLifeMapStyle(structuredClone(style), 'street')
const ids = street.layers.map((l) => l.id)
const building = street.layers.find((l) => l.id === 'building')!
assert(building.minzoom === 14, 'buildings become visible from z14 instead of z17')
assert(ids.includes(`${APP_LAYER_PREFIX}life-building-outline`), 'building outlines are drawn for contrast')
assert(ids.indexOf(`${APP_LAYER_PREFIX}life-building-outline`) === ids.indexOf('building') + 1, 'outline sits right above building fill')
assert(ids.indexOf('poiz18_company') > ids.indexOf('road_minor_label'), 'workplace labels win collisions over road labels')
assert(ids.indexOf('poiz18_restaurant') > ids.indexOf('road_minor_label'), 'life labels win collisions over road labels')
assert(ids.indexOf('poiz18_company') > ids.indexOf('poiz18_restaurant'), 'workplaces have priority over life facilities')
assert(ids.indexOf('place_town') > ids.indexOf('poiz18_company'), 'town names stay on top')
assert(ids.indexOf('poiz18_tennis') < ids.indexOf('road_minor_label'), 'unrelated POIs stay in official order')
const company = street.layers.find((l) => l.id === 'poiz18_company')!
assert(company.layout?.['text-optional'] === true, 'icon still shows when the label collides')
assert(company.paint?.['text-color'] === '#1e293b', 'workplace labels use stronger text color')
const minor = street.layers.find((l) => l.id === 'road_minor')!
const stops = (minor.paint?.['line-width'] as { stops: number[][] }).stops
assert(stops[1][1] === 6.4, 'minor roads are narrower (0.8x) so buildings dominate')
assert(street.layers.find((l) => l.id === 'road_minor_casing')!.paint?.['line-color'] === '#cfccc4', 'road casings are softened')
assert(street.layers.find((l) => l.id === 'road_primary')!.paint?.['line-width'] === 4, 'major roads keep official width for navigation')
assert(style.layers.find((l) => l.id === 'building')!.minzoom === 17, 'input style is not mutated')

const satellite = applyLifeMapStyle(structuredClone(style), 'satellite')
assert(satellite.layers.find((l) => l.id === 'building')!.minzoom === 17, 'satellite keeps imagery as the building source')
assert(!satellite.layers.some((l) => l.id.endsWith('life-building-outline')), 'no building outline over imagery')
assert(satellite.layers.find((l) => l.id === 'poiz18_company')!.minzoom === 13, 'satellite still shows workplace labels early')
const noBuilding = { ...structuredClone(style), layers: style.layers.filter((l) => l.id !== 'building') }
const satHit = applyLifeMapStyle(noBuilding, 'satellite')
const hit = satHit.layers.find((l) => l.id === SATELLITE_BUILDING_HIT_LAYER)
assert(hit?.type === 'fill' && hit['source-layer'] === 'building' && hit.paint?.['fill-opacity'] === 0, 'hybrid style gets an invisible building layer for clicks')
assert(satHit.layers.indexOf(hit!) < satHit.layers.findIndex((l) => l.type === 'symbol'), 'hit layer stays below labels')
assert(!applyLifeMapStyle(structuredClone(style), 'street').layers.some((l) => l.id === SATELLITE_BUILDING_HIT_LAYER), 'street mode uses the visible building layer')

const previous = {
  sources: { openmaptiles: {}, 'home-search-radius': { type: 'geojson', data: 1 }, 'home-nearby-points': { type: 'geojson', data: 2 } },
  layers: [
    { id: 'home-radius-fill', type: 'fill', source: 'home-search-radius' },
    { id: 'home-nearby-dot', type: 'circle', source: 'home-nearby-points' },
    { id: 'home-life-building-outline', type: 'line', source: 'openmaptiles', 'source-layer': 'building' },
  ],
}
const switched = applyLifeMapStyle(structuredClone(style), 'satellite', previous)
const sw = switched.layers.map((l) => l.id)
assert('home-search-radius' in switched.sources && 'home-nearby-points' in switched.sources, 'app sources survive a style switch')
assert(sw.includes('home-radius-fill') && sw.indexOf('home-radius-fill') < sw.indexOf('poiz18_tennis'), 'radius stays below labels after switch')
assert(sw.includes('home-nearby-dot') && sw.indexOf('home-nearby-dot') < sw.indexOf('poiz18_tennis'), 'facility dots stay under official icons after switch')
assert(!sw.includes('home-life-building-outline'), 'style-derived app layers are regenerated, not copied')

console.log('lifeMapStyle.test.ts: building/workplace/life priority assertions passed')
