// 한국 공고 표시·저장 id 헬퍼 시험 (S8 #808) — 빈·잘못된 저장 id가 0번 공고로 읽히던 문제
import {
  formatKoreaSalary, koreaJobDisplayLocation, koreaJobDisplayTitle,
  koreaSavedId, parseKoreaSavedId,
} from './koreaJobFormat.ts'
function assert(ok: boolean, name: string) { if (!ok) throw new Error(name) }

assert(parseKoreaSavedId('kr-123') === 123, 'kr-123 → 123')
assert(parseKoreaSavedId('42') === null && parseKoreaSavedId('') === null, 'prefix 없는 로컬 id → null')
for (const bad of ['kr-', 'kr-abc', 'kr-1.5', 'kr--3', 'kr-0', 'kr- 1', 'kr-1e3']) {
  assert(parseKoreaSavedId(bad) === null, `${bad} → null`)
}
assert(parseKoreaSavedId(koreaSavedId(77)) === 77, 'koreaSavedId ↔ parseKoreaSavedId 왕복')

type Sal = Parameters<typeof formatKoreaSalary>[0]
const sal = (o: Partial<Sal>): Sal => ({ salary: null, salary_min: null, salary_max: null, salary_type: null, ...o })
assert(formatKoreaSalary(sal({ salary_min: 1000, salary_max: 2000, salary_type: 'monthly' })) === '1,000 - 2,000 KRW/tháng', 'min≠max → 범위')
assert(formatKoreaSalary(sal({ salary_min: 1000, salary_max: 1000, salary_type: 'hourly' })) === '1,000 KRW/giờ', 'min=max → 한 값')
assert(formatKoreaSalary(sal({ salary_min: 1500 })) === '1,500 KRW', 'min만 (단위 없음)')
assert(formatKoreaSalary(sal({ salary_max: 2500, salary_type: 'daily' })) === '2,500 KRW/ngày', 'max만')
assert(formatKoreaSalary(sal({ salary: '협의' })) === '협의', '최소·최대 없음 → 원문')
assert(formatKoreaSalary(sal({})) === null, '모두 없음 → null')

assert(koreaJobDisplayTitle({ title: 'KR', title_vi: 'VI' }) === 'VI', 'title_vi 우선')
assert(koreaJobDisplayTitle({ title: 'KR', title_vi: null }) === 'KR', 'title_vi 없으면 title')
assert(koreaJobDisplayLocation({ province: 'Seoul', district: 'Gangnam', region: 'R' }) === 'Seoul Gangnam', 'province+district')
assert(koreaJobDisplayLocation({ province: 'Seoul', district: null, region: 'R' }) === 'Seoul', 'province만')
assert(koreaJobDisplayLocation({ province: null, district: 'Gangnam', region: 'R' }) === 'R', 'province 없으면 region')
console.log('koreaJobFormat: saved id/salary/title/location passed')
