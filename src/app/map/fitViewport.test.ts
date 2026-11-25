const assert = { equal(a: unknown, b: unknown, msg = '') { if (a !== b) throw new Error(msg || `${a} !== ${b}`) } }
import { fitViewport } from './useMapData.ts'

// 전국에 흩어진 핀: 박닌 쪽에 7개, 호찌민 쪽 2개 → 카메라는 박닌 쪽(많은 쪽)에 맞고, 평균 위치(중부 빈 땅)로 가지 않는다
const bacNinh = [[21.18, 106.06], [21.17, 106.05], [21.2, 106.1], [21.15, 106.08], [21.22, 105.99], [21.19, 106.07], [21.14, 106.12]].map(([lat, lng]) => ({ lat, lng }))
const hcm = [[10.8, 106.7], [10.95, 106.75]].map(([lat, lng]) => ({ lat, lng }))
const v = fitViewport([...bacNinh, ...hcm])
assert.equal(v.center.lat > 20.5 && v.center.lat < 22 && v.center.lng > 105.5 && v.center.lng < 106.5, true, `camera should sit on the main cluster, got ${JSON.stringify(v.center)}`)
assert.equal(v.zoom >= 9, true, `zoom should show the cluster, got ${v.zoom}`)
// 핀이 없으면 하노이 기본 카메라(공고 위치 아님)
assert.equal(fitViewport([]).center.lat, 21.0285, 'no pins → default camera')
// 잘못된 좌표는 무시
assert.equal(fitViewport([{ lat: NaN, lng: 1 }, { lat: 0, lng: 0 }]).center.lat, 21.0285, 'invalid points ignored')
console.log('fitViewport: main-cluster camera, empty and invalid inputs passed')
