import { createGoogleMapOptions } from './googleMapOptions.ts'

function assert(condition: boolean, label: string): void {
  if (!condition) throw new Error(label)
}

const maps = {
  MapTypeId: { ROADMAP: 'roadmap', HYBRID: 'hybrid' },
  MapTypeControlStyle: { HORIZONTAL_BAR: 1 },
  RenderingType: { VECTOR: 'VECTOR' },
} as unknown as Pick<google.maps.MapsLibrary, 'MapTypeId' | 'MapTypeControlStyle' | 'RenderingType'>

const options = createGoogleMapOptions(maps, { lat: 21.1861, lng: 106.0763 }, 12.75)

assert(options.renderingType === maps.RenderingType.VECTOR, 'Google map must request VECTOR rendering')
assert(options.mapTypeId === maps.MapTypeId.ROADMAP, 'Google map must default to ROADMAP')
assert(
  JSON.stringify(options.mapTypeControlOptions?.mapTypeIds) === JSON.stringify([
    maps.MapTypeId.ROADMAP,
    maps.MapTypeId.HYBRID,
  ]),
  'Google map type control must preserve ROADMAP/HYBRID',
)
assert(!('styles' in options), 'Google default vector basemap styles must remain untouched')

console.log('googleMapOptions.test.ts: vector ROADMAP options assertions passed')
