// 메인 "내 주변 일자리" 지도 탐색(HomeMapExplorer)의 필터·좌표 판정 — UI와 분리된 순수 로직.
// 2026-10-01: 지도·거리에는 확인된 근무지(verifiedWorkLocationPoint)만 쓴다. 기준 위치(사용자 위치
// 또는 사용자가 고른 지역 중심)는 "검색 출발점"일 뿐 공고 좌표가 아니다.
import { calcDistanceKm, verifiedWorkLocationPoint } from './jobCoords'
import { parseSalaryInfo } from './recommendStorage'
import type { Job, JobCategory } from '../types/job'

export const RADIUS_MIN_KM = 1
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
 * "Thêm điều kiện"의 장기 조건 목록. match가 없는 조건은 아직 저장 필드가 없어 화면에서
 * 비활성으로만 보여준다 — 데이터 필드가 생기면 match만 채우면 바로 활성화된다.
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
    { key: 'shift_day', label: 'Ca ngày' },
    { key: 'shift_night', label: 'Ca đêm' },
    { key: 'shift_rotating', label: 'Xoay ca' },
  ] },
  { title: 'Đi lại · Phúc lợi', items: [
    { key: 'shuttle_bus', label: 'Xe đưa đón' },
    { key: 'dormitory', label: 'Ký túc xá' },
    { key: 'meals', label: 'Có bữa ăn' },
  ] },
  // 직접채용/도급은 신뢰할 판정 데이터가 아직 없다(employer_id 유무로 단정하지 않음).
  { title: 'Hình thức tuyển', items: [
    { key: 'direct_hire', label: 'Tuyển trực tiếp' },
    { key: 'agency', label: 'Qua công ty cung ứng' },
  ] },
  { title: 'Tình trạng tuyển', items: [
    { key: 'urgent', label: 'Tuyển gấp', match: (job) => job.urgent === true },
    { key: 'start_now', label: 'Đi làm ngay' },
  ] },
  { title: 'Lịch làm việc', items: [
    { key: 'days_5', label: '5 ngày/tuần' },
    { key: 'days_6', label: '6 ngày/tuần' },
    { key: 'weekend', label: 'Làm cuối tuần' },
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
  extras: ExtraConditionKey[]
}

export const DEFAULT_FILTERS: HomeMapFilterState = {
  radiusKm: RADIUS_DEFAULT_KM,
  minSalary: null,
  includeNegotiable: true,
  categories: [],
  extras: [],
}

export interface MapJobPoint { lat: number; lng: number }

/** 지도·거리에 쓸 수 있는 확인된 근무지 좌표만. 없으면 빈 배열(임의 좌표 생성 안 함). */
export function verifiedJobPoints(job: Job): MapJobPoint[] {
  return (job.workLocations ?? [])
    .map((l) => verifiedWorkLocationPoint(l))
    .filter((p): p is MapJobPoint => p !== null)
}

export function matchesSalary(job: Job, minSalary: number | null, includeNegotiable: boolean): boolean {
  if (minSalary === null) return true
  const info = parseSalaryInfo(job.salary)
  if (!info.range) return includeNegotiable && info.isNegotiable
  if (info.currency !== 'VND') return false
  if (info.period !== 'month' && info.period !== 'unknown') return false
  return info.range.max >= minSalary
}

export function matchesFilters(job: Job, f: HomeMapFilterState): boolean {
  if (!matchesSalary(job, f.minSalary, f.includeNegotiable)) return false
  if (f.categories.length > 0 && !f.categories.includes(job.category)) return false
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
