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
    p.workDays !== 'any' || p.workPeriod !== 'any'
  )
}

// ---------------------------------------------------------------------------
// Salary parsing — extracts an approximate hourly rate from Vietnamese salary text
// ---------------------------------------------------------------------------
export function parseSalaryToHourly(salary: string): number {
  if (!salary) return 0

  // "thỏa thuận" / "theo đơn" — unknowable, return a neutral mid estimate
  const lower = salary.toLowerCase()
  if (lower.includes('thỏa thuận') || lower.includes('thoả thuận')) return 28_000
  if (lower.includes('theo đơn') || lower.includes('theo lich')) return 25_000

  // Extract all numeric groups (dots = thousand separators, commas = decimal in VN)
  const nums = [...salary.matchAll(/(\d[\d.]*)/g)]
    .map((m) => parseInt(m[1].replace(/\./g, ''), 10))
    .filter((n) => !isNaN(n) && n > 0)

  if (!nums.length) return 0
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length

  if (lower.includes('/giờ') || lower.includes('đ/h') || lower.includes('/gio')) return avg
  if (lower.includes('/tháng') || lower.includes('tháng')) return Math.round(avg / 160)
  if (lower.includes('/ngày') || lower.includes('ngày')) return Math.round(avg / 8)
  if (lower.includes('/ca') || lower.includes('/ ca') || lower.includes('ca)')) return Math.round(avg / 8)

  // Heuristic: if avg < 500k → hourly, < 5M → daily, else monthly
  if (avg < 500_000) return avg
  if (avg < 5_000_000) return Math.round(avg / 8)
  return Math.round(avg / 160)
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

  // Salary (25 pts)
  const hourly = parseSalaryToHourly(job.salary)
  if (prefs.minHourlySalary > 0) {
    if (hourly > 0 && hourly >= prefs.minHourlySalary) {
      score += 25
      reasons.push('Lương phù hợp')
    } else if (hourly > 0 && hourly >= prefs.minHourlySalary * 0.8) {
      score += 12
      reasons.push('Lương gần mức yêu cầu')
    }
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

  // Category (10 pts)
  if (prefs.categories.length > 0) {
    if (prefs.categories.includes(job.category)) {
      score += 10
      reasons.push('Ngành phù hợp')
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
