import { conditionItems, itemsCoveredBy } from './conditionLines.ts'

function assert(value: boolean, label: string) { if (!value) throw new Error(label) }
const same = (a: string[], b: string[]) => JSON.stringify(a) === JSON.stringify(b)

// #4828 실제 값 — Lee 예시와 같은 3줄, 원문 글자·구두점 그대로
assert(same(conditionItems('Phụ cấp: 1.200.000đ/tháng; thâm niên sau 2 tháng: +200.000đ, sau 4 tháng: +300.000đ.'),
  ['Phụ cấp: 1.200.000đ/tháng;', 'thâm niên sau 2 tháng: +200.000đ,', 'sau 4 tháng: +300.000đ.']), '#4828 allowance → 3 items')
assert(same(conditionItems('310k/11h ca ngày, 360k/11h ca đêm'), ['310k/11h ca ngày,', '360k/11h ca đêm']), 'KDA salary → 2 items')
assert(same(conditionItems('Lương 8,5 triệu/tháng'), ['Lương 8,5 triệu/tháng']), 'decimal comma is not a separator')
assert(same(conditionItems('Chuyên ca ngày'), ['Chuyên ca ngày']), 'single item')
assert(same(conditionItems(''), []) && same(conditionItems(null), []), 'empty')
// 원문 글자 보존: 이어 붙이면 공백만 빼고 원문과 같다
const src = 'A: 1đ; B: 2đ, C: 3đ.'
assert(conditionItems(src).join('').replace(/\s/g, '') === src.replace(/\s/g, ''), 'no characters changed')

assert(itemsCoveredBy(conditionItems('Phụ cấp: 1.200.000đ/tháng; thâm niên sau 2 tháng: +200.000đ, sau 4 tháng: +300.000đ.'),
  ['Phụ cấp: 1.200.000đ/tháng', 'Thâm niên sau 2 tháng: +200.000đ', 'Thâm niên sau 4 tháng: +300.000đ']), 'already in detail section')
assert(!itemsCoveredBy(['Chuyên cần 50k/tuần'], ['Ca ngày: 310k/11h']), 'missing from detail section')

console.log('conditionLines.test.ts: all assertions passed')
