import { buildMapDeepLink, parseMapDeepLink } from './mapDeepLink.ts'

function assert(value: boolean, label: string) { if (!value) throw new Error(label) }

const href = buildMapDeepLink({ lat: 21.0800324, lng: 105.9835287, radiusKm: 3, label: 'KCN VSIP Bắc Ninh' })
assert(href.startsWith('/?mapLat=21.08003&mapLng=105.98353&mapR=3'), 'builds a home link with lat/lng/radius')
const back = parseMapDeepLink(href.slice(1))
assert(!!back && Math.abs(back.lat - 21.08003) < 1e-9 && Math.abs(back.lng - 105.98353) < 1e-9 && back.radiusKm === 3 && back.label === 'KCN VSIP Bắc Ninh', 'round trip (label keeps Vietnamese text)')

assert(parseMapDeepLink('') === null && parseMapDeepLink('?q=abc') === null, 'no map params → null (home default)')
assert(parseMapDeepLink('?mapLat=0&mapLng=0') === null, 'coordinates outside Vietnam are ignored')
assert(parseMapDeepLink('?mapLat=abc&mapLng=105') === null, 'non-numeric coordinates are ignored')
assert(parseMapDeepLink('?mapLat=21&mapLng=105')!.radiusKm === 3, 'missing radius → 3 km')
assert(parseMapDeepLink('?mapLat=21&mapLng=105&mapR=999')!.radiusKm === 20, 'radius is clamped to the home map maximum')
assert(parseMapDeepLink('?mapLat=21&mapLng=105&mapR=0.01')!.radiusKm === 0.1, 'radius is clamped to the home map minimum')
assert(!parseMapDeepLink('?mapLat=21&mapLng=105&mapLabel=%3Cscript%3Ex')!.label.includes('<'), 'label has no angle brackets')

console.log('mapDeepLink.test.ts: all assertions passed')
