/** Job.id는 앱 전역에서 "sb-<local_jobs.id>" 문자열로 다뤄진다 (JobsContext.rowToJob 참고).
 *  applications/message_threads/interviews 테이블의 job_id는 local_jobs.id(bigint)를 직접
 *  참조하므로, 저장 계층 경계에서만 접두사를 떼고/붙인다. */
export function toDbJobId(appJobId: string): number {
  return Number(appJobId.replace(/^sb-/, ''))
}

export function toAppJobId(dbJobId: number | string): string {
  return `sb-${dbJobId}`
}
