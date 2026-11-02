/** Real records per page (default 3); no repeated/filler cards when fewer are available.
 *  2026-11-02 Lee "알바몬 구성": 모바일 위쪽 밀기 칸은 한 면에 2열×3줄(6개). */
export function groupDiscoveryJobs<T extends { id: string }>(jobs: readonly T[], size = 3): T[][] {
  const unique = [...new Map(jobs.map(job => [job.id, job])).values()]
  const pages: T[][] = []
  for (let i = 0; i < unique.length; i += size) pages.push(unique.slice(i, i + size))
  return pages
}
