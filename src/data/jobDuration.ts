/** local_jobs.job_duration 값 7종 — 알바몬 "근무기간" 필터와 동일한 구간
 *  체계를 베트남어로 옮긴 것. PostJob.tsx(입력)와 UrgentJobsPage.tsx(필터)
 *  둘 다 이 목록을 공유한다 — 값 하나 늘리거나 문구를 바꿀 때 이 파일만
 *  고치면 된다. */
export const JOB_DURATION_OPTIONS = [
  'Một ngày',
  'Dưới 1 tuần',
  '1 tuần - 1 tháng',
  '1 - 3 tháng',
  '3 - 6 tháng',
  '6 tháng - 1 năm',
  'Trên 1 năm',
] as const

export type JobDuration = (typeof JOB_DURATION_OPTIONS)[number]
