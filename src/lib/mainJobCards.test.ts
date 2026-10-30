import { cardSalary, mainCardJobs, partitionMainCards } from './mainJobCards.ts'
import type { Job } from '../types/job.ts'

const assert = {
  equal(actual: unknown, expected: unknown, note = '') {
    if (actual !== expected) throw new Error(`${note}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`)
  },
  deepEqual(actual: unknown, expected: unknown, note = '') {
    this.equal(JSON.stringify(actual), JSON.stringify(expected), note)
  },
}

const job = (id: string, salary: string, extra: Partial<Job> = {}): Job => ({
  id, salary, title: 'Production worker', company: 'Factory', category: 'san_xuat_xay_dung',
  location: 'KCN Yên Phong', description: '', postedAt: '2026-10-13',
  employerPhone: '', applicationDeadline: '', ...extra,
})
const kda = job('sb-4824', '310k/11h ca ngày, 360k/11h ca đêm', { salaryPeriod: 'day' })
assert.equal(cardSalary(kda)?.label, 'Lương ngày')
assert.equal(cardSalary(kda)?.text, '310k/11h ca ngày', 'show only the first source shift wage without conversion')
assert.equal(cardSalary(job('hour', '30.000 đồng/giờ; 240.000 đồng/ngày; 6 triệu/tháng'))?.text, '30.000 đồng/giờ')
assert.equal(cardSalary(job('day', '240.000 đồng/ngày; 6 triệu/tháng'))?.label, 'Lương ngày')
assert.equal(cardSalary(job('spaced', '240k/ngày; 30k / giờ'))?.text, '30k / giờ')
assert.equal(cardSalary(job('bonus', 'Phụ cấp: 50.000 đồng/ngày')), null)
assert.equal(cardSalary(job('bonus', 'Lương thỏa thuận; Phụ cấp: 50.000 đồng/ngày')), null)
assert.equal(cardSalary(job('month', '9 - 12 triệu', { salaryPeriod: 'month' }))?.label, 'Lương tháng')
assert.equal(cardSalary(job('unspecified', '9 - 12 triệu'))?.label, 'Tiền công', 'do not invent a missing pay period')
for (const salary of ['', 'Thỏa thuận', 'Lương hấp dẫn', 'Ca 11 giờ', 'Chuyên cần: 50.000 đồng/tuần']) {
  assert.equal(cardSalary(job('unknown', salary)), null, salary)
}
const input = [kda, kda, job('other', '9 - 12 triệu'), job('unknown', 'Thỏa thuận')]
assert.deepEqual(mainCardJobs(input).map(j => j.id), ['sb-4824', 'other'])
const { featured, remaining } = partitionMainCards(mainCardJobs(input), [kda, kda])
assert.deepEqual([...featured, ...remaining].map(j => j.id), ['sb-4824', 'other'])
assert.equal(input.length, 4, 'presentation filtering must not mutate shared search/map data')
console.log('mainJobCards: all assertions passed')

// Lee 2026-10-30: 여러 직무 공고(Bomunttl 원문 저장 모양)는 메인에서 빠지지 않고 직무별 급여 줄을 보여 준다.
const multi = job('sb-4982', 'Theo vị trí — xem chi tiết', { description: 'CÔ RỬA BÁT FULL TIME — Nghỉ trưa hơn 2 tiếng\nCÔ RỬA BÁT FULL TIME — Lương thỏa thuận + thưởng\nNHÂN VIÊN NAM/NỮ CHẠY BÀN PART TIME — Mức lương: 30k-35k/ 1h' })
assert.deepEqual(cardSalary(multi)?.lines, ['Rửa bát: Lương thỏa thuận + thưởng', 'Chạy bàn: 30k-35k/ 1h'], 'multi-role card salary lines')
assert.equal(mainCardJobs([multi]).length, 1, 'multi-role job stays on main')
assert.equal(mainCardJobs([job('x', 'Theo vị trí — xem chi tiết')]).length, 0, 'no salary anywhere stays off main')
