import { DEFAULT_JOB_SEARCH_PARAMS, filterAndSortJobs } from '../../lib/jobSearch'
import { filterJobsByListConditions, type JobListConditions } from '../../lib/jobListFilter'
import { DEFAULT_FILTERS, matchesFilters, type ExtraConditionKey, type HomeMapFilterState } from '../../lib/homeMapFilters'
import type { JobArea } from '../../lib/jobAreaWards'
import type { DayCode, TimeBucket } from '../../lib/workScheduleParse'
import type { Job, JobCategory } from '../../types/job'

/** 앱이 한 곳에서 쓰는 필터 상태 — 검색어·지역·업종·기간·요일·시간·성별·연령·급여·복리후생·채용 방식 등.
 *  판정은 새로 만들지 않고 기존 lib 함수를 이어 붙인다: 검색어 = jobSearch.filterAndSortJobs, 지역·업종·기간·요일·시간·성별·연령 =
 *  jobListFilter(웹 목록과 같은 함수), 급여·복리후생·채용 방식·상태·일정 = homeMapFilters.matchesFilters(웹 지도와 같은 함수). */
export interface AppFilterState {
  query: string
  province: string | null
  wards: string[]
  categories: JobCategory[]
  jobDurations: string[]
  days: DayCode[]
  timeBuckets: TimeBucket[]
  gender: 'Nam' | 'Nữ' | null
  age: string
  pledgeOnly: boolean
  employmentTypes: NonNullable<Job['employmentType']>[]
  keywords: string[]
  minSalary: number | null
  extras: ExtraConditionKey[]
  radiusKm: number
}

export const EMPTY_APP_FILTERS: AppFilterState = {
  query: '', province: null, wards: [], categories: [], jobDurations: [], days: [], timeBuckets: [], gender: null, age: '',
  pledgeOnly: false, employmentTypes: [], keywords: [], minSalary: null, extras: [], radiusKm: DEFAULT_FILTERS.radiusKm,
}

export type AppJobAreas = ReadonlyMap<string, Pick<JobArea, 'provinces' | 'wards'>>

export function toListConditions(f: AppFilterState): JobListConditions {
  return {
    selectedProvince: f.province,
    selectedWards: new Set(f.wards),
    categoryIds: new Set(f.categories),
    selectedSubcategoryKeys: new Set(),
    workPeriods: new Set(),
    jobDurations: new Set(f.jobDurations),
    genderFilter: f.gender,
    ageFilter: f.age,
    pledgeOnly: f.pledgeOnly,
    selectedDays: new Set(f.days),
    selectedDayCounts: new Set(),
    excludeUnspecifiedDays: false,
    excludeUnspecifiedHours: false,
    selectedTimeBuckets: new Set(f.timeBuckets),
    includeKeywords: f.keywords,
    excludeKeywords: [],
  }
}

export function toMapFilters(f: AppFilterState): HomeMapFilterState {
  return { ...DEFAULT_FILTERS, radiusKm: f.radiusKm, minSalary: f.minSalary, extras: f.extras, categories: [] }
}

/** 조건을 하나도 안 걸었으면 false — 조건 개수 배지·"Đặt lại" 표시에 쓴다. */
export function activeFilterCount(f: AppFilterState): number {
  return (f.province ? 1 : 0) + f.wards.length + f.categories.length + f.jobDurations.length + f.days.length + f.timeBuckets.length +
    (f.gender ? 1 : 0) + (f.age ? 1 : 0) + (f.pledgeOnly ? 1 : 0) + f.employmentTypes.length + f.keywords.length + (f.minSalary !== null ? 1 : 0) + f.extras.length
}

export function applyAppFilters(jobs: Job[], f: AppFilterState, areas: AppJobAreas): Job[] {
  let list = jobs
  if (f.query.trim()) list = filterAndSortJobs(list, { ...DEFAULT_JOB_SEARCH_PARAMS, search: f.query }, new Map())
  list = filterJobsByListConditions(list, toListConditions(f), areas)
  if (f.employmentTypes.length > 0) list = list.filter((j) => !!j.employmentType && f.employmentTypes.includes(j.employmentType))
  const map = toMapFilters(f)
  if (map.minSalary !== null || map.extras.length > 0) list = list.filter((j) => matchesFilters(j, map))
  return list
}
