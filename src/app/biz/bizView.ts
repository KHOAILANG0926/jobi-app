// 기업 화면 공통 계산(순수 함수, 시험 대상). 자료는 웹 기업 대시보드와 같은 lib(applicationsStorage·jobRows).
import type { ApplicationStatus, JobApplication } from '../../lib/applicationsStorage'

/** 내 공고에 들어온 지원만 남긴다(웹 대시보드와 같은 기준: 공고 번호가 내 공고 목록에 있는 지원). */
export function applicationsOfMyJobs(applications: JobApplication[], myJobIds: Iterable<string>): JobApplication[] {
  const ids = new Set(myJobIds)
  return applications.filter((a) => ids.has(a.jobId))
}

export function countByJob(applications: JobApplication[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const a of applications) counts[a.jobId] = (counts[a.jobId] ?? 0) + 1
  return counts
}

/** 검토 대기 = 제출됨 또는 검토 중 (웹 "Chờ xét duyệt"과 같은 기준). */
export function pendingApplications(applications: JobApplication[]): JobApplication[] {
  return applications.filter((a) => a.status === 'submitted' || a.status === 'reviewing')
}

/** 기업이 고를 수 있는 상태: 이미 '제출됨'인 지원도 다시 '제출됨'으로는 못 돌린다(웹 선택지와 같음). */
export const SELECTABLE_STATUSES: readonly ApplicationStatus[] = ['reviewing', 'interview', 'accepted', 'rejected']

export function filterByJob(applications: JobApplication[], jobId: string): JobApplication[] {
  return jobId === 'all' ? applications : applications.filter((a) => a.jobId === jobId)
}

export function recentApplications(applications: JobApplication[], limit: number): JobApplication[] {
  return [...applications].sort((a, b) => b.appliedAt.localeCompare(a.appliedAt)).slice(0, limit)
}
