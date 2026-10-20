import { motorbikeLabel, motorbikeMinutes } from './commute.ts'
function assert(c: boolean, m: string) { if (!c) throw new Error(`FAIL: ${m}`) }
assert(motorbikeMinutes(0.1) === 1, 'very close → 1 phút')
assert(motorbikeMinutes(3) === 8, '3km straight → 8 phút')
assert(motorbikeMinutes(5) === 15, '5km → 14 → rounded 15')
assert(motorbikeMinutes(10) === 30, '10km → 28 → 30')
assert(motorbikeLabel(5) === 'Xe máy khoảng 15 phút', 'label')
assert(motorbikeLabel(30) === 'Xe máy hơn 1 giờ', 'far → hơn 1 giờ')
assert(motorbikeLabel(Number.NaN) === null, 'no number → no label')
console.log('commute tests: all assertions passed')
