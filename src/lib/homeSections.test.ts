// 메인 화면 칸 나누기(Lee 2026-11-01) — 실제 공개 공고 급여 글자로 시험
import { payValue, highPayIds, homeSections } from './homeSections.ts'
import type { Job } from '../types/job'
function eq(got: unknown, want: unknown, name: string) { if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${name}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`) }
eq(payValue('5.500.000đ/tháng'), 5_500_000, '#4828 thousand dots')
eq(payValue('8 - 18 triệu/tháng'), 8_000_000, '#4878 range uses following unit')
eq(payValue('9 - 17 triệu/tháng'), 9_000_000, '#4879')
eq(payValue('310k/11h ca ngày, 360k/11h ca đêm'), 310_000, '#4824 k')
eq(payValue('23.000 – 25.000 VNĐ/giờ (xét tăng theo năng lực)'), 23_000, '#5231 VNĐ')
eq(payValue('8.5 – 10tr/tháng'), 8_500_000, 'decimal triệu')
eq(payValue('Theo vị trí — xem chi tiết'), null, 'multi-role has no single amount')
eq(payValue('Thu nhập cạnh tranh'), null, 'no amount')
const job = (id: string, extra: Partial<Job>): Job => ({ id, title: 't' + id, company: 'c' + id, category: 'san_xuat_xay_dung', salary: '', salaryPeriod: 'month', postedAt: '2026-11-01', ...extra } as Job)
const factory = [job('a', { salary: '8 triệu/tháng' }), job('b', { salary: '8.5 triệu/tháng' }), job('c', { salary: '9 triệu/tháng' }), job('d', { salary: '12 triệu/tháng' })]
eq([...highPayIds(factory)], ['d'], '12 ≥ median 8.75 × 1.2 → special')
eq([...highPayIds(factory.slice(0, 2))], [], 'fewer than 3 in the group → no comparison')
eq([...highPayIds([...factory.slice(0, 3), job('h', { salary: '50k/giờ', salaryPeriod: 'hour' })])], [], 'different pay unit is not compared')
const sec = homeSections([
  ...factory,
  job('kt', { shuttleBus: true, dormitory: true }),
  job('meal', { mealProvided: true }),
  job('hl', { company: 'Highlands Coffee Mường Thanh Bắc Ninh', category: 'am_thuc_do_uong', salaryPeriod: 'hour' }),
], [{ id: 'highlands', name: 'Highlands Coffee', matchKeys: ['Highlands Coffee'] } as never])
eq(sec.special.map((j) => j.id), ['d', 'kt'], 'special: high pay or 2 benefits (1 benefit is not enough)')
eq(sec.brand.map((j) => j.id), ['hl'], 'brand section')
eq(sec.featured.map((j) => j.id), ['a', 'b', 'c', 'meal'], 'everything else is featured, each job once')
eq(sec.all.length, 7, 'all list keeps every job')
console.log('homeSections: special/featured/brand split passed')
