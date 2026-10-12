import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchJobsData } from './fetchJobsData.ts'
for (const role of ['anonymous', 'employer-owner', 'admin']) {
  const filters: [string, unknown][] = []
  const rows = [
    { id: 1, active: true, admin_hidden: false },
    { id: 2, active: true, admin_hidden: true },
    { id: 3, active: false, admin_hidden: false },
  ].map(row => ({ ...row, title: 'Nhân viên QC', company: 'Synthetic',
    description: 'Kiểm tra chất lượng sản phẩm.', category: 'san_xuat_xay_dung',
    salary: '25 triệu VND', posted_at: '2026-10-11', location: '', hours: '' }))
  const client = { from: (table: string) => {
    const localFilters: [string, unknown][] = []
    const chain = {
      select: () => chain, order: () => chain, range: () => chain, in: () => chain,
      eq: (field: string, value: unknown) => {
        localFilters.push([field, value])
        if (table === 'local_jobs') filters.push([field, value])
        return chain
      },
      then: (resolve: (value: unknown) => unknown) => resolve({
        data: table === 'local_jobs' ? rows.filter(row => localFilters.every(
          ([field, value]) => (row as unknown as Record<string, unknown>)[field] === value)) : [],
        error: null,
      }),
    }
    return chain
  } } as unknown as SupabaseClient
  // RLS may return owner/admin hidden rows; public query must constrain them.
  const result = await fetchJobsData(client)
  if (result.jobsError || result.jobs.length !== 1 || result.jobs[0].id !== 'sb-1')
    throw new Error(role + ': hidden/inactive public contamination')
  if (!filters.some(([field, value]) => field === 'admin_hidden' && value === false))
    throw new Error(role + ': missing explicit hidden filter')
}
console.log('public exposure: anonymous/owner/admin query filters passed (mock clients)')
