import { pushPinClass } from './mapPushPin.ts'
function assert(v: unknown, m: string) { if (!v) throw new Error(m) }
assert(pushPinClass(['exact']) === 'hme-pin', 'exact pin is the plain push pin')
assert(pushPinClass(['area']).includes('hme-pin--representative'), 'approximate pin keeps the representative mark')
assert(pushPinClass([undefined], true) === 'hme-pin is-selected', 'unknown kind counts as exact (legacy), selected state kept')
console.log('mapPushPin: pin class keeps accuracy marks')
