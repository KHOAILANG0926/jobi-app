/**
 * Standalone regression tests for jobRows.ts — plain assertions, no test
 * framework (none is set up in this project). Run directly with Node's native
 * TypeScript support: `node src/lib/jobRows.test.ts`.
 */
import { fetchEmployerJobs, rowToJob, type JobsQueryBuilder, type JobsQueryClient } from './jobRows.ts'

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

function assertTrue(value: unknown, label: string): void {
  if (!value) throw new Error(label)
}

interface FakeCall {
  table: string
  method: string
  args: unknown[]
}

/** local_jobs + job_work_locations 두 테이블만 아는 가짜 Supabase 클라이언트 —
 * 실제 호출 체인(.from().select().eq()/.in().order()...)을 기록하고, 미리
 * 넣어둔 행 중 필터를 통과하는 것만 돌려준다. .eq('active', ...) 호출이
 * 실제로 있었는지까지 기록해, "공개 필터를 걸지 않는다"를 직접 검증한다. */
function makeFakeClient(tables: Record<string, Record<string, unknown>[]>): {
  client: JobsQueryClient
  calls: FakeCall[]
} {
  const calls: FakeCall[] = []
  function builder(table: string, rows: Record<string, unknown>[]): JobsQueryBuilder {
    return {
      select(columns: string) {
        calls.push({ table, method: 'select', args: [columns] })
        return builder(table, rows)
      },
      eq(column: string, value: unknown) {
        calls.push({ table, method: 'eq', args: [column, value] })
        return builder(table, rows.filter((r) => r[column] === value))
      },
      in(column: string, values: unknown[]) {
        calls.push({ table, method: 'in', args: [column, values] })
        return builder(table, rows.filter((r) => values.includes(r[column])))
      },
      order(column: string, opts?: { ascending?: boolean }) {
        calls.push({ table, method: 'order', args: [column, opts] })
        return builder(table, rows)
      },
      then(resolve) {
        return Promise.resolve(resolve({ data: rows, error: null }))
      },
    }
  }
  return {
    calls,
    client: {
      from(table: string) {
        calls.push({ table, method: 'from', args: [] })
        return builder(table, tables[table] ?? [])
      },
    },
  }
}

async function testFetchEmployerJobsNeverFiltersOnActive(): Promise<void> {
  // 이 테스트가 지키는 핵심 요구사항(2026-09-04 사용자 지시 1번): "공개 공고
  // 목록을 가져온 뒤 필터링하는 구조를 제거하고, employer_id=auth.uid() 공고를
  // 별도로 조회". 이 함수는 .eq('active', ...)를 절대 호출하면 안 된다 — 그걸
  // 호출하는 순간 비공개 공고가 다시 안 보이게 된다.
  const { client, calls } = makeFakeClient({
    local_jobs: [
      { id: 1, employer_id: 'emp-1', active: true, admin_hidden: false, title: 'Public', company: 'C', posted_at: '2026-01-01', description: '' },
      { id: 2, employer_id: 'emp-1', active: false, admin_hidden: false, title: 'Pending', company: 'C', posted_at: '2026-01-02', description: '' },
      { id: 3, employer_id: 'emp-1', active: false, admin_hidden: true, title: 'AdminHidden', company: 'C', posted_at: '2026-01-03', description: '' },
    ],
    job_work_locations: [],
  })
  await fetchEmployerJobs('emp-1', client)

  const localJobsCalls = calls.filter((c) => c.table === 'local_jobs')
  const activeFilterCalls = localJobsCalls.filter((c) => c.method === 'eq' && c.args[0] === 'active')
  assertEqual(activeFilterCalls.length, 0, 'fetchEmployerJobs must never filter on active — that is exactly the public-list-then-filter bug being removed')

  const employerFilterCalls = localJobsCalls.filter((c) => c.method === 'eq' && c.args[0] === 'employer_id')
  assertEqual(employerFilterCalls.length, 1, 'must filter by employer_id exactly once')
  assertEqual(employerFilterCalls[0].args[1], 'emp-1', 'must filter by the actual employer id passed in')
}

async function testFetchEmployerJobsReturnsInactiveAndAdminHiddenJobs(): Promise<void> {
  // 사용자 지시 4번: "기업은 본인의 공개·비공개·관리자 숨김 공고를 볼 수 있고".
  const { client } = makeFakeClient({
    local_jobs: [
      { id: 1, employer_id: 'emp-1', active: true, admin_hidden: false, title: 'Public', company: 'C', posted_at: '2026-01-01', description: '' },
      { id: 2, employer_id: 'emp-1', active: false, admin_hidden: false, title: 'Pending', company: 'C', posted_at: '2026-01-02', description: '' },
      { id: 3, employer_id: 'emp-1', active: false, admin_hidden: true, title: 'AdminHidden', company: 'C', posted_at: '2026-01-03', description: '' },
      { id: 4, employer_id: 'someone-else', active: true, admin_hidden: false, title: 'NotMine', company: 'C', posted_at: '2026-01-04', description: '' },
    ],
    job_work_locations: [],
  })
  const jobs = await fetchEmployerJobs('emp-1', client)
  const ids = jobs.map((j) => j.id).sort()
  assertEqual(ids.length, 3, 'must return exactly the 3 jobs owned by emp-1 (public + pending + admin-hidden), never the other employer\'s job')
  assertTrue(ids.includes('sb-1') && ids.includes('sb-2') && ids.includes('sb-3'), 'must include public, inactive, and admin-hidden jobs alike')
  assertTrue(!ids.includes('sb-4'), "must never include another employer's job")

  const pending = jobs.find((j) => j.id === 'sb-2')!
  assertEqual(pending.active, false, 'Job.active must reflect the real DB value, not be silently coerced to true')
  const hidden = jobs.find((j) => j.id === 'sb-3')!
  assertEqual(hidden.adminHidden, true, 'Job.adminHidden must reflect the real DB value')
}

async function testFetchEmployerJobsEmptyForNoEmployerId(): Promise<void> {
  const { client, calls } = makeFakeClient({ local_jobs: [{ id: 1, employer_id: 'emp-1' }], job_work_locations: [] })
  const jobs = await fetchEmployerJobs('', client)
  assertEqual(jobs.length, 0, 'empty employerId must return no jobs')
  assertEqual(calls.length, 0, 'empty employerId should short-circuit without querying at all')
}

async function testFetchEmployerJobsAttachesWorkLocations(): Promise<void> {
  const { client } = makeFakeClient({
    local_jobs: [{ id: 1, employer_id: 'emp-1', active: true, admin_hidden: false, title: 'X', company: 'C', posted_at: '2026-01-01', description: '' }],
    job_work_locations: [
      { id: 10, job_id: 1, raw_address: '123 Main St', lat: 10.1, lng: 106.1, sort_order: 0, coordinate_accuracy: 'exact' },
    ],
  })
  const jobs = await fetchEmployerJobs('emp-1', client)
  assertEqual(jobs.length, 1, 'sanity: one job returned')
  assertEqual(jobs[0].workLocations?.length, 1, 'job_work_locations rows must be attached to the matching job')
  assertEqual(jobs[0].workLocations?.[0].rawAddress, '123 Main St', 'attached work location must carry the real raw_address')
}

async function testRowToJobMapsActiveAndAdminHidden(): Promise<void> {
  const job = rowToJob({ id: 5, title: 'T', company: 'C', active: false, admin_hidden: true, description: '' })
  assertEqual(job.active, false, 'rowToJob must map local_jobs.active -> Job.active')
  assertEqual(job.adminHidden, true, 'rowToJob must map local_jobs.admin_hidden -> Job.adminHidden')
}

async function main(): Promise<void> {
  const tests = [
    testFetchEmployerJobsNeverFiltersOnActive,
    testFetchEmployerJobsReturnsInactiveAndAdminHiddenJobs,
    testFetchEmployerJobsEmptyForNoEmployerId,
    testFetchEmployerJobsAttachesWorkLocations,
    testRowToJobMapsActiveAndAdminHidden,
  ]
  for (const test of tests) {
    await test()
    console.log(`✅ ${test.name}`)
  }
  console.log(`\n결과: ${tests.length}/${tests.length} jobRows tests passed`)
}

main()
