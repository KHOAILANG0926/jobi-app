import type { SupabaseClient } from '@supabase/supabase-js'
import { isPublicJobAllowed } from './jobQualityFilter'
import { applyLocationApprovals, rowToJob, rowToWorkLocation } from './jobRows'
import type { Job } from '../types/job'

/** 2026-09-22 JobsContext.tsx의 fetchJobs() 본문을 그대로 뽑아낸 것 — React
 *  상태(useState/useCallback)에 안 묶여 있어 브라우저(JobsContext)와 서버
 *  (SSR entry, api/ssr.js) 양쪽에서 그대로 재사용 가능하다. 로직 자체는
 *  1바이트도 안 바꿈(같은 페이지네이션·중복 제거·에러 구분 그대로) — SSR과
 *  클라이언트가 서로 다른 로직으로 "같은 URL인데 다른 결과"가 나오는 걸
 *  막기 위해 반드시 하나의 함수를 공유해야 한다. */
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
  for (let page = 0; page < 20; page++) {
    const from = page * PAGE_SIZE
    const { data, error } = await client
      .from('local_jobs')
      .select('id,title,company,category,subcategory,salary,location,hours,employer_phone,employer_id,application_deadline,urgent,description,posted_at,lat,lng,active,created_at,image_url,source,work_period,job_duration,gender_requirement,age_requirement,work_days,education,preference,num_hires,company_verified,company_founded_year,hire_count,labor_contract_pledge,social_insurance_pledge,images,recruitment_regions,shift_type,shuttle_bus,dormitory,meal_provided,immediate_start,recruitment_type,work_schedule,weekend_work,salary_basis,salary_note,employment_type,rotating_shifts,benefit_tags,required_documents,contact_zalo,salary_period,language_requirement,business_trip')
      .eq('active', true)
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

  const locationsByJobId = new Map<number, NonNullable<Job['workLocations']>>()
  if (rows.length > 0) {
    const jobIds = rows.map((r) => r.id as number)
    const { data: locRows } = await client
      .from('job_work_locations')
      .select('id,job_id,raw_address,normalized_address,lat,lng,sort_order,address_accuracy,coordinate_accuracy,location_verified,matched_recruitment_regions,geocode_status,resolved_province,resolved_wards,industrial_park,shuttle_route')
      .in('job_id', jobIds)
      .order('sort_order', { ascending: true })
    for (const r of locRows ?? []) {
      const jobId = r.job_id as number
      const list = locationsByJobId.get(jobId) ?? []
      list.push(rowToWorkLocation(r))
      locationsByJobId.set(jobId, list)
    }
  }

  // 사람이 승인한 근무지(2026-09-29) — 부가 정보라 조회 실패 시 승인 없이 진행(best-effort)
  let approvals: Record<string, unknown>[] = []
  if (rows.length > 0) {
    const { data: approvalRows } = await client
      .from('job_location_candidates')
      .select('job_id,company_snapshot,address_snapshot,lat,lng,place_precision')
      .eq('status', 'approved')
      .in('job_id', rows.map((r) => r.id as number))
    approvals = (approvalRows ?? []) as Record<string, unknown>[]
  }

  const fetched = applyLocationApprovals(
    rows.map((r) => rowToJob(r, locationsByJobId.get(r.id as number))),
    approvals,
  ).filter(isPublicJobAllowed)

  return {
    jobsError: fetchFailed,
    jobs: fetchFailed ? [] : fetched,
  }
}
