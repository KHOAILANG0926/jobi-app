import { motorbikeLabel, motorbikeMinutes, motorbikeRangeLabel } from './commute.ts'
function assert(c: boolean, m: string) { if (!c) throw new Error(`FAIL: ${m}`) }
assert(motorbikeMinutes(0.1) === 1, 'very close → 1 phút')
assert(motorbikeMinutes(3) === 8, '3km straight → 8 phút')
assert(motorbikeMinutes(5) === 15, '5km → 14 → rounded 15')
assert(motorbikeMinutes(10) === 30, '10km → 28 → 30')
assert(motorbikeLabel(5) === 'Xe máy khoảng 15 phút', 'label')
assert(motorbikeLabel(30) === 'Xe máy hơn 1 giờ', 'far → hơn 1 giờ')
assert(motorbikeLabel(Number.NaN) === null, 'no number → no label')
assert(motorbikeRangeLabel(6) === 'Xe máy khoảng 3–30 phút', `range 6km: ${motorbikeRangeLabel(6)}`)
assert(motorbikeRangeLabel(2) === 'Xe máy khoảng 1–20 phút', `range near: ${motorbikeRangeLabel(2)}`)
assert(motorbikeRangeLabel(20) === 'Xe máy khoảng 40 phút – hơn 1 giờ', `range far: ${motorbikeRangeLabel(20)}`)
console.log('commute tests: all assertions passed')
