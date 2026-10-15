// 공식 직업분류(QĐ 34/2020/QĐ-TTg) 그룹 판정 — 순수 함수(DB·React 의존 없음). 2026-10-15 사용자 결정:
// 구직자 필터는 공식 2단계(Cấp 2) 그룹, 그중 실제 공고가 있는 그룹만 보여준다.
import type { Job } from '../types/job'

/** 4·5단계 코드 → 2단계 그룹 코드. 공식 코드는 길이 = 단계이고 하위 코드는 상위 코드로 시작한다. */
export function occupationGroupCode(code: string | undefined | null): string | undefined {
  return code && /^\d{2,5}$/.test(code) ? code.slice(0, 2) : undefined
}

export interface OccupationGroupCount { code: string; count: number }

/** 공고에 실제로 있는 2단계 그룹과 공고 수(많은 순, 같으면 코드 순). 미분류 공고는 세지 않는다. */
export function occupationGroupsInJobs(jobs: Pick<Job, 'occupationCode'>[]): OccupationGroupCount[] {
  const counts = new Map<string, number>()
  for (const job of jobs) {
    const group = occupationGroupCode(job.occupationCode)
    if (group) counts.set(group, (counts.get(group) ?? 0) + 1)
  }
  return [...counts].map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
}

export function matchesOccupationGroups(job: Pick<Job, 'occupationCode'>, groups: string[]): boolean {
  if (groups.length === 0) return true
  const group = occupationGroupCode(job.occupationCode)
  return group !== undefined && groups.includes(group)
}
