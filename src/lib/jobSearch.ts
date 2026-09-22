import { jobMatchesRegion, type JobRegionId } from '../data/jobRegions'
import { normalizeViText } from './jobCoords'
import { groupJobsForSalarySort } from './recommendStorage'
import type { Job, JobCategory } from '../types/job'

/** Home.tsx의 `filtered` useMemo 본문을 그대로 뽑아낸 순수 함수 — 로직
 *  자체는 안 바꿈(Home.tsx가 실제로 쓰지 않는 죽은 상태인 recFilter/
 *  deadlineFilter만 제외했는데, 둘 다 Home.tsx에서 setter가 한 번도
 *  호출되지 않아 항상 초기값(null/'all')이라 원래도 아무 필터링도 안
 *  하고 있었다 — 동작 변화 없음). Home.tsx와 새 공개 검색 페이지
 *  (JobSearchPage.tsx, SSR 대상)가 이 함수 하나를 공유해 서버/클라이언트가
 *  같은 URL에 다른 결과를 내는 일을 막는다. */

export interface JobSearchParams {
  search: string
  category: JobCategory | 'all'
  subcategory: string
  urgentOnly: boolean
  todayOnly: boolean
  selectedCity: JobRegionId | null
  brandFilter: string | null
  sortMode: 'none' | 'salary' | 'recommended'
}

export const DEFAULT_JOB_SEARCH_PARAMS: JobSearchParams = {
  search: '',
  category: 'all',
  subcategory: '',
  urgentOnly: false,
  todayOnly: false,
  selectedCity: null,
  brandFilter: null,
  sortMode: 'none',
}

// "Làm hôm nay" — no dedicated DB field for immediate-start/day-work postings,
// so approximate via Vietnamese phrasing commonly used for these listings.
const TODAY_KEYWORDS = ['lam ngay', 'di lam ngay', 'nhan viec ngay', 'viec lam ngay', 'ngay hom nay', 'nhan lam ngay']
export function isTodayJob(j: Job): boolean {
  const text = normalizeViText(`${j.title} ${j.description ?? ''} ${j.hours ?? ''} ${j.workPeriod ?? ''}`)
  return TODAY_KEYWORDS.some((kw) => text.includes(kw))
}

/** "Gợi ý cho bạn" 정렬의 개인화 신호 — 저장/지원한 공고의 카테고리
 *  빈도. 로그인 정보가 없는 익명 요청(SSR 포함)은 빈 Map을 넘기면 되고,
 *  그러면 Home.tsx의 기존 "로그인 사용자 이력 없음" 폴백과 동일하게
 *  hireCount 내림차순으로만 정렬된다(별도 분기 불필요, 원래 로직 그대로). */
export function computePreferredCategories(jobs: Job[], savedIds: Set<string>, appliedIds: Set<string>): Map<JobCategory, number> {
  const cats = new Map<JobCategory, number>()
  for (const j of jobs) {
    if (savedIds.has(j.id) || appliedIds.has(j.id)) {
      cats.set(j.category, (cats.get(j.category) ?? 0) + 1)
    }
  }
  return cats
}

/** JobSearchPage.tsx가 URL과 동기화하는 파라미터명을 그대로 읽는다
 *  (?q=/?cat=/?sub=/?region=/?brand=/?urgent=/?today=/?sort=) — 이 함수
 *  하나를 SSR(api/ssr.js가 대표 페이지/빈 결과 판정에 씀)과 클라이언트가
 *  같이 참조하므로 어긋날 일이 없다. */
export function parseJobSearchParamsFromQueryString(search: string): JobSearchParams {
  const p = new URLSearchParams(search)
  const sort = p.get('sort')
  return {
    search: p.get('q') ?? '',
    category: (p.get('cat') as JobCategory | null) ?? 'all',
    subcategory: p.get('sub') ?? '',
    urgentOnly: p.get('urgent') === '1',
    todayOnly: p.get('today') === '1',
    selectedCity: (p.get('region') as JobRegionId | null) ?? null,
    brandFilter: p.get('brand') ?? null,
    sortMode: sort === 'salary' || sort === 'recommended' ? sort : 'none',
  }
}

export function filterAndSortJobs(jobs: Job[], params: JobSearchParams, preferredCategories: Map<JobCategory, number>): Job[] {
  const q = normalizeViText(params.search)
  let result = jobs.filter((j) => {
    if (params.category !== 'all') {
      if (j.category !== params.category) return false
      if (params.subcategory && j.subcategory !== params.subcategory) return false
    }
    if (params.urgentOnly && !j.urgent) return false
    if (params.todayOnly && !isTodayJob(j)) return false
    if (params.selectedCity && !jobMatchesRegion(j.location, params.selectedCity, j.workLocations)) return false
    if (params.brandFilter) {
      const nb = normalizeViText(params.brandFilter)
      const matches = normalizeViText(j.company).includes(nb) || normalizeViText(j.title).includes(nb)
      if (!matches) return false
    }
    if (q && !normalizeViText(`${j.title} ${j.company} ${j.location}`).includes(q)) return false
    return true
  })
  if (params.sortMode === 'salary') {
    const { groups, unpriced } = groupJobsForSalarySort(result)
    result = [...groups.flatMap((g) => g.jobs), ...unpriced]
  } else if (params.sortMode === 'recommended') {
    result = [...result].sort((a, b) => {
      const aMatch = preferredCategories.has(a.category) ? 1 : 0
      const bMatch = preferredCategories.has(b.category) ? 1 : 0
      if (aMatch !== bMatch) return bMatch - aMatch
      return (b.hireCount ?? 0) - (a.hireCount ?? 0)
    })
  }
  return result
}
