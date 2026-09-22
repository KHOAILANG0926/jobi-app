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

function testParseWorkDaysNegationHandlesMultiDayListAfterQualifierWord(): void {
  // 2026-09-22 재검증 후 수정 — 실사례(sb-4422/sb-4525): "nghỉ chiều thứ 7,
  // chủ nhật"(토요일 오후, 일요일 휴무). 예전엔 "nghỉ로부터 15글자 이내"
  // 고정 거리 방식이라 "chiều"(시간대 단어)가 끼면서 두 번째 요일(chủ
  // nhật)이 15글자를 넘어가 부정 처리가 빠졌고, 그 결과 실제로는 쉬는
  // 일요일이 "근무일"로 잘못 나왔었다(정반대 결과). 이 문장은 일하는
  // 요일을 명시하지 않으므로(쉬는 요일만 나열) 빈 Set이 맞다 —
  // 추측으로 채우지 않는다.
  assertSetEqual(
    parseWorkDays('nghỉ chiều thứ 7, chủ nhật'),
    [],
    'off-Saturday-afternoon-and-Sunday phrasing must not report Sunday as a working day',
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
  // 2026-09-22 재검증 후 수정 — 예전엔 시작/종료 시각을 독립 판정해 정각
  // 17시 종료를 "저녁(toi)까지 일한다"로 오탐 처리했었다(실제 활성 공고
  // sb-4450/4426/4482/4517/4525 등 "8:00-17:00"류 순수 주간 근무 다수가
  // 이 오탐의 재현 사례). 종료 시각이 정각이면 그 시각 자체는 근무 종료
  // 시점이지 근무 시간이 아니므로 제외해야 맞다 — sang + chieu만 걸려야
  // 한다(17시 정각 자체는 저녁 버킷에 포함 안 됨).
  assertSetEqual(parseWorkHourBuckets('8:00 – 17:00'), ['sang', 'chieu'] as TimeBucket[], '8:00-17:00 on-the-dot end must NOT touch toi (real false-positive fixed)')
}

function testParseWorkHourBucketsExactHourEndWithMinutesStillTouchesNextBucket(): void {
  // 종료 시각이 정각이 아니면(17h30) 실제로 그 버킷에 걸쳐 있으므로
  // toi가 포함돼야 한다 — 정각 종료만 제외하는 것이지 "17시대에 끝나는
  // 근무는 전부 저녁 아님" 규칙이 아니다.
  assertSetEqual(parseWorkHourBuckets('8h30-17h30'), ['sang', 'chieu', 'toi'] as TimeBucket[], '8h30-17h30 genuinely spans into toi (real job sb-4520)')
}

function testParseWorkHourBucketsMultipleDaytimeRangesNeverTouchToi(): void {
  // 실사례(sb-4461): "Thứ Hai – Thứ Sáu: 08:00 – 17:00, Thứ Bảy: 08:00 – 12:00"
  // — 평일/토요일 전부 순수 주간 근무. 저녁대는 전혀 안 걸려야 한다.
  assertSetEqual(
    parseWorkHourBuckets('Thứ Hai – Thứ Sáu: 08:00 – 17:00, Thứ Bảy: 08:00 – 12:00'),
    ['sang', 'chieu'] as TimeBucket[],
    'two on-the-dot daytime ranges (weekday 8-17, Sat 8-12) must never touch toi',
  )
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
    testParseWorkDaysNegationHandlesMultiDayListAfterQualifierWord,
    testParseWorkDaysSingleDay,
    testParseWorkDaysNoMention,
    testParseWorkDaysNull,
    testParseWorkHourBucketsSimpleRange,
    testParseWorkHourBucketsExactHourEndWithMinutesStillTouchesNextBucket,
    testParseWorkHourBucketsMultipleDaytimeRangesNeverTouchToi,
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
