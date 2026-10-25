import { salaryFromSource } from './sourceSalary.ts'
import { DESCRIPTION_BUILD_JOBS as jobs } from './jobDescriptionBuild.fixtures.ts'
function assert(ok: boolean, name: string) { if (!ok) throw new Error(name) }
const a = salaryFromSource(jobs['4879'].source_text)
assert(a?.salary === '9 - 17 triệu/tháng' && a.period === 'month', '#4879 ADTEK: ' + JSON.stringify(a))
const t = salaryFromSource(jobs['4878'].source_text)
assert(t?.salary === '8 - 18 triệu/tháng', '#4878 TEFAL(위쪽 칸과 같은 값): ' + JSON.stringify(t))
assert(salaryFromSource('Mức lương: 7.000.000đ\nLiên hệ 0912')?.salary === '7.000.000đ', 'single line value')
assert(salaryFromSource('Lương: thỏa thuận') === null, 'no amount → none (no guessing)')
assert(salaryFromSource('') === null, 'empty')
console.log('sourceSalary.test.ts: #4879·#4878 실제 원문 + 금액 없으면 비움 검사 통과')
