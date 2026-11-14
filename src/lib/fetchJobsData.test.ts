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

// The public/source reads must consume every page and never query candidate overlays.
const requests: {table:string;from:number;to:number;ids:number[]}[] = []
const sourceRows = Array.from({length:1001}, (_,i)=>({id:i+1,job_id:1,raw_address:'Source',point_kind:'area',lat:21,lng:106,sort_order:i}))
function paginatedClient(failLocations = false): SupabaseClient {
  return { from(table:string) {
    let start=0,end=999,ids:number[]=[]
    const chain = {select(){return chain},eq(){return chain},order(){return chain},in(_key:string,value:number[]){ids=value;return chain},range(from:number,to:number){start=from;end=to;return chain},then(resolve:(v:unknown)=>unknown){
      requests.push({table,from:start,to:end,ids})
      if(table==='job_location_candidates') throw new Error('candidate overlay is forbidden')
      if(table==='job_work_locations') return resolve({data: failLocations?null:sourceRows.slice(start,end+1),error:failLocations?{message:'source failed'}:null})
      return resolve({data:start===0?[{id:1,title:'Fixture',company:'Source',location:'Source',description:''}]:[],error:null})
    }}
    return chain
  }} as unknown as SupabaseClient
}
await fetchJobsData(paginatedClient())
assert(requests.filter(r=>r.table==='job_work_locations').length===2,'source point pagination passes Supabase 1000-row cap')
assert(requests.filter(r=>r.table==='job_work_locations').every(r=>r.ids.length<=100),'job ID batches stay bounded')
const sourceFailed = await fetchJobsData(paginatedClient(true))
assert(sourceFailed.jobsError && sourceFailed.jobs.length===0,'source read error fails closed rather than showing missing pins')
console.log('fetchJobsData: canonical pagination, bounded batches, no overlays, source failure checks passed')

// 마감 지난 공고는 공개 조회에서 뺀다(상시·마감 당일은 포함). 마감 크론은 하루 한 번이라 그 사이를 이 기준이 메운다.
function deadlineClient(): SupabaseClient {
  const row = (id: number, application_deadline: string | null) => ({ id, title: `T${id}`, company: 'C', location: 'L', description: '', application_deadline })
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
  return { from(table: string) {
    let start = 0
    const chain = { select() { return chain }, eq() { return chain }, order() { return chain }, in() { return chain }, range(from: number) { start = from; return chain },
      then(resolve: (v: unknown) => unknown) {
        if (table === 'job_work_locations') return resolve({ data: [], error: null })
        return resolve({ data: start === 0 ? [row(1, null), row(2, '2000-01-01'), row(3, today)] : [], error: null })
      } }
    return chain
  } } as unknown as SupabaseClient
}
const dl = await fetchJobsData(deadlineClient())
assert(dl.jobs.map((j) => j.id).sort().join(',') === 'sb-1,sb-3', 'expired deadline is excluded; no-deadline and deadline-today stay public')
console.log('fetchJobsData: expired deadline exclusion passed')
