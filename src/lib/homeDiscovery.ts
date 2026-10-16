/** Three real records per page; no repeated/filler cards when fewer are available. */
export function groupDiscoveryJobs<T extends { id: string }>(jobs: readonly T[]): T[][] {
  const unique = [...new Map(jobs.map(job => [job.id, job])).values()]
  const pages: T[][] = []
  for (let i = 0; i < unique.length; i += 3) pages.push(unique.slice(i, i + 3))
  return pages
}
