import assert from 'node:assert/strict'
import { mock } from 'node:test'
let row: unknown = { title: 'QC', description: 'Kiểm tra chất lượng' }
let failed = false
let writes = 0
const filters: unknown[][] = []
const client = {
  from() {
    const builder = {
      select() { return builder },
      eq(...args: unknown[]) { filters.push(args); return builder },
      order() { return builder },
      range() { return Promise.resolve({ data: [], error: failed ? {message:'offline'} : null }) },
      single() { return Promise.resolve({ data: row, error: failed ? {message:'offline'} : null }) },
    }
    return builder
  },
  async rpc() { writes++; return { error: null } },
}
mock.module('../src/lib/supabase.ts', { namedExports: { supabase: client } })
const { setJobHidden } = await import('../src/lib/adminOperations.ts')
const { fetchJobsData } = await import('../src/lib/fetchJobsData.ts')
for (const candidate of [
  {title:'Sales B2B',description:'Khách hàng doanh nghiệp'},
  {title:'Sales',description:'Thu nhập cao'},
  null,
]) {
  row = candidate
  await assert.rejects(() => setJobHidden(1, false))
}
assert.equal(writes, 0, 'excluded/ambiguous/missing republish must not call RPC')
row = {title:'QC',description:'Kiểm tra chất lượng'}
failed = true
await assert.rejects(() => setJobHidden(1, false))
assert.equal(writes, 0, 'read failure prevents publication')
failed = false
await setJobHidden(1, false)
assert.equal(writes, 1)
await fetchJobsData(client as never)
assert.ok(filters.some(([key,value]) => key === 'active' && value === true))
assert.ok(filters.some(([key,value]) => key === 'admin_hidden' && value === false))
failed = true
assert.deepEqual(await fetchJobsData(client as never), {jobs:[],jobsError:true})
console.log('policy republish and public query: isolated assertions passed')
