import type { SupabaseClient } from '@supabase/supabase-js'
import { isPublicJobAllowed } from './jobQualityFilter'
import { ensureJobFields } from './jobUtils'
import { rowToJob, rowToWorkLocation } from './jobRows'
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

const DEMO_JOBS = [
  { id: 'demo-1', title: '★ Nhân viên pha chế — thu nhập ổn định', company: 'Highlands Coffee', category: 'cafe', salary: '25.000đ/giờ', location: 'TP. Hồ Chí Minh', hours: '08:00–17:00', urgent: true, description: '', employerPhone: '', applicationDeadline: '2026-07-15', postedAt: '2026-06-25' },
  { id: 'demo-2', title: 'Tài xế giao hàng — làm theo ca linh hoạt', company: 'GrabFood', category: 'delivery', salary: '6.000.000đ/tháng', location: 'Hà Nội', hours: 'Ca linh hoạt', urgent: false, description: '', employerPhone: '', applicationDeadline: '2026-07-20', postedAt: '2026-06-24' },
  { id: 'demo-3', title: 'Nhân viên bán hàng cửa hàng tiện lợi', company: 'Circle K', category: 'retail', salary: '28.000đ/giờ', location: 'Đà Nẵng', hours: '14:00–22:00', urgent: false, description: '', employerPhone: '', applicationDeadline: '2026-07-10', postedAt: '2026-06-24' },
  { id: 'demo-4', title: '★ Tuyển gấp công nhân đóng gói', company: 'Coupang Logistics', category: 'factory', salary: '8.500.000đ/tháng', location: 'Bình Dương', hours: '07:00–16:00', urgent: true, description: '', employerPhone: '', applicationDeadline: '2026-07-05', postedAt: '2026-06-23' },
  { id: 'demo-5', title: 'Nhân viên vệ sinh văn phòng', company: 'Clean Pro', category: 'cleaning', salary: '5.000.000đ/tháng', location: 'TP. Hồ Chí Minh', hours: '06:00–14:00', urgent: false, description: '', employerPhone: '', applicationDeadline: '2026-07-18', postedAt: '2026-06-23' },
  { id: 'demo-6', title: 'Barista full-time — có đào tạo', company: 'Starbucks', category: 'cafe', salary: '30.000đ/giờ', location: 'Hà Nội', hours: '09:00–18:00', urgent: false, description: '', employerPhone: '', applicationDeadline: '2026-07-25', postedAt: '2026-06-22' },
  { id: 'demo-7', title: '★ Nhân viên kho Shopee — thưởng chuyên cần', company: 'Shopee', category: 'factory', salary: '7.500.000đ/tháng', location: 'Đồng Nai', hours: 'Ca 3 ca', urgent: true, description: '', employerPhone: '', applicationDeadline: '2026-07-08', postedAt: '2026-06-22' },
  { id: 'demo-8', title: 'Nhân viên thu ngân siêu thị', company: 'WinMart', category: 'retail', salary: '26.000đ/giờ', location: 'Cần Thơ', hours: '08:00–20:00', urgent: false, description: '', employerPhone: '', applicationDeadline: '2026-07-12', postedAt: '2026-06-21' },
  { id: 'demo-9', title: 'Shipper nội thành — xe máy', company: 'Baemin', category: 'delivery', salary: '200.000đ/ngày', location: 'TP. Hồ Chí Minh', hours: '10:00–21:00', urgent: false, description: '', employerPhone: '', applicationDeadline: '2026-07-30', postedAt: '2026-06-21' },
  { id: 'demo-10', title: '★ Nhân viên phục vụ — KFC Lê Văn Sỹ', company: 'KFC', category: 'cafe', salary: '24.000đ/giờ', location: 'TP. Hồ Chí Minh', hours: 'Ca linh hoạt', urgent: true, description: '', employerPhone: '', applicationDeadline: '2026-07-06', postedAt: '2026-06-20' },
].map(j => ensureJobFields(j as unknown as Job))

export async function fetchJobsData(client: SupabaseClient): Promise<FetchJobsResult> {
  const PAGE_SIZE = 1000
  const rows: Record<string, unknown>[] = []
  let fetchFailed = false
  for (let page = 0; page < 20; page++) {
    const from = page * PAGE_SIZE
    const { data, error } = await client
      .from('local_jobs')
      .select('id,title,company,category,subcategory,salary,location,hours,employer_phone,employer_id,application_deadline,urgent,description,posted_at,lat,lng,active,created_at,image_url,source,work_period,job_duration,gender_requirement,age_requirement,work_days,education,preference,num_hires,company_verified,company_founded_year,hire_count,labor_contract_pledge,social_insurance_pledge,images,source_url,recruitment_regions')
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
      .select('id,job_id,raw_address,normalized_address,lat,lng,sort_order,address_accuracy,coordinate_accuracy,location_verified,matched_recruitment_regions,geocode_status,resolved_province,resolved_wards')
      .in('job_id', jobIds)
      .order('sort_order', { ascending: true })
    for (const r of locRows ?? []) {
      const jobId = r.job_id as number
      const list = locationsByJobId.get(jobId) ?? []
      list.push(rowToWorkLocation(r))
      locationsByJobId.set(jobId, list)
    }
  }

  const fetched = rows
    .map((r) => rowToJob(r, locationsByJobId.get(r.id as number)))
    .filter(isPublicJobAllowed)

  return {
    jobsError: fetchFailed,
    jobs: fetchFailed ? [] : fetched.length > 0 ? fetched : DEMO_JOBS,
  }
}
