import type { SupabaseClient } from '@supabase/supabase-js'
import { isPublicJobAllowed } from './jobQualityFilter'
import { fetchCanonicalLocations, rowToJob, type JobsQueryClient } from './jobRows'
import type { Job } from '../types/job'

/** Browser and SSR share paginated public jobs and the complete canonical location set.
 * Source read failures are distinct from an empty public list. */
export interface FetchJobsResult {
  jobs: Job[]
  /** DB 조회 실패(네트워크/쿼리 오류) — true면 jobs는 항상 []. 진짜
   *  "0건"과 반드시 구분해서 써야 한다(0건인데 이 값이 true인 척하거나
   *  그 반대로 취급하면 안 됨). */
  jobsError: boolean
}

export async function fetchJobsData(client: SupabaseClient): Promise<FetchJobsResult> {
  const PAGE_SIZE = 1000
  const rows: Record<string, unknown>[] = []
  let fetchFailed = false
  for (let page = 0; ; page++) {
    const from = page * PAGE_SIZE
    const { data, error } = await client
      .from('local_jobs')
      .select('id,title,company,category,subcategory,occupation_code,occupation_evidence,salary,location,hours,employer_phone,employer_id,application_deadline,urgent,description,posted_at,lat,lng,active,created_at,image_url,source,work_period,job_duration,gender_requirement,age_requirement,work_days,education,preference,num_hires,company_verified,company_founded_year,hire_count,labor_contract_pledge,social_insurance_pledge,images,recruitment_regions,shift_type,shuttle_bus,dormitory,meal_provided,immediate_start,recruitment_type,work_schedule,weekend_work,salary_basis,salary_note,employment_type,rotating_shifts,benefit_tags,required_documents,contact_zalo,salary_period,language_requirement,business_trip')
      .eq('active', true)
      .eq('admin_hidden', false)
      .order('posted_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
    if (error) {
      console.error('fetchJobsData: local_jobs query failed', error)
      fetchFailed = true
      break
    }
    const pageRows = data ?? []
    rows.push(...pageRows)
    if (pageRows.length < PAGE_SIZE) break
  }
  const seenIds = new Set<unknown>()
  const dedupedRows = rows.filter((r) => {
    if (seenIds.has(r.id)) return false
    seenIds.add(r.id)
    return true
  })
  rows.length = 0
  rows.push(...dedupedRows)

  let locationsByJobId: Map<number, NonNullable<Job['workLocations']>>
  try {
    locationsByJobId = await fetchCanonicalLocations(rows.map(r => r.id as number), client as unknown as JobsQueryClient)
  } catch (error) {
    console.error('fetchJobsData: canonical locations query failed', error)
    return { jobs: [], jobsError: true }
  }

  const fetched = rows.map((r) => rowToJob(r, locationsByJobId.get(r.id as number))).filter(isPublicJobAllowed)

  return {
    jobsError: fetchFailed,
    jobs: fetchFailed ? [] : fetched,
  }
}
