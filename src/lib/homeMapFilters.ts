// 메인 "내 주변 일자리" 지도 탐색(HomeMapExplorer)의 필터·좌표 판정 — UI와 분리된 순수 로직.
// 2026-10-01: 지도·거리에는 확인된 근무지(verifiedWorkLocationPoint)만 쓴다. 기준 위치(사용자 위치
// 또는 사용자가 고른 지역 중심)는 "검색 출발점"일 뿐 공고 좌표가 아니다.
import { calcDistanceKm, verifiedWorkLocationPoint } from './jobCoords'
import { matchesOccupationGroups } from './occupationGroups'
import { parseSalaryInfo } from './recommendStorage'
import type { Job, JobCategory } from '../types/job'

export const RADIUS_MIN_KM = 0.1
export const RADIUS_MAX_KM = 20
export const RADIUS_DEFAULT_KM = 8

/** 최소 희망 월급(VND). 월급·주기 미표기만 비교하고 시급/일급/교대당은 환산하지 않는다. */
export const SALARY_OPTIONS = [10_000_000, 12_000_000, 15_000_000, 20_000_000, 30_000_000] as const

/** 처음부터 보이는 업종 — 실제 JobCategory만 쓴다(임의 카테고리 금지). 나머지는 "Xem thêm". */
export const PRIMARY_CATEGORIES: JobCategory[] = [
  'san_xuat_xay_dung',
  'quan_ly_ban_hang',
  'am_thuc_do_uong',
  'lai_xe_giao_hang',
  'dich_vu',
  'van_phong',
]

/**
 * "Thêm điều kiện"의 조건 목록. 각 match는 확인된 값(=== true / 명시 선택지)만 통과시킨다 —
 * NULL(정보 미확인)은 어떤 조건도 만족하지 않는다. match가 없는 조건은 화면에서 비활성.
 */
export type ExtraConditionKey =
  | 'shift_day' | 'shift_night' | 'shift_rotating'
  | 'shuttle_bus' | 'dormitory' | 'meals'
  | 'direct_hire' | 'agency'
  | 'urgent' | 'start_now'
  | 'days_5' | 'days_6' | 'weekend'

export interface ExtraCondition {
  key: ExtraConditionKey
  label: string
  /** 공고가 이 조건을 만족하는지. undefined = 아직 판정할 데이터가 없음(비활성). */
  match?: (job: Job) => boolean
}

export const EXTRA_CONDITION_GROUPS: { title: string; items: ExtraCondition[] }[] = [
  { title: 'Ca làm việc', items: [
    { key: 'shift_day', label: 'Ca ngày', match: (job) => job.shiftType === 'day' },
    { key: 'shift_night', label: 'Ca đêm', match: (job) => job.shiftType === 'night' },
    { key: 'shift_rotating', label: 'Xoay ca', match: (job) => job.shiftType === 'rotating' },
  ] },
  { title: 'Đi lại · Phúc lợi', items: [
    { key: 'shuttle_bus', label: 'Xe đưa đón', match: (job) => job.shuttleBus === true },
    { key: 'dormitory', label: 'Ký túc xá', match: (job) => job.dormitory === true },
    { key: 'meals', label: 'Có bữa ăn', match: (job) => job.mealProvided === true },
  ] },
  // 직접채용/도급은 recruitment_type 명시값으로만 판정한다(employer_id 유무로 단정하지 않음).
  { title: 'Hình thức tuyển', items: [
    { key: 'direct_hire', label: 'Tuyển trực tiếp', match: (job) => job.recruitmentType === 'direct' },
    { key: 'agency', label: 'Qua công ty cung ứng', match: (job) => job.recruitmentType === 'agency' },
  ] },
  { title: 'Tình trạng tuyển', items: [
    { key: 'urgent', label: 'Tuyển gấp', match: (job) => job.urgent === true },
    { key: 'start_now', label: 'Đi làm ngay', match: (job) => job.immediateStart === true },
  ] },
  { title: 'Lịch làm việc', items: [
    { key: 'days_5', label: '5 ngày/tuần', match: (job) => job.workSchedule === '5_days' },
    { key: 'days_6', label: '6 ngày/tuần', match: (job) => job.workSchedule === '6_days' },
    { key: 'weekend', label: 'Làm cuối tuần', match: (job) => job.weekendWork === true },
  ] },
]

const EXTRA_BY_KEY = new Map(EXTRA_CONDITION_GROUPS.flatMap((g) => g.items).map((c) => [c.key, c]))

export function isConditionAvailable(key: ExtraConditionKey): boolean {
  return typeof EXTRA_BY_KEY.get(key)?.match === 'function'
}

export interface HomeMapFilterState {
  radiusKm: number
  minSalary: number | null
  includeNegotiable: boolean
  categories: JobCategory[]
  /** 공식 직업분류 2단계 그룹 코드(예: '82' Thợ lắp ráp). 비어 있으면 전체. 미분류 공고는 그룹 선택 시 제외. */
  occupationGroups?: string[]
  extras: ExtraConditionKey[]
}

export const DEFAULT_FILTERS: HomeMapFilterState = {
  radiusKm: RADIUS_DEFAULT_KM,
  minSalary: null,
  includeNegotiable: true,
  categories: [],
  occupationGroups: [],
  extras: [],
}

export interface MapJobPoint { lat: number; lng: number }

/** 지도·거리에 쓸 수 있는 확인된 근무지 좌표만. 없으면 빈 배열(임의 좌표 생성 안 함). */
export function verifiedJobPoints(job: Job): MapJobPoint[] {
  return (job.workLocations ?? [])
    .map((l) => verifiedWorkLocationPoint(l))
    .filter((p): p is MapJobPoint => p !== null)
}

/** Source amounts only: posted monthly maximum first; a single basic amount is its own maximum.
 * Do not turn negotiable wording, shift hours, workday counts or allowances into monthly pay. */
function monthlySalaryAmount(job: Job): number | null {
  const maximums: number[] = []
  const basics: number[] = []
  const number = String.raw`(?:\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)`
  const money = new RegExp(`(${number})(?:\\s*(?:-|–|—|den|toi)\\s*(${number}))?\\s*(trieu|tr\\b|k\\b|dong|vnd|đ)`, 'g')
  const salaryLines = (job.description ?? '').split(/\n|<br\s*\/?>|<\/p>/i).filter(line => /lương|thu nhập|luong|thu nhap/i.test(line))
  for (const source of [job.rawSalary, job.salary, job.salaryNote, ...salaryLines]) {
    const text = (source ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    for (const rawClause of text.split(/[;\n|+]|,(?!\d)/)) {
      const clause = rawClause.replace(/<[^>]*>/g, ' ').replace(/^[\s•*–—:-]+/, '')
      if (/^\s*(?:phu cap|thuong|chuyen can|tro cap)\b/.test(clause) || /\busd\b|\$/.test(clause)) continue
      const explicitUnit = clause.match(/(?:\/|moi\s+)\s*(gio|h|ngay|ca|tuan|thang)\b/)?.[1]
      const monthly = explicitUnit ? explicitUnit === 'thang' : /\bluong thang\b/.test(clause) || job.salaryPeriod === 'month'
      if (!monthly) continue
      for (const match of clause.matchAll(money)) {
        const info = parseSalaryInfo(match[0].replace(/trieu|\btr\b/g, 'triệu'))
        if (!info.range || info.currency !== 'VND') continue
        const isMaximum = Boolean(match[2]) || /toi da|cao nhat|tong thu nhap/.test(clause)
          || ((source === job.salary || source === job.rawSalary) && job.salaryBasis === 'total_with_overtime')
        const target = isMaximum ? maximums : basics
        target.push(info.range.max)
      }
    }
  }
  const candidates = maximums.length ? maximums : basics
  return candidates.length ? Math.max(...candidates) : null
}

export function matchesSalary(job: Job, minSalary: number | null, _includeNegotiable: boolean): boolean {
  if (minSalary === null) return true
  const amount = monthlySalaryAmount(job)
  return amount !== null && amount >= minSalary
}

export function matchesFilters(job: Job, f: HomeMapFilterState): boolean {
  if (!matchesSalary(job, f.minSalary, f.includeNegotiable)) return false
  if (f.categories.length > 0 && !f.categories.includes(job.category)) return false
  if (!matchesOccupationGroups(job, f.occupationGroups ?? [])) return false
  for (const key of f.extras) {
    const match = EXTRA_BY_KEY.get(key)?.match
    if (match && !match(job)) return false
  }
  return true
}

export interface NearbyJob {
  job: Job
  /** 기준 위치에서 가장 가까운 확인된 근무지 */
  point: MapJobPoint
  distanceKm: number
}

/** 확인된 근무지가 반경 안에 있고 필터를 통과하는 공고, 가까운 순. */
export function findNearbyJobs(jobs: Job[], origin: MapJobPoint, f: HomeMapFilterState): NearbyJob[] {
  const out: NearbyJob[] = []
  for (const job of jobs) {
    if (!matchesFilters(job, f)) continue
    let best: NearbyJob | null = null
    for (const p of verifiedJobPoints(job)) {
      const d = calcDistanceKm(origin.lat, origin.lng, p.lat, p.lng)
      if (d <= f.radiusKm && (!best || d < best.distanceKm)) best = { job, point: p, distanceKm: d }
    }
    if (best) out.push(best)
  }
  return out.sort((a, b) => a.distanceKm - b.distanceKm)
}

export function formatSalaryOption(v: number): string {
  return `${Math.round(v / 1_000_000)}M+`
}
