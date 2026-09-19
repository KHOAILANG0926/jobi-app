/** local_jobs.age_requirement 값 5종 — 급구 페이지 "Điều kiện khác" 패널의
 *  Độ tuổi 필터와 동일한 구간 체계. PostJob.tsx(입력)와 UrgentJobsPage.tsx
 *  (필터) 둘 다 이 목록을 공유한다(job_duration과 같은 방식) — 값 하나
 *  늘리거나 문구를 바꿀 때 이 파일만 고치면 된다. */
export const AGE_REQUIREMENT_OPTIONS = [
  '18 - 24 tuổi',
  '25 - 34 tuổi',
  '35 - 44 tuổi',
  '45 - 54 tuổi',
  'Trên 55 tuổi',
] as const

export type AgeRequirement = (typeof AGE_REQUIREMENT_OPTIONS)[number]

/** local_jobs.gender_requirement 값 2종. */
export const GENDER_REQUIREMENT_OPTIONS = ['Nam', 'Nữ'] as const

export type GenderRequirement = (typeof GENDER_REQUIREMENT_OPTIONS)[number]
