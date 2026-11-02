// 모바일 메인 칸(Lee 2026-11-02) — 실제 공개 공고 급여 글자로 시험
import { monthlyBasePay, mobileHomeSections } from './mobileHomeSections.ts'
import type { Job } from '../types/job'
function eq(got: unknown, want: unknown, name: string) { if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${name}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`) }
const job = (id: string, salary: string, salaryPeriod: Job['salaryPeriod'], postedAt: string, extra: Partial<Job> = {}) =>
  ({ id, salary, salaryPeriod, postedAt, title: id, company: id, category: 'khac', ...extra }) as unknown as Job
eq(monthlyBasePay(job('a', '9 - 17 triệu/tháng', 'month', '')), 9_000_000, 'month range low side')
eq(monthlyBasePay(job('b', '310k/11h ca ngày', 'day', '')), 310_000 * 26, 'day × 26')
eq(monthlyBasePay(job('c', '26K/giờ (parttime)', 'hour', '')), 26_000 * 8 * 26, 'hour × 8 × 26')
eq(monthlyBasePay(job('d', 'Thu nhập cạnh tranh', 'other', '')), null, 'no amount')
const jobs = [
  job('adtek', '9 - 17 triệu/tháng', 'month', '2026-10-01'),
  job('kda', '310k/11h ca ngày', 'day', '2026-10-05'),
  job('seb', '8 - 18 triệu/tháng', 'month', '2026-10-03'),
  job('pl', '5.500.000đ/tháng', 'month', '2026-10-09', { dormitory: true, mealProvided: true }),
  job('hl', '26K/giờ (parttime)', 'hour', '2026-10-07'),
  job('rich-benefit', '12 triệu/tháng', 'month', '2026-10-02', { dormitory: true, shuttleBus: true }),
]
const s = mobileHomeSections(jobs)
eq(s.highPay.map((j) => j.id), ['rich-benefit', 'adtek', 'kda', 'seb'], 'high pay ≥ 7tr, highest first')
eq(s.special.map((j) => j.id), ['pl'], 'special excludes jobs already in high pay')
eq(s.live.map((j) => j.id), ['pl', 'hl', 'kda', 'seb', 'rich-benefit', 'adtek'], 'live = newest first, all jobs')
console.log('mobileHomeSections: high pay / special / live passed')
