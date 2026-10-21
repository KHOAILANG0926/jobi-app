import { fitWithNearest } from './fitPins.ts'
function assert(c: boolean, m: string) { if (!c) throw new Error(`FAIL: ${m}`) }
// 실제: Lee 위치(박닌 시내 부근) + 운영 공고 핀 2곳(2026-10-21 DB)
const me = { lat: 21.17, lng: 106.06 }
const pins = [{ lat: 21.156843910000077, lng: 106.12752774200004 }, { lat: 21.1965731, lng: 105.9932563 }]
const f = fitWithNearest(me, pins)
for (const p of [me, ...pins]) {
  const half = 180 / 2 ** (f.zoom + 1) // 대략 화면 반 폭(경도)
  assert(Math.abs(p.lng - f.center.lng) <= half, `pin within view (zoom ${f.zoom})`)
}
assert(fitWithNearest(me, []).zoom === 13, 'no pins → my location')
console.log('fitPins tests: all assertions passed')
