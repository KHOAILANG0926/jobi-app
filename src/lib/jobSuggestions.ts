import { CATEGORY_LABELS } from '../data/categories'
import { jobMatchesRegion, type JobRegionId } from '../data/jobRegions'
import type { Job, JobCategory } from '../types/job'

/** 추천 공고("Gợi ý") 판정 — pages/jobsMenu/SuggestedJobsPage.tsx의 `hasSignal`·`suggestions` 본문을 그대로 뽑아낸 순수 함수.
 *  사용자의 실제 활동(저장·지원한 공고의 업종)과 맞춤 조건에서 이미 설정한 지역만 근거로 쓰고, 급여 추정이나 확인되지 않은 조건으로
 *  "일치"를 만들지 않는다. 활동/선호가 전혀 없으면 빈 목록(일반 목록으로 대신하지 않음). 웹·앱이 한 함수를 쓴다. */
export interface JobSuggestion { job: Job; reasons: string[]; weight: number }

/** 관심 업종 = 저장했거나 지원한 공고들의 category 빈도수 */
export function preferredCategoryCounts(savedJobs: readonly Job[], appliedJobs: readonly Job[]): Map<JobCategory, number> {
  const counts = new Map<JobCategory, number>()
  for (const j of [...savedJobs, ...appliedJobs]) counts.set(j.category, (counts.get(j.category) ?? 0) + 1)
  return counts
}

export function hasSuggestionSignal(preferred: ReadonlyMap<JobCategory, number>, regionId: JobRegionId | undefined | null): boolean {
  return preferred.size > 0 || !!regionId
}

export function suggestJobs(input: {
  jobs: Job[]
  savedJobs: readonly Job[]
  appliedJobs: readonly Job[]
  /** 맞춤 조건에서 이미 설정한 지역(없으면 undefined) */
  regionId?: JobRegionId | null
  regionLabel?: string
}): JobSuggestion[] {
  const { jobs, savedJobs, appliedJobs, regionId, regionLabel } = input
  const preferredCategories = preferredCategoryCounts(savedJobs, appliedJobs)
  if (!hasSuggestionSignal(preferredCategories, regionId)) return []
  // 지역 조건이 맞춤 공고에서 이미 설정돼 있으면 그 지역 밖 공고는 아예 제외한다(다른 근거 점수가 높다는 이유로 지역 밖 공고를 섞지 않음).
  let candidates = regionId
    ? jobs.filter((j) => jobMatchesRegion(j.location, regionId, j.workLocations))
    : jobs
  const savedOrAppliedIds = new Set([...savedJobs, ...appliedJobs].map((j) => j.id))
  candidates = candidates.filter((j) => !savedOrAppliedIds.has(j.id))

  const withReasons = candidates.map((job) => {
    const reasons: string[] = []
    let weight = 0
    const catCount = preferredCategories.get(job.category)
    if (catCount) {
      reasons.push(`Ngành quan tâm: ${CATEGORY_LABELS[job.category]}`)
      weight += catCount
    }
    if (regionId && regionLabel) {
      reasons.push(`Trong khu vực bạn đã chọn ở Việc làm phù hợp: ${regionLabel}`)
      weight += 1
    }
    return { job, reasons, weight }
  }).filter((r) => r.reasons.length > 0)

  return withReasons.sort((a, b) => b.weight - a.weight || (b.job.hireCount ?? 0) - (a.job.hireCount ?? 0))
}
