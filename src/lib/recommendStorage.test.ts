/**
 * Standalone regression tests for the salary parsing/matching/sorting fix
 * (2026-09-14) — plain assertions, no test framework (jobRows.test.ts
 * convention). Imports the real module (recommendStorage.ts) — resolvable
 * via scripts/ts-extensionless-loader.mjs, which lets Node's native
 * TypeScript execution follow this file's pre-existing extensionless
 * relative imports (../data/jobRegions, ./jobCoords) without editing them.
 *
 * Run: `npm test` (runs every src/**\/*.test.ts), or directly:
 * `node --experimental-strip-types --import ./scripts/ts-extensionless-register.mjs src/lib/recommendStorage.test.ts`
 */
import {
  parseSalaryInfo,
  parseSalaryRange,
  parseExplicitHourlyRange,
  groupJobsForSalarySort,
  salaryTierLabel,
  scoreJob,
  type RecommendPrefs,
} from './recommendStorage.ts'
import { ensureJobFields } from './jobUtils.ts'
import type { Job } from '../types/job.ts'

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}
function assertTrue(value: unknown, label: string): void {
  if (!value) throw new Error(label)
}
function assertNull(value: unknown, label: string): void {
  if (value !== null) throw new Error(`${label}: expected null, got ${JSON.stringify(value)}`)
}

function job(overrides: Partial<Job>): Job {
  return ensureJobFields({
    id: 'x', title: '', company: '', category: 'other', salary: '', location: '',
    hours: '', urgent: false, description: '', employerPhone: '', applicationDeadline: '',
    postedAt: '2026-01-01', ...overrides,
  } as Job)
}

const BASE_PREFS: RecommendPrefs = {
  regionId: '', minHourlySalary: 0, timeSlots: [], categories: [], subcategories: [], workDays: 'any', workPeriod: 'any',
}

// ── 협의·건당·금액 미상 ──────────────────────────────────────────────
{
  assertEqual(parseSalaryInfo('Thỏa thuận').range, null, 'Thỏa thuận → 금액 null')
  assertTrue(parseSalaryInfo('Thỏa thuận').isNegotiable, 'Thỏa thuận → isNegotiable true')
  assertEqual(parseSalaryInfo('Thương lượng').range, null, 'Thương lượng → 금액 null')
  assertEqual(parseSalaryInfo('Lương theo đơn hàng').range, null, '건당(theo đơn) → 금액 null(시간 근거 없음)')
  assertEqual(parseSalaryInfo('').range, null, '빈 문자열 → 금액 null')
  assertEqual(parseSalaryInfo('abc xyz').range, null, '숫자 없는 텍스트 → 금액 null')
}

// ── triệu/k, 소수점, 천 단위 구분자(실운영 84종 전수 실측 기준 대표 케이스) ──
{
  assertEqual(parseSalaryRange('15 - 20 triệu'), { min: 15_000_000, max: 20_000_000 }, '"15 - 20 triệu"(실운영 최다 패턴) → 1500만~2000만')
  assertEqual(parseSalaryRange('9.5 - 11 triệu'), { min: 9_500_000, max: 11_000_000 }, '소수점 triệu')
  assertEqual(parseSalaryRange('7.9 - 10.9 triệu'), { min: 7_900_000, max: 10_900_000 }, '양쪽 다 소수점 triệu')
  assertEqual(parseSalaryRange('9.000.000đ/tháng'), { min: 9_000_000, max: 9_000_000 }, '천 단위 구분자(마침표 반복)는 소수점 아님')
  assertEqual(parseSalaryRange('25k - 35k/giờ'), { min: 25_000, max: 35_000 }, 'k(천) 단위')
  assertEqual(parseSalaryRange('$ 300-1,500 /tháng'), { min: 300, max: 1500 }, '영문식 콤마 천 단위 구분자(1,500→1500, 1.5 아님)')
}

// ── 25~35k/시간과 희망 시급 30k: 확실 충족 아님(범위 평균/최댓값만으로 판정 금지) ──
{
  const j = job({ salary: '25.000 - 35.000 đ/giờ', category: 'am_thuc_do_uong' })
  const prefs: RecommendPrefs = { ...BASE_PREFS, minHourlySalary: 30_000 }
  const { reasons } = scoreJob(j, prefs)
  assertTrue(!reasons.includes('Lương phù hợp'), '25~35k 공고는 30k 희망급여를 "확실 충족"으로 표시하면 안 됨')
  assertTrue(reasons.includes('Lương gần mức yêu cầu'), '대신 "근접" 신호만 표시')

  const j2 = job({ salary: '35.000 - 45.000 đ/giờ', category: 'am_thuc_do_uong' })
  const { reasons: r2 } = scoreJob(j2, prefs)
  assertTrue(r2.includes('Lương phù hợp'), 'min(35k) >= 30k면 확실 충족 표시')
}

// ── 월급과 시급: 근거 없는 환산·직접 비교 없음(추천 판정 + 정렬 양쪽 모두) ──
{
  // 추천 판정: 월급 공고는 희망 "시급" 조건에 비교 근거가 없으므로 가점 없음.
  const j = job({ salary: '15 - 20 triệu', category: 'am_thuc_do_uong' })
  const prefs: RecommendPrefs = { ...BASE_PREFS, minHourlySalary: 30_000 }
  const { reasons } = scoreJob(j, prefs)
  assertTrue(!reasons.includes('Lương phù hợp') && !reasons.includes('Lương gần mức yêu cầu'), '월급 공고는 희망 시급 조건에 가점/표시 없음(86% 실운영 케이스)')
  assertNull(parseExplicitHourlyRange('15 - 20 triệu'), 'parseExplicitHourlyRange는 월급 텍스트에 절대 값을 주지 않음')

  // 정렬: 월급 공고와 시급 공고는 같은 그룹으로 묶이지 않는다(월÷160 같은
  // 근거 없는 환산으로 같은 축에 놓지 않음) — groupJobsForSalarySort로 검증.
  const monthlyJob = job({ id: 'm1', salary: '15 - 20 triệu', category: 'am_thuc_do_uong' })
  const hourlyJob = job({ id: 'h1', salary: '25.000 - 35.000 đ/giờ', category: 'am_thuc_do_uong' })
  const { groups } = groupJobsForSalarySort([monthlyJob, hourlyJob])
  assertEqual(groups.length, 2, '월급과 시급은 서로 다른 두 집단으로 분리됨')
  const monthlyGroup = groups.find((g) => g.jobs.some((j2) => j2.id === 'm1'))
  const hourlyGroup = groups.find((g) => g.jobs.some((j2) => j2.id === 'h1'))
  assertTrue(monthlyGroup && hourlyGroup && monthlyGroup !== hourlyGroup, '같은 그룹에 섞이지 않음')
  assertEqual(monthlyGroup?.period, 'unknown', '지급 주기 표기가 없는 "triệu" 공고는 period가 unknown(triệu는 배율일 뿐 주기가 아님)')
  assertEqual(hourlyGroup?.period, 'hour', '"đ/giờ" 명시 공고는 period가 hour')
}

// ── USD와 VND: 직접 비교 없음 ────────────────────────────────────────
{
  const usdJob = job({ id: 'u1', salary: '$ 800-1,000 /tháng', category: 'van_phong' })
  const vndJob = job({ id: 'v1', salary: '10 - 12 triệu', category: 'van_phong' })
  const { groups } = groupJobsForSalarySort([usdJob, vndJob])
  const usdGroup = groups.find((g) => g.jobs.some((j2) => j2.id === 'u1'))
  const vndGroup = groups.find((g) => g.jobs.some((j2) => j2.id === 'v1'))
  assertTrue(usdGroup && vndGroup && usdGroup !== vndGroup, 'USD 공고와 VND 공고는 별도 그룹(직접 비교 없음)')
  assertEqual(usdGroup?.currency, 'USD', 'USD 그룹 통화 태그 확인')
  assertEqual(vndGroup?.currency, 'VND', 'VND 그룹 통화 태그 확인')

  // 희망 시급(VND 기준) 매칭에도 USD 시급 공고는 근거로 쓰지 않는다.
  const usdHourly = job({ salary: '$ 5 - 7 /giờ', category: 'am_thuc_do_uong' })
  assertNull(parseExplicitHourlyRange('$ 5 - 7 /giờ'), 'USD 시급은 VND 희망 시급과 통화가 달라 비교 근거로 쓰지 않음')
  const { reasons } = scoreJob(usdHourly, { ...BASE_PREFS, minHourlySalary: 20_000 })
  assertTrue(!reasons.includes('Lương phù hợp') && !reasons.includes('Lương gần mức yêu cầu'), 'USD 시급 공고는 VND 희망 시급 조건에 가점 없음')
}

// ── 지급 주기 미상: 임의 확정 없음 ───────────────────────────────────
{
  // 실운영 최다 패턴("N - M triệu", 지급 주기 표기 없음) — 금액 배율(triệu)만
  // 있고 지급 주기 표기가 전혀 없으면 period는 반드시 'unknown'이어야 한다.
  // 금액이 크다고("몇백만~몇천만") 월급으로 단정하지 않는다.
  assertEqual(parseSalaryInfo('15 - 20 triệu').period, 'unknown', '"15 - 20 triệu"(주기 표기 없음) → period unknown, 월급으로 단정 안 함')
  assertEqual(parseSalaryInfo('8 - 9 triệu').period, 'unknown', '소액 triệu도 동일 — 배율과 주기는 별개')
  assertEqual(parseSalaryInfo('25k - 35k/giờ').period, 'hour', '"/giờ" 명시가 있을 때만 period hour')
  assertEqual(parseSalaryInfo('9.000.000đ/tháng').period, 'month', '"/tháng" 명시가 있을 때만 period month')

  // groupJobsForSalarySort도 이 unknown 그룹을 별도 유지 — 정렬 시 다른 주기
  // 그룹과 섞이지 않는다(같은 unknown끼리는 금액으로 비교 가능 — 전부 동일하게
  // "주기 미상"이라는 동일 조건이므로).
  const a = job({ id: 'a', salary: '20 - 25 triệu', category: 'van_phong' })
  const b = job({ id: 'b', salary: '8 - 9 triệu', category: 'van_phong' })
  const { groups } = groupJobsForSalarySort([a, b])
  assertEqual(groups.length, 1, '둘 다 period unknown + VND → 같은 집단 하나')
  assertEqual(groups[0].period, 'unknown', '그 집단의 period는 unknown')
  assertEqual(groups[0].jobs.map((j2) => j2.id), ['a', 'b'], '같은(동일 조건) 집단 안에서는 금액 내림차순 정렬됨')
}

// ── 정렬 호출부 통합 검증: 협의/미상은 unpriced로 분리, "고액" 판정 제외 ──
{
  const priced = job({ id: 'p', salary: '10 - 12 triệu', category: 'van_phong' })
  const negotiable = job({ id: 'n', salary: 'Thỏa thuận', category: 'van_phong' })
  const { groups, unpriced } = groupJobsForSalarySort([priced, negotiable])
  assertEqual(unpriced.map((j2) => j2.id), ['n'], '협의 공고는 unpriced로 분리됨')
  assertEqual(groups.flatMap((g) => g.jobs).map((j2) => j2.id), ['p'], '금액 있는 공고만 그룹에 포함')
  assertEqual(salaryTierLabel(groups[0]), 'VND · chưa rõ đơn vị', '그룹 라벨 형식 확인')
}

console.log('recommendStorage.test.ts: all assertions passed')
