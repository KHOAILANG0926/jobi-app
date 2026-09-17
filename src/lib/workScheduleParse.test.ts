/**
 * Standalone regression tests for workScheduleParse.ts — plain assertions, no
 * test framework. Run via `npm test` (scripts/run-tests.mjs auto-discovers
 * every src/**\/*.test.ts). Samples below are real local_jobs.work_days/hours
 * values pulled from Production on 2026-09-17 to make sure the parser handles
 * the actual messy text, not just clean hand-written examples.
 */
import { parseWorkDays, parseWorkHourBuckets, type DayCode, type TimeBucket } from './workScheduleParse.ts'

function assertSetEqual<T>(actual: Set<T>, expected: T[], label: string): void {
  const a = [...actual].sort()
  const e = [...expected].sort()
  if (a.length !== e.length || a.some((v, i) => v !== e[i])) {
    throw new Error(`${label}: expected [${e.join(',')}], got [${a.join(',')}]`)
  }
}

function testParseWorkDaysSimpleRange(): void {
  assertSetEqual(parseWorkDays('Thứ 2 đến Thứ 7'), ['T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as DayCode[], 'Mon-Sat range')
}

function testParseWorkDaysList(): void {
  assertSetEqual(parseWorkDays('thứ 7, chủ nhật'), ['T7', 'CN'] as DayCode[], 'Sat, Sun list')
}

function testParseWorkDaysRangePlusExtra(): void {
  assertSetEqual(parseWorkDays('Thứ 2 - Thứ 6, thứ 7'), ['T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as DayCode[], 'Mon-Fri range + Sat')
}

function testParseWorkDaysFullWeekPlusSunday(): void {
  assertSetEqual(
    parseWorkDays('Thứ 2 - Thứ 7, Chủ nhật'),
    ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] as DayCode[],
    'Mon-Sat range + Sun listed separately',
  )
}

function testParseWorkDaysNegationExcludesSunday(): void {
  // 실사례: "thứ Hai đến thứ Bảy, nghỉ ngày Chủ nhật" — 월~토 근무, 일요일은
  // "nghỉ"(휴무)로 명시돼 있으니 제외돼야 한다.
  assertSetEqual(
    parseWorkDays('thứ Hai đến thứ Bảy, nghỉ ngày Chủ nhật'),
    ['T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as DayCode[],
    'Mon-Sat range, Sunday off (negated) must be excluded',
  )
}

function testParseWorkDaysSingleDay(): void {
  assertSetEqual(parseWorkDays('chủ nhật'), ['CN'] as DayCode[], 'Sunday only')
}

function testParseWorkDaysNoMention(): void {
  // 요일 언급이 전혀 없으면 빈 Set — 억지로 추측하지 않는다.
  assertSetEqual(parseWorkDays('làm việc theo ca linh hoạt'), [], 'no day mentioned -> empty, never guessed')
}

function testParseWorkDaysNull(): void {
  assertSetEqual(parseWorkDays(null), [], 'null input -> empty')
}

function testParseWorkHourBucketsSimpleRange(): void {
  // 17시 정각은 경계값이라 오후(chieu, 11~17 미만)가 아니라 저녁(toi, 17~22)
  // 버킷으로 잡힌다 — 각 시각을 독립적으로 판정하는 구현이라 일관된 동작.
  assertSetEqual(parseWorkHourBuckets('8:00 – 17:00'), ['sang', 'toi'] as TimeBucket[], '8:00-17:00 -> sang + toi (17h is the toi boundary)')
}

function testParseWorkHourBucketsMultiShift(): void {
  // 실사례: 5개 교대시간대가 나열된 자유 문장 — 사실상 하루 전체를 커버.
  assertSetEqual(
    parseWorkHourBuckets('07h00 - 16h00, 08h00 - 17h30, 13h00 - 22h00, 16h-20h, 22h00 - 07h00'),
    ['sang', 'chieu', 'toi', 'dem'] as TimeBucket[],
    'multi-shift listing should hit every bucket it actually spans',
  )
}

function testParseWorkHourBucketsDurationOnlyNeverGuesses(): void {
  // 실사례: "8 tiếng/ngày và 6 ngày/tuần" — 시계 시각이 아니라 순수 기간
  // 표현이라, 시간대를 추측해서 채우면 안 된다.
  assertSetEqual(parseWorkHourBuckets('8 tiếng/ngày và 6 ngày/tuần'), [], 'pure duration text -> empty, never guessed')
}

function testParseWorkHourBucketsExtractionNoiseNeverGuesses(): void {
  // 실사례: 크롤러가 본문 다른 부분(급여/업무 항목)을 hours 필드에 잘못
  // 넣은 노이즈 — 시계 시각이 없으니 빈 결과가 맞다.
  assertSetEqual(
    parseWorkHourBuckets(', tính phí/lương/hoa hồng; kiểm tra nghỉ, thay ca, tăng ca; phối hợp Nhân sự/Kế'),
    [],
    'non-time noise text -> empty, never guessed',
  )
}

function testParseWorkHourBucketsNightWrap(): void {
  assertSetEqual(parseWorkHourBuckets('22:00 – 02:00'), ['dem'] as TimeBucket[], '22:00-02:00 both fall in đêm bucket')
}

function testParseWorkHourBucketsNull(): void {
  assertSetEqual(parseWorkHourBuckets(undefined), [], 'undefined input -> empty')
}

async function main(): Promise<void> {
  const tests = [
    testParseWorkDaysSimpleRange,
    testParseWorkDaysList,
    testParseWorkDaysRangePlusExtra,
    testParseWorkDaysFullWeekPlusSunday,
    testParseWorkDaysNegationExcludesSunday,
    testParseWorkDaysSingleDay,
    testParseWorkDaysNoMention,
    testParseWorkDaysNull,
    testParseWorkHourBucketsSimpleRange,
    testParseWorkHourBucketsMultiShift,
    testParseWorkHourBucketsDurationOnlyNeverGuesses,
    testParseWorkHourBucketsExtractionNoiseNeverGuesses,
    testParseWorkHourBucketsNightWrap,
    testParseWorkHourBucketsNull,
  ]
  for (const test of tests) {
    await test()
    console.log(`✅ ${test.name}`)
  }
  console.log(`\n결과: ${tests.length}/${tests.length} workScheduleParse tests passed`)
}

main()
