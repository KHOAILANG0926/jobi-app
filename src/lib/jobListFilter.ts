import { normalizeViText } from './jobCoords'
import type { JobArea } from './jobAreaWards'
import { parseWorkDays, parseWorkHourBuckets, type DayCode, type TimeBucket } from './workScheduleParse'
import type { Job, JobCategory } from '../types/job'

/** 지역·업종·기간·요일·시간·성별·연령·키워드 목록 필터 — pages/jobsMenu/UrgentJobsPage.tsx의 `filtered` useMemo 본문을
 *  그대로 뽑아낸 순수 함수다(jobSearch.filterAndSortJobs를 Home.tsx에서 뽑아낸 것과 같은 방식). 로직은 바꾸지 않았고,
 *  웹 목록 화면과 앱(src/app) 목록 화면이 이 함수 하나를 공유해 같은 조건에 다른 결과가 나오는 일을 막는다. */
export interface JobListConditions {
  selectedProvince: string | null
  selectedWards: ReadonlySet<string>
  categoryIds: ReadonlySet<JobCategory>
  selectedSubcategoryKeys: ReadonlySet<string>
  workPeriods: ReadonlySet<string>
  jobDurations: ReadonlySet<string>
  genderFilter: 'Nam' | 'Nữ' | null
  ageFilter: string
  pledgeOnly: boolean
  selectedDays: ReadonlySet<DayCode>
  selectedDayCounts: ReadonlySet<number>
  excludeUnspecifiedDays: boolean
  excludeUnspecifiedHours: boolean
  selectedTimeBuckets: ReadonlySet<TimeBucket>
  includeKeywords: readonly string[]
  excludeKeywords: readonly string[]
}

export function filterJobsByListConditions(
  jobs: Job[],
  c: JobListConditions,
  jobAreas: ReadonlyMap<string, Pick<JobArea, 'provinces' | 'wards'>>,
): Job[] {
  let list = jobs
  // 2026-11-03 Lee "급구 페이지는 자동으로 연결하는 게 맞다" — DB에 따로 채워야
  // 하던 resolved_* 칸 대신 공고 주소로 바로 판정(lib/jobAreaWards.ts, 메인·검색과 같은 기준).
  if (c.selectedProvince) {
    const province = c.selectedProvince
    list = list.filter((j) => {
      const area = jobAreas.get(j.id)
      if (!area || !area.provinces.includes(province)) return false
      if (c.selectedWards.size === 0) return true
      return area.wards.some((w) => c.selectedWards.has(w))
    })
  }
  if (c.categoryIds.size > 0) list = list.filter((j) => c.categoryIds.has(j.category))
  if (c.selectedSubcategoryKeys.size > 0) {
    list = list.filter((j) => !!j.subcategory && c.selectedSubcategoryKeys.has(`${j.category}:${j.subcategory}`))
  }
  if (c.workPeriods.size > 0) list = list.filter((j) => !!j.workPeriod && c.workPeriods.has(j.workPeriod))
  if (c.jobDurations.size > 0) list = list.filter((j) => !!j.jobDuration && c.jobDurations.has(j.jobDuration))
  // 성별/연령은 "이 공고 자체의 성질"이 아니라 "누가 지원 가능한가"라는 조건이라 workPeriod/jobDuration과 다르게
  // 다룬다 — 조건 값이 없는 공고(genderRequirement/ageRequirement가 null)는 "제한 없음"을 뜻하므로 어느 필터를
  // 선택해도 계속 보여야 한다.
  if (c.genderFilter) list = list.filter((j) => !j.genderRequirement || j.genderRequirement === c.genderFilter)
  if (c.ageFilter) list = list.filter((j) => !j.ageRequirement || j.ageRequirement === c.ageFilter)
  if (c.pledgeOnly) list = list.filter((j) => !!j.laborContractPledge || !!j.socialInsurancePledge)
  if (c.selectedDays.size > 0) {
    list = list.filter((j) => {
      const days = parseWorkDays(j.workDays)
      return [...c.selectedDays].some((d) => days.has(d))
    })
  }
  if (c.selectedDayCounts.size > 0) {
    list = list.filter((j) => c.selectedDayCounts.has(parseWorkDays(j.workDays).size))
  }
  if (c.excludeUnspecifiedDays) list = list.filter((j) => parseWorkDays(j.workDays).size > 0)
  if (c.excludeUnspecifiedHours) list = list.filter((j) => parseWorkHourBuckets(j.hours).size > 0)
  if (c.selectedTimeBuckets.size > 0) {
    list = list.filter((j) => {
      const buckets = parseWorkHourBuckets(j.hours)
      return [...c.selectedTimeBuckets].some((b) => buckets.has(b))
    })
  }
  if (c.includeKeywords.length > 0) {
    list = list.filter((j) => {
      const text = normalizeViText(`${j.title} ${j.description}`)
      return c.includeKeywords.every((k) => text.includes(normalizeViText(k)))
    })
  }
  if (c.excludeKeywords.length > 0) {
    list = list.filter((j) => {
      const text = normalizeViText(`${j.title} ${j.description}`)
      return !c.excludeKeywords.some((k) => text.includes(normalizeViText(k)))
    })
  }
  return list
}

export type JobListSortMode = 'newest' | 'deadline'

export function sortJobsForList(filtered: Job[], sortMode: JobListSortMode): Job[] {
  const list = [...filtered]
  if (sortMode === 'deadline') {
    // 마감일 없는(상시 모집) 공고는 급하지 않다고 보고 뒤로 보낸다.
    list.sort((a, b) => {
      if (!a.applicationDeadline && !b.applicationDeadline) return 0
      if (!a.applicationDeadline) return 1
      if (!b.applicationDeadline) return -1
      return a.applicationDeadline.localeCompare(b.applicationDeadline)
    })
  } else {
    list.sort((a, b) => b.postedAt.localeCompare(a.postedAt))
  }
  return list
}
