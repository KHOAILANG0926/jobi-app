const assert = {
  equal(actual: unknown, expected: unknown, message = '') {
    if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`)
  },
  ok(value: unknown, message = 'assertion failed') { if (!value) throw new Error(message) },
}
import { FUSHAN_SOURCE, FUSHAN_CONTEXT } from './fushanSource.fixture.ts'
import { buildDescriptionFromSources } from './jobDescriptionBuild.ts'
import { detailSections } from './jobDetailSections.ts'
import { salaryFromSource } from './sourceSalary.ts'
import { inspectJob } from './jobInspect.ts'

const built = buildDescriptionFromSources([{ name: 'source_text', text: FUSHAN_SOURCE }], FUSHAN_CONTEXT)
assert.equal(built.unclassified.length, 0, 'FUSHAN: eight formerly unclassified lines must have sections')
const view = detailSections(built.description, FUSHAN_CONTEXT)
const expected = new Map([
  ['CTY - FUSHAN THƯỞNG 13.000.000Đ', '04'],
  ['Tuyển: Chính Thức và Thời Vụ', '03'],
  ['Cty Thưởng 10.000.000đ', '04'],
  ['nhà thầu thưởng 3.000.000đ', '04'],
  ['LCB + PC: 7.200.000đ', '04'],
  ['Hỗ trợ hồ sơ', '06'],
  ['Công việc: Làm ngồi, phòng thường', '05'],
  ['Địa chỉ: VSIP - Bắc Ninh (Có KTX và hỗ trợ tìm trọ)', '05'],
])
for (const [line, key] of expected) {
  assert.equal(built.lines.filter(l => l.line === line && l.key === key).length, 1, line)
  assert.equal(view.sections.find(s => s.key === key)?.lines.filter(l => l === line).length, 1, 'render: ' + line)
}
assert.equal(salaryFromSource(FUSHAN_SOURCE)?.salary, '12 -> 17 triệu', 'never add joining bonuses to pay')
assert.equal(salaryFromSource(FUSHAN_SOURCE)?.period, null, 'no invented pay period')
assert.ok(view.preserved && !view.usedFallback)
assert.ok(built.lines.every(l => FUSHAN_SOURCE.includes(l.line)), 'all classified source lines remain verbatim')
// Pure fixture checks only: gate/active/benefits supplied here are not production verification.
const result = inspectJob({ ...FUSHAN_CONTEXT, id: 0, description: built.description, source_text: FUSHAN_SOURCE,
  occupation_code: '9', category: 'san_xuat_xay_dung', active: true, admin_hidden: false,
  pin: 'gate', dormitory: true, unclassified_lines: built.unclassified.map(l => l.line) })
assert.ok(result.ok, JSON.stringify(result.items.filter(i => !i.ok)))
console.log('FUSHAN: eight source lines classified, verbatim pay/benefits and fixture checklist passed')

// Only an explicit reviewed flag authorizes the missing-duty notice; VSIP alone does not.
const reviewed = buildDescriptionFromSources([{ name: 'source_text', text: FUSHAN_SOURCE }], { ...FUSHAN_CONTEXT, dutiesUnspecified: true })
const notice = 'Công việc cụ thể: chưa ghi trong tin gốc'
const reviewedView = detailSections(reviewed.description, FUSHAN_CONTEXT)
assert.ok(reviewedView.sections.find(s => s.key === '01')?.lines.includes(notice))
assert.ok(!built.description.includes(notice), 'no automated factory inference from VSIP')
assert.ok(reviewedView.sections.find(s => s.key === '06')?.lines.includes('Tuyển qua nhà thầu'))
assert.equal(reviewed.description.split('Tuyển qua nhà thầu').length - 1, 1)
const again = buildDescriptionFromSources([{ name: 'source_text', text: reviewed.description }], { ...FUSHAN_CONTEXT, dutiesUnspecified: true })
assert.equal(again.description, reviewed.description, 'reprocessing preserves approved notices without duplication')
const ordinary = buildDescriptionFromSources([{ name: 'source_text', text: 'Công việc\nLắp ráp tai nghe' }])
assert.ok(!ordinary.description.includes('Tuyển qua nhà thầu'))
for (const source of ['Tuyển nhân viên môi giới bất động sản', 'Không qua môi giới', 'Không qua nhà thầu']) {
  const other = buildDescriptionFromSources([{ name: 'source_text', text: source }])
  assert.ok(!other.description.includes('Tuyển qua nhà thầu'), 'a brokerage occupation or negated intermediary is not contractor recruitment')
}
for (const source of ['Nhà thầu thưởng 3.000.000đ, không mất phí', 'Tuyển qua nhà thầu, không thu phí']) {
  const other = buildDescriptionFromSources([{ name: 'source_text', text: source }])
  assert.ok(other.description.includes('Tuyển qua nhà thầu'), 'no-fee statement does not negate contractor recruitment')
}
