/**
 * Standalone tests for jobAlerts.ts — plain assertions, no framework (jobRows.test.ts와
 * 같은 방식). `npm test`가 실행한다.
 */
import { JOB_REGIONS } from '../data/jobRegions'
import { normalizeViText } from './jobCoords'
import {
  DISTANCE_DISABLED_REASON,
  DISTANCE_MATCHING_ENABLED,
  coarsenCoordinate,
  diagnoseEmptyResult,
  emptyPreferenceInput,
  groupMatchResults,
  preferenceToRow,
  unknownRequiredCriteria,
  validatePreferenceInput,
  type CriterionKey,
  type CriterionResult,
  type CriterionStatus,
  type EvaluationResult,
  type JobMatchRow,
} from './jobAlerts'

function fail(label: string, detail: string): never {
  throw new Error(`${label}: ${detail}`)
}
const assert = {
  equal<T>(actual: T, expected: T, label = 'equal') {
    if (actual !== expected) fail(label, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  },
  deepEqual(actual: unknown, expected: unknown, label = 'deepEqual') {
    const a = JSON.stringify(actual)
    const e = JSON.stringify(expected)
    if (a !== e) fail(label, `expected ${e}, got ${a}`)
  },
  match(actual: string, re: RegExp, label = 'match') {
    if (!re.test(actual)) fail(label, `${JSON.stringify(actual)} !~ ${re}`)
  },
}

// node:fs는 src/ tsconfig(브라우저 타입)에 타입이 없어 동적 import로 불러온다.
const fsModule = 'node:' + 'fs'
const { readFileSync } = (await import(/* @vite-ignore */ fsModule)) as {
  readFileSync: (path: URL, enc: string) => string
}

// ---------------------------------------------------------------------------
// 1. SQL 지역 키워드 목록 = src/data/jobRegions.ts JOB_REGIONS (드리프트 방지)
// ---------------------------------------------------------------------------
{
  const sql = readFileSync(new URL('../../supabase/migrations/20260927090000_job_alerts.sql', import.meta.url), 'utf8')
  const seedBlock = sql.slice(sql.indexOf('insert into public.job_alert_region_keywords'), sql.indexOf(') as v(region_id, keyword)'))
  const sqlPairs = new Set<string>()
  for (const m of seedBlock.matchAll(/\('([a-z]+)', '([^']+)'\)/g)) {
    sqlPairs.add(`${m[1]}|${normalizeViText(m[2])}`)
  }
  const tsPairs = new Set<string>()
  for (const r of JOB_REGIONS) for (const k of r.match) tsPairs.add(`${r.id}|${normalizeViText(k)}`)
  const onlyTs = [...tsPairs].filter((p) => !sqlPairs.has(p))
  const onlySql = [...sqlPairs].filter((p) => !tsPairs.has(p))
  assert.deepEqual(onlyTs, [], 'JOB_REGIONS keywords missing from SQL seed')
  assert.deepEqual(onlySql, [], 'SQL seed has keywords not in JOB_REGIONS')
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
type Spec = Partial<Record<CriterionKey, [('required' | 'preferred'), CriterionStatus, string?]>>

function row(jobId: number, spec: Spec, preferredMet = 0): JobMatchRow {
  const criteria: Partial<Record<CriterionKey, CriterionResult>> = {}
  let overall: EvaluationResult['overall'] = 'match'
  let preferredTotal = 0
  for (const [key, [importance, status, reason]] of Object.entries(spec) as [CriterionKey, [('required' | 'preferred'), CriterionStatus, string?]][]) {
    criteria[key] = { importance, status, reason: reason ?? `${key}_${status}` }
    if (importance === 'required') {
      if (status === 'mismatch') overall = 'mismatch'
      else if (status === 'unknown' && overall === 'match') overall = 'unknown'
    } else preferredTotal++
  }
  return { jobId, result: { overall, preferred_met: preferredMet, preferred_total: preferredTotal, criteria } }
}

// ---------------------------------------------------------------------------
// 2. groupMatchResults
// ---------------------------------------------------------------------------
{
  const rows = [
    row(1, { region: ['required', 'match'], salary: ['preferred', 'unknown'] }, 0),
    row(2, { region: ['required', 'unknown', 'region_missing'] }),
    row(3, { region: ['required', 'mismatch'] }),
    row(4, { region: ['required', 'match'], salary: ['preferred', 'match'] }, 1),
  ]
  const g = groupMatchResults(rows)
  assert.deepEqual(g.matched.map((r) => r.jobId), [4, 1], 'matched sorted by preferred_met desc')
  assert.deepEqual(g.unknown.map((r) => r.jobId), [2])
  assert.equal(g.mismatchCount, 1)
  assert.equal(g.total, 4)
  assert.deepEqual(unknownRequiredCriteria(rows[1].result), [{ key: 'region', reason: 'region_missing' }])
  // 선호조건의 unknown은 "정보 미확인 이유"에 올리지 않는다
  assert.deepEqual(unknownRequiredCriteria(rows[0].result), [])
}

// ---------------------------------------------------------------------------
// 3. diagnoseEmptyResult
// ---------------------------------------------------------------------------
{
  assert.equal(diagnoseEmptyResult([]).kind, 'no_open_jobs')

  // 전부 정보 미확인 → insufficient_info
  const info = diagnoseEmptyResult([
    row(1, { region: ['required', 'match'], hours: ['required', 'unknown'] }),
    row(2, { region: ['required', 'match'], hours: ['required', 'unknown'] }),
    row(3, { region: ['required', 'mismatch'], hours: ['required', 'unknown'] }),
  ])
  assert.equal(info.kind, 'insufficient_info')
  assert.deepEqual(info.missingInfo, [{ key: 'hours', count: 2 }])

  // 한 조건만 불일치인 공고가 있음 → too_narrow + 완화 대상
  const narrow = diagnoseEmptyResult([
    row(1, { region: ['required', 'match'], salary: ['required', 'mismatch'] }),
    row(2, { region: ['required', 'match'], salary: ['required', 'mismatch'] }),
    row(3, { region: ['required', 'mismatch'], salary: ['required', 'match'] }),
  ])
  assert.equal(narrow.kind, 'too_narrow')
  assert.deepEqual(narrow.relaxable, [{ key: 'salary', count: 2 }, { key: 'region', count: 1 }])

  // 모든 공고가 2개 이상 불일치 + 지역만 봐도 0건 → 범위 공고 부족
  const scope = diagnoseEmptyResult([
    row(1, { region: ['required', 'mismatch'], category: ['required', 'mismatch'] }),
    row(2, { region: ['required', 'mismatch'], category: ['required', 'mismatch'] }),
  ])
  assert.equal(scope.kind, 'few_jobs_in_scope')
  assert.deepEqual(scope.emptyScopes, ['region', 'category'])

  // 필수조건이 지역 하나뿐이고 그 지역 공고가 0건 → "조건이 좁음"이 아니라 공고 부족
  const onlyRegion = diagnoseEmptyResult([
    row(1, { region: ['required', 'mismatch'] }),
    row(2, { region: ['required', 'mismatch'] }),
  ])
  assert.equal(onlyRegion.kind, 'few_jobs_in_scope', 'single empty region is a shortage')
  assert.deepEqual(onlyRegion.emptyScopes, ['region'])

  // 지역 공고 0건처럼 보여도 지역 미확인 공고가 있으면 단정하지 않음
  const scopeButUnknown = diagnoseEmptyResult([
    row(1, { region: ['required', 'mismatch'] }),
    row(2, { region: ['required', 'unknown'] }),
  ])
  assert.equal(scopeButUnknown.kind, 'undetermined')

  // 모든 공고가 2개 이상 불일치지만 각 조건 단독으론 충족 공고가 있음 → 조합이 좁음
  const combo = diagnoseEmptyResult([
    row(1, { region: ['required', 'match'], category: ['required', 'mismatch'], salary: ['required', 'mismatch'] }),
    row(2, { region: ['required', 'mismatch'], category: ['required', 'match'], salary: ['required', 'mismatch'] }),
  ])
  assert.equal(combo.kind, 'too_narrow')
  assert.deepEqual(combo.relaxable, [])
  assert.deepEqual(combo.emptyScopes, ['salary'])

  // 불일치 원인과 정보 부족이 섞임 → 단정하지 않음
  const mixed = diagnoseEmptyResult([
    row(1, { region: ['required', 'match'], salary: ['required', 'mismatch'] }),
    row(2, { region: ['required', 'unknown'], salary: ['required', 'match'] }),
  ])
  assert.equal(mixed.kind, 'undetermined')
  assert.equal(mixed.unknownCount, 1)
  assert.deepEqual(mixed.relaxable, [{ key: 'salary', count: 1 }])
}

// ---------------------------------------------------------------------------
// 4. 입력 → DB 행 / 검증 / 좌표 반올림
// ---------------------------------------------------------------------------
{
  const p = emptyPreferenceInput()
  assert.equal(validatePreferenceInput(p, false), 'Cần ít nhất một điều kiện "Bắt buộc".')

  p.regionImportance = 'required'
  assert.equal(validatePreferenceInput(p, false), 'Hãy chọn ít nhất một khu vực.')
  p.regionIds = ['hcm']
  assert.equal(validatePreferenceInput(p, false), null)

  // 사용하지 않는 조건의 값은 비워서 보낸다
  p.salaryMin = 9_000_000
  p.salaryPeriod = 'month'
  p.salaryImportance = null
  const r = preferenceToRow(p)
  assert.equal(r.salary_min, null)
  assert.equal(r.salary_period, null)
  assert.deepEqual(r.region_ids, ['hcm'])

  p.distanceImportance = 'preferred'
  p.maxDistanceKm = 5
  if (DISTANCE_MATCHING_ENABLED) {
    assert.match(validatePreferenceInput(p, false) ?? '', /vị trí/)
    assert.equal(validatePreferenceInput(p, true), null)
  } else {
    // 1차 배포: 집 위치가 있어도 거리 조건은 저장할 수 없고, 이유를 돌려준다.
    assert.equal(validatePreferenceInput(p, true), DISTANCE_DISABLED_REASON, 'distance disabled in 1st release')
    assert.match(DISTANCE_DISABLED_REASON, /vị trí nơi làm việc/)
  }

  assert.equal(coarsenCoordinate(10.776543), 10.777)
  assert.equal(coarsenCoordinate(106.700487), 106.7)
  assert.equal(coarsenCoordinate(-0.0004), -0)
}

console.log('jobAlerts.test.ts: all assertions passed')
