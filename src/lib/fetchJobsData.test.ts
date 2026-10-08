import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchJobsData } from './fetchJobsData.ts'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

function fakeClient(result: { data: unknown[] | null; error: unknown }): SupabaseClient {
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'order', 'range', 'in']) chain[m] = () => chain
  chain.then = (resolve: (v: unknown) => unknown) => resolve(result)
  return { from: () => chain } as unknown as SupabaseClient
}

const empty = await fetchJobsData(fakeClient({ data: [], error: null }))
assert(empty.jobs.length === 0 && !empty.jobsError, '공개 공고 0건이면 jobs는 빈 배열 — 예시·가짜 공고로 채우지 않는다')
assert(!JSON.stringify(empty.jobs).includes('demo-'), 'no demo-* jobs')

const failed = await fetchJobsData(fakeClient({ data: null, error: { message: 'boom' } }))
assert(failed.jobs.length === 0 && failed.jobsError, '조회 실패는 0건과 구분(jobsError=true)')

console.log('fetchJobsData tests: all assertions passed')
