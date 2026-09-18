import type { Job, JobCategory } from '../types/job'
import { jobMatchesRegion, type JobRegionId } from '../data/jobRegions'
import { normalizeViText } from './jobCoords'

export type TimeSlot = 'morning' | 'afternoon' | 'evening' | 'weekend' | 'flexible'

export const TIME_SLOT_LABELS: Record<TimeSlot, string> = {
  morning: 'Buổi sáng',
  afternoon: 'Buổi chiều',
  evening: 'Buổi tối',
  weekend: 'Cuối tuần',
  flexible: 'Linh hoạt',
}

export const ALL_TIME_SLOTS: TimeSlot[] = [
  'morning',
  'afternoon',
  'evening',
  'weekend',
  'flexible',
]

export type WorkDaysPref = 'any' | 'weekday' | 'weekend'
export type WorkPeriodPref = 'any' | 'long' | 'short'

export const WORK_DAYS_LABELS: Record<WorkDaysPref, string> = {
  any: 'Không yêu cầu',
  weekday: 'Ngày thường (T2–T6)',
  weekend: 'Cuối tuần',
}

export const WORK_PERIOD_LABELS: Record<WorkPeriodPref, string> = {
  any: 'Không yêu cầu',
  long: 'Dài hạn',
  short: 'Ngắn hạn',
}

export interface RecommendPrefs {
  regionId: string        // JobRegionId or '' = any
  minHourlySalary: number // 0 = no min
  timeSlots: TimeSlot[]
  categories: JobCategory[]
  /** `${category}:${subId}` 복합키 — subcategory id는 대분류마다 겹칠 수
   *  있어(UrgentJobsPage.tsx의 selectedSubcategoryKeys와 동일 이유) 이 형식
   *  으로 저장한다. */
  subcategories: string[]
  workDays: WorkDaysPref
  workPeriod: WorkPeriodPref
}

export interface JobMatch {
  job: Job
  score: number    // 0–100
  reasons: string[]
}

const KEY = 'vgb_recommend_prefs'

const EMPTY: RecommendPrefs = {
  regionId: '',
  minHourlySalary: 0,
  timeSlots: [],
  categories: [],
  subcategories: [],
  workDays: 'any',
  workPeriod: 'any',
}

export function loadPrefs(): RecommendPrefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...EMPTY }
    return { ...EMPTY, ...JSON.parse(raw) }
  } catch {
    return { ...EMPTY }
  }
}

export function savePrefs(prefs: RecommendPrefs): void {
  localStorage.setItem(KEY, JSON.stringify(prefs))
  window.dispatchEvent(new CustomEvent('vgb:recommend-prefs'))
}

export function hasPrefs(p: RecommendPrefs): boolean {
  return !!(
    p.regionId || p.minHourlySalary > 0 || p.timeSlots.length || p.categories.length ||
    p.subcategories.length || p.workDays !== 'any' || p.workPeriod !== 'any'
  )
}

// ---------------------------------------------------------------------------
// Salary parsing
// ---------------------------------------------------------------------------
// 2026-09-14 1차 수정(사용자 지시) — 실제 운영 데이터(local_jobs 활성 265건)
// 기준: 227건(86%)이 "15 - 20 triệu" 같은 "N - M triệu" 표기, 36건(14%)이
// "협의"/"thương lượng" 계열, 시급 명시 공고는 0건. 예전 코드는 "triệu"(백만)
// 단위를 전혀 해석 못 해 [15, 20]을 평균(17.5)낸 뒤 "avg < 500_000 → 시급"
// 휴리스틱에 걸려 시급 17.5원(!)으로 계산했었다. "협의"는 28,000원/시급,
// "건당"은 25,000원으로 없는 근거를 지어내던 것도 제거했다.
//
// 2026-09-14 2차 수정(같은 날, 후속 지시) — 1차 수정에서도 "Lương cao" 정렬
// 전용 parseSalaryToHourly()가 여전히 월급÷160/일급÷8라는 근거 없는 상수
// 환산을 남겨뒀었다("화면에 노출 안 되니 정렬 내부 근사치로는 허용"이라고
// 판단했으나, 사용자가 "화면 노출 여부와 관계없이 사용 금지"로 재지시) — 이제
// 정렬에서도 그런 환산을 완전히 제거한다. 대신 급여를 (통화, 지급 주기) 축으로
// 묶어 "같은 통화·같은 지급 단위" 안에서만 비교하고, 통화/단위가 다르거나
// 지급 주기를 알 수 없는 공고는 별도 집단으로 구분해 표시한다(아래
// groupJobsForSalarySort 참고) — 금액 배율(triệu/k)과 지급 주기(월/일/시간)는
// 서로 별개의 정보이므로, 배율 접미사가 있다고 지급 주기를 추정하지 않는다.
const MILLION = 1_000_000
const THOUSAND = 1_000

export interface SalaryRange {
  min: number
  max: number
}

export type SalaryCurrency = 'VND' | 'USD'
export type SalaryPeriod = 'hour' | 'day' | 'shift' | 'month' | 'unknown'

export interface SalaryInfo {
  /** 협의/건당(시간 근거 없음)/파싱 불가 등 금액 자체를 알 수 없으면 null —
   *  0과 혼동하지 않도록 별도로 구분한다. */
  range: SalaryRange | null
  isNegotiable: boolean
  /** "$"/"usd" 표기가 없으면 VND로 본다 — 이 저장소가 베트남 구인구직
   *  사이트이므로 통화 기호 부재는 "통화 불명"이 아니라 "베트남 동"이라는
   *  이 사이트의 기본 통화 관례로 취급한다(지급 주기처럼 금액 텍스트 안에서
   *  추정하는 것과는 다른 층위의 판단 — 사이트 전체의 고정 전제). */
  currency: SalaryCurrency
  /** 텍스트에 "/giờ"·"/ngày"·"/ca"·"/tháng" 등 지급 주기가 명시된 경우에만
   *  채운다. "triệu"/"k" 같은 금액 배율 접미사만으로는 지급 주기를 추정하지
   *  않는다 — 배율과 주기는 별개다(2026-09-14 사용자 지시). 이 필드가
   *  'unknown'이면 금액은 알아도 "월급인지 시급인지"는 모른다는 뜻이다.
   */
  period: SalaryPeriod
}

/** 협의/건당(시간 근거 없음) 등 금액 자체를 알 수 없는 표기. */
function isUnknownAmount(lower: string): boolean {
  return /thỏa thuận|thoả thuận|thương lượng|theo đơn|theo sản phẩm|\bkhoán\b/.test(lower)
}

/** "N.NNN"/"N,NNN"처럼 3자리씩 반복되는 자릿수 구분자와 "N.N"/"N,N"처럼
 *  1~2자리로 끝나는 소수점을 구분해서 숫자 토큰 하나를 정확한 값으로 바꾼다.
 *  베트남 공고는 "9.5 triệu"(소수점)와 "9.000.000đ"(자릿수 구분자), 드물게
 *  "$ 1,500"(영문식 자릿수 구분자)까지 섞여 있어 단순히 구분자를 전부
 *  지우면(예전 구현) "9.5"가 95가 되는 등 오차가 난다. */
function tokenToNumber(token: string): number {
  const m = token.match(/^(.*?)([.,])(\d+)$/)
  if (!m) return parseInt(token, 10)
  const [, head, , tail] = m
  if (tail.length >= 3) {
    // 마지막 구분자 뒤가 3자리 이상 → 자릿수 구분자였다. 전체를 정수로 합친다.
    return parseInt((head + tail).replace(/[.,]/g, ''), 10)
  }
  // 마지막 구분자 뒤가 1~2자리 → 소수점. 앞쪽에 남은 구분자(있다면)는 자릿수
  // 구분자이므로 마저 제거한다.
  return parseFloat(`${head.replace(/[.,]/g, '')}.${tail}`)
}

const NUMBER_TOKEN_RE = /\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+[.,]\d{1,2}(?!\d)|\d+/g
const USD_RE = /\$|usd\b/
const HOURLY_UNIT_RE = /đ\s*\/\s*(giờ|gio)|\/\s*(giờ|gio)|\/\s*h\b/
const DAILY_UNIT_RE = /\/\s*ngày\b/
const SHIFT_UNIT_RE = /\/\s*ca\b/
const MONTHLY_UNIT_RE = /\/\s*tháng\b/

/**
 * 급여 텍스트를 금액 범위 + 통화 + 지급 주기로 분해한다. 금액 배율(triệu/k)과
 * 지급 주기(월/일/시간/교대)는 서로 다른 신호에서 따로 읽는다 — "15 - 20
 * triệu"처럼 배율만 있고 지급 주기 표기가 전혀 없으면 period는 'unknown'이
 * 된다(금액이 크다고 월급으로, 작다고 시급으로 단정하지 않는다).
 */
export function parseSalaryInfo(salary: string): SalaryInfo {
  const lower = (salary || '').toLowerCase()
  const currency: SalaryCurrency = USD_RE.test(lower) ? 'USD' : 'VND'
  let period: SalaryPeriod = 'unknown'
  if (HOURLY_UNIT_RE.test(lower)) period = 'hour'
  else if (DAILY_UNIT_RE.test(lower)) period = 'day'
  else if (SHIFT_UNIT_RE.test(lower)) period = 'shift'
  else if (MONTHLY_UNIT_RE.test(lower)) period = 'month'

  if (!salary || isUnknownAmount(lower)) {
    return { range: null, isNegotiable: !!salary && isUnknownAmount(lower), currency, period }
  }

  const isMillion = /triệu/.test(lower)
  const isK = /\d\s*k\b/i.test(lower)
  const nums = (lower.match(NUMBER_TOKEN_RE) ?? [])
    .map(tokenToNumber)
    .filter((n) => !isNaN(n) && n > 0)
  if (nums.length === 0) return { range: null, isNegotiable: false, currency, period }

  // 이미 완성된 큰 금액(자릿수 구분자로 파싱된 경우 등)까지 다시 곱하지
  // 않도록, 아직 배율 접미사가 안 곱해진 작은 숫자에만 적용한다.
  const scaled = nums.map((n) => {
    if (isMillion && n < 1000) return n * MILLION
    if (isK && n < 1000) return n * THOUSAND
    return n
  })
  return { range: { min: Math.min(...scaled), max: Math.max(...scaled) }, isNegotiable: false, currency, period }
}

/** 예전 SalaryRange 반환 형태 — parseSalaryInfo의 range만 꺼낸다(하위 호환용,
 *  단위/통화 정보 없이 금액만 필요한 곳에서 쓴다). */
export function parseSalaryRange(salary: string): SalaryRange | null {
  return parseSalaryInfo(salary).range
}

/**
 * 공고 급여 텍스트에 "시급"이라고 명시적으로 적혀 있고(period==='hour'),
 * 통화가 VND일 때만 그 금액 범위를 반환한다 — 월급/일급/교대당 금액은 실제
 * 근무시간 근거(하루 몇 시간, 월 며칠 근무) 없이 임의의 상수로 나눠 "시급"
 * 이라고 단정하지 않는다. USD 시급은 VND 희망 시급과 통화가 달라 직접 비교할
 * 수 없으므로 이 함수는 VND만 반환한다(2026-09-14 사용자 지시: "USD와 VND…
 * 직접 비교 없음"). 추천 매칭의 "희망 시급" 조건 비교는 반드시 이 함수만
 * 쓴다.
 */
export function parseExplicitHourlyRange(salary: string): SalaryRange | null {
  const info = parseSalaryInfo(salary)
  if (info.period !== 'hour' || info.currency !== 'VND') return null
  return info.range
}

export interface SalaryTierGroup {
  /** "VND:month", "USD:hour" 등 — 사람이 읽을 라벨은 salaryTierLabel() 참고. */
  key: string
  currency: SalaryCurrency
  period: SalaryPeriod
  /** 이 집단(같은 통화·같은 지급 주기) 안에서만 금액 중간값 기준 내림차순
   *  정렬됨 — 집단을 벗어난 비교(다른 통화/다른 주기와의 상대적 우열)는
   *  하지 않는다. */
  jobs: Job[]
}

export interface SalaryTierResult {
  /** 금액을 알 수 있는 공고만, (통화, 지급 주기)별로 묶여 각 집단 내부는
   *  금액 내림차순. 집단 간에는 순서 우열이 없다 — 집단이 여러 개면 화면에서
   *  구분해서 보여줘야 한다(집단을 하나로 합쳐 "고액 순위"를 만들지 않음). */
  groups: SalaryTierGroup[]
  /** 협의/건당/파싱 불가 등 금액 자체를 모르는 공고 — "고액" 판정에서 제외. */
  unpriced: Job[]
}

function salaryPeriodLabel(period: SalaryPeriod): string {
  switch (period) {
    case 'hour': return 'theo giờ'
    case 'day': return 'theo ngày'
    case 'shift': return 'theo ca'
    case 'month': return 'theo tháng'
    default: return 'chưa rõ đơn vị'
  }
}

export function salaryTierLabel(group: Pick<SalaryTierGroup, 'currency' | 'period'>): string {
  return `${group.currency} · ${salaryPeriodLabel(group.period)}`
}

/**
 * "Lương cao" 정렬 — 같은 통화·같은 지급 주기 안에서만 금액을 비교한다(2026-
 * 09-14 사용자 지시). 근무시간 근거 없는 월↔시급 변환, USD↔VND 변환을 전혀
 * 하지 않는다 — 서로 다른 (통화, 지급 주기) 조합은 별개 집단으로 남기고,
 * 화면은 이 집단 구분을 그대로 보여줘야 한다(임의 환산으로 하나의 순위를
 * 만들지 않음). 협의/건당/금액 미상은 unpriced로 분리해 "고액" 판정에서
 * 제외하고, 화면에서 그 상태를 그대로 노출한다(원래 salary 텍스트가 이미
 * "Thỏa thuận" 등으로 보여주고 있으므로 별도 배지 없이도 상태가 드러난다).
 */
export function groupJobsForSalarySort(jobs: Job[]): SalaryTierResult {
  const byKey = new Map<string, SalaryTierGroup>()
  const unpriced: Job[] = []

  for (const job of jobs) {
    const info = parseSalaryInfo(job.salary)
    if (!info.range) {
      unpriced.push(job)
      continue
    }
    const key = `${info.currency}:${info.period}`
    let group = byKey.get(key)
    if (!group) {
      group = { key, currency: info.currency, period: info.period, jobs: [] }
      byKey.set(key, group)
    }
    group.jobs.push(job)
  }

  const groups = [...byKey.values()]
    .map((g) => ({
      ...g,
      jobs: [...g.jobs].sort((a, b) => {
        const am = parseSalaryInfo(a.salary).range
        const bm = parseSalaryInfo(b.salary).range
        const aMid = am ? (am.min + am.max) / 2 : 0
        const bMid = bm ? (bm.min + bm.max) / 2 : 0
        return bMid - aMid
      }),
    }))
    // 가장 표본이 많은(=현재 이 사이트에서 가장 흔한) 집단을 먼저 보여준다 —
    // 특정 통화/주기를 임의로 "기본"이라고 우선시하지 않기 위한 중립적 기준.
    .sort((a, b) => b.jobs.length - a.jobs.length)

  return { groups, unpriced }
}

// ---------------------------------------------------------------------------
// Time-slot detection — classify a job's `hours` string
// ---------------------------------------------------------------------------
function detectJobSlots(hours: string): Set<TimeSlot> {
  const h = normalizeViText(hours || '')
  const s = new Set<TimeSlot>()

  if (/(sang|buoi sang|ca sang|\b[678]:00)/.test(h)) s.add('morning')
  if (/(chieu|buoi chieu|ca chieu|1[234]:00)/.test(h)) s.add('afternoon')
  if (/(toi|buoi toi|ca toi|1[89]:00|20:00|21:00)/.test(h)) s.add('evening')
  if (/(cuoi tuan|thu 7|thu bay|chu nhat|\bt7\b|\bcn\b)/.test(h)) s.add('weekend')
  if (/(linh hoat|theo lich|theo ca|xoay ca|\d+.*gio\/ngay|theo don)/.test(h)) s.add('flexible')

  // "ca ngay" covers morning + afternoon
  if (h.includes('ca ngay')) {
    s.add('morning')
    s.add('afternoon')
  }

  // If nothing matched but there IS an hours string → treat as flexible
  if (s.size === 0 && hours.trim()) s.add('flexible')

  return s
}

// ---------------------------------------------------------------------------
// Work-days / work-period detection — classify a job's `workDays`/`workPeriod`
// free-text field. Trả về undefined khi không xác định được (văn bản không rõ
// ràng) — trường hợp này KHÔNG được tính là khớp, chỉ đơn giản là không có tín
// hiệu (tránh coi dữ liệu không xác định là "khớp điều kiện").
// ---------------------------------------------------------------------------
function detectWorkDaysCategory(workDays: string): 'weekday' | 'weekend' | 'both' | undefined {
  const d = normalizeViText(workDays || '')
  if (!d) return undefined
  const hasWeekend = /(cuoi tuan|thu 7|thu bay|chu nhat|\bt7\b|\bcn\b)/.test(d)
  const hasWeekday = /(t2\s*-\s*t6|thu 2.*thu 6|ngay thuong|tu thu 2|thu hai.*thu sau)/.test(d)
  const hasAllDays = /(tat ca cac ngay|ca tuan|7 ngay|các ngày trong tuần|xoay ca)/.test(d)
  if (hasAllDays || (hasWeekday && hasWeekend)) return 'both'
  if (hasWeekday) return 'weekday'
  if (hasWeekend) return 'weekend'
  return undefined
}

function detectWorkPeriodCategory(workPeriod: string): 'long' | 'short' | undefined {
  const p = normalizeViText(workPeriod || '')
  if (!p) return undefined
  if (/(dai han|lau dai|toan thoi gian|khong thoi han|on dinh|full.?time)/.test(p)) return 'long'
  if (/(ngan han|thoi vu|1 thang|2 thang|3 thang|theo mua|part.?time|thoi gian ngan)/.test(p)) return 'short'
  return undefined
}

// ---------------------------------------------------------------------------
// Core scoring — returns 0-100
// Weights: region 30 | salary 25 | time slot 15 | category 10 | work days 10 |
// work period 10
// ---------------------------------------------------------------------------
export function scoreJob(job: Job, prefs: RecommendPrefs): JobMatch {
  let score = 0
  const reasons: string[] = []

  // Region (30 pts)
  if (prefs.regionId) {
    if (jobMatchesRegion(job.location, prefs.regionId as JobRegionId)) {
      score += 30
      reasons.push('Đúng khu vực')
    }
    // no match → 0 pts (region is a hard signal)
  } else {
    score += 15 // baseline: no preference
  }

  // Salary (25 pts) — 2026-09-14: 희망 시급 조건은 공고에 시급이 명시된
  // 경우에만 비교한다(parseExplicitHourlyRange). 월급/일급/협의 등 근거 없는
  // 공고는 "충족"도 "근접"도 표시하지 않는다(비교할 근거가 없으므로 가점 0) —
  // 이 저장소 공개 공고는 대부분 "N - M triệu" 월급 표기라 이 조건에서 대부분
  // 0점을 받는 것이 의도된 동작이다(허위로 "충족"을 표시하는 것보다 낫다).
  // 범위가 있는 공고는 범위의 평균/최댓값만으로 "확실히 충족"을 판정하지
  // 않는다 — 범위 최솟값이 희망 시급 이상일 때만 확실한 충족으로 본다.
  if (prefs.minHourlySalary > 0) {
    const hourlyRange = parseExplicitHourlyRange(job.salary)
    if (hourlyRange) {
      if (hourlyRange.min >= prefs.minHourlySalary) {
        score += 25
        reasons.push('Lương phù hợp')
      } else if (hourlyRange.max >= prefs.minHourlySalary * 0.8) {
        // 범위가 희망 시급에 걸쳐 있거나(max >= 희망 시급이지만 min 미만이라
        // 확실하지 않음) 근접한 경우 — "확실히 충족"이 아니라 "근접/가능성"만
        // 알린다.
        score += 12
        reasons.push('Lương gần mức yêu cầu')
      }
    }
    // hourlyRange가 없으면(월급/일급/협의 등) 비교 근거가 없으므로 가점 없음.
  } else {
    score += 12 // baseline
  }

  // Time slot (15 pts)
  if (prefs.timeSlots.length > 0) {
    const jobSlots = detectJobSlots(job.hours ?? '')
    const matched = prefs.timeSlots.filter((ts) => jobSlots.has(ts))
    if (matched.length > 0) {
      score += 15
      reasons.push(matched.map((ts) => TIME_SLOT_LABELS[ts]).join(' · '))
    } else if (jobSlots.has('flexible')) {
      score += 8
      reasons.push('Ca linh hoạt')
    }
  } else {
    score += 8 // baseline
  }

  // Category (10 pts) + phân loại chi tiết (5 pts thêm nếu khớp)
  if (prefs.categories.length > 0) {
    if (prefs.categories.includes(job.category)) {
      score += 10
      reasons.push('Ngành phù hợp')
      if (
        prefs.subcategories.length > 0 &&
        job.subcategory &&
        prefs.subcategories.includes(`${job.category}:${job.subcategory}`)
      ) {
        score += 5
        reasons.push('Phân loại chi tiết phù hợp')
      }
    }
  } else {
    score += 5 // baseline
  }

  // Work days (10 pts) — chỉ cộng điểm khi văn bản job.workDays xác định rõ
  // ràng khớp với lựa chọn; không xác định được thì không tính là khớp.
  if (prefs.workDays !== 'any') {
    const jobDays = detectWorkDaysCategory(job.workDays ?? '')
    if (jobDays === 'both' || jobDays === prefs.workDays) {
      score += 10
      reasons.push(WORK_DAYS_LABELS[prefs.workDays])
    }
  } else {
    score += 5 // baseline
  }

  // Work period (10 pts) — tương tự, chỉ khớp khi xác định được rõ ràng.
  if (prefs.workPeriod !== 'any') {
    const jobPeriod = detectWorkPeriodCategory(job.workPeriod ?? '')
    if (jobPeriod === prefs.workPeriod) {
      score += 10
      reasons.push(WORK_PERIOD_LABELS[prefs.workPeriod])
    }
  } else {
    score += 5 // baseline
  }

  if (job.urgent) reasons.push('Tuyển gấp')

  return { job, score, reasons }
}

export function matchJobs(jobs: Job[], prefs: RecommendPrefs): JobMatch[] {
  if (!hasPrefs(prefs)) return []
  // Khu vực là bộ lọc cứng khi người dùng đã chọn — không được trộn công việc
  // ngoài khu vực đã chọn vào kết quả chỉ vì điểm số ở các tiêu chí khác cao
  // hơn ngưỡng (scoreJob() vẫn cộng điểm baseline cho khu vực không khớp, nhưng
  // ở đây phải loại hẳn trước khi xét ngưỡng điểm).
  const candidates = prefs.regionId
    ? jobs.filter((j) => jobMatchesRegion(j.location, prefs.regionId as JobRegionId, j.workLocations))
    : jobs
  return candidates
    .map((j) => scoreJob(j, prefs))
    .filter((m) => m.score >= 40)
    .sort((a, b) => b.score - a.score)
}
