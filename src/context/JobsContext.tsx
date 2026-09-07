import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { isPublicJobAllowed } from '../lib/jobQualityFilter'
import { ensureJobFields } from '../lib/jobUtils'
import { rowToJob, rowToWorkLocation } from '../lib/jobRows'
import { supabase } from '../lib/supabase'
import type { Job } from '../types/job'

interface JobsContextValue {
  jobs: Job[]
  loading: boolean
  refreshJobs: () => Promise<void>
  addPostedJob: (job: Omit<Job, 'id' | 'postedAt'>) => Promise<Job>
  deleteJob: (id: string) => Promise<void>
  updateJob: (id: string, patch: Partial<Job>) => Promise<void>
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

const JobsContext = createContext<JobsContextValue | null>(null)

export function JobsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

  const fetchJobs = useCallback(async () => {
    setLoading(true)
    // PostgREST caps a single response at 1000 rows by default. Active job count
    // has already exceeded that (1031+), which was silently dropping the oldest
    // listings from the public site — page through with .range() until a page
    // comes back short. The 20-page cap (20,000 rows) is just a runaway-loop
    // guard, not an expected ceiling.
    // `order('posted_at')` alone is not a stable sort: many rows share the exact
    // same posted_at (a whole day's crawl batch), so within a tie group Postgres
    // is free to return rows in a different order on each separate paginated
    // query — the same row can then land on two different pages (duplicate) or
    // land on neither (skipped) as offsets shift. Adding `id` as a tiebreaker
    // makes the ordering fully deterministic across pages.
    const PAGE_SIZE = 1000
    const rows: Record<string, unknown>[] = []
    for (let page = 0; page < 20; page++) {
      const from = page * PAGE_SIZE
      const { data } = await supabase
        .from('local_jobs')
        .select('id,title,company,category,salary,location,hours,employer_phone,employer_id,application_deadline,urgent,description,posted_at,lat,lng,active,created_at,image_url,source,work_period,work_days,education,preference,num_hires,company_verified,company_founded_year,hire_count,images,source_url,recruitment_regions')
        .eq('active', true)
        .order('posted_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, from + PAGE_SIZE - 1)
      const pageRows = data ?? []
      rows.push(...pageRows)
      if (pageRows.length < PAGE_SIZE) break
    }
    // Defensive de-dup by id — even with a deterministic sort, a page boundary
    // that lands mid-request during a live crawl insert could still overlap.
    // Never trust the paginated fetch to be duplicate-free without checking.
    const seenIds = new Set<unknown>()
    const dedupedRows = rows.filter((r) => {
      if (seenIds.has(r.id)) return false
      seenIds.add(r.id)
      return true
    })
    rows.length = 0
    rows.push(...dedupedRows)
    // job_work_locations is purely additive — a failed/empty fetch here must never
    // block the job list itself from rendering, so this stays a best-effort lookup.
    const locationsByJobId = new Map<number, NonNullable<Job['workLocations']>>()
    if (rows.length > 0) {
      const jobIds = rows.map((r) => r.id as number)
      // address_accuracy/matched_recruitment_regions는 migration 0018(2026-
      // 09-05 적용됨)로 추가된 컬럼 — 지도 표시 등급(정확한 마커 vs 근사
      // 위치)과 위치별 모집지역 라벨 표시에 쓴다(src/lib/jobCoords.ts 참고).
      const { data: locRows } = await supabase
        .from('job_work_locations')
        .select('id,job_id,raw_address,normalized_address,lat,lng,sort_order,address_accuracy,coordinate_accuracy,location_verified,matched_recruitment_regions,geocode_status')
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
    setJobs(fetched.length > 0 ? fetched : DEMO_JOBS)
    setLoading(false)
  }, [])

  useEffect(() => { fetchJobs() }, [fetchJobs])

  const refreshJobs = useCallback(async () => { await fetchJobs() }, [fetchJobs])

  const addPostedJob = useCallback(async (draft: Omit<Job, 'id' | 'postedAt'>) => {
    const draftForPolicy = ensureJobFields({
      ...draft,
      id: 'draft',
      postedAt: new Date().toISOString().slice(0, 10),
    } as Job)
    if (!isPublicJobAllowed(draftForPolicy)) {
      throw new Error('Tin tuyển dụng liên quan đến vay tiền hoặc thu hồi công nợ không phù hợp với Viecganban.')
    }

    const { data, error } = await supabase
      .from('local_jobs')
      .insert({
        title: draft.title,
        company: draft.company,
        category: draft.category,
        salary: draft.salary,
        location: draft.location,
        hours: draft.hours ?? '',
        description: draft.source
          ? `${draft.description}\n[source:${draft.source}]`
          : draft.description,
        employer_phone: draft.employerPhone,
        application_deadline: draft.applicationDeadline,
        urgent: draft.urgent ?? false,
        lat: draft.lat ?? null,
        lng: draft.lng ?? null,
        employer_id: draft.employerId ?? null,
        origin: 'employer',
        admin_hidden: false,
        active: true,
        posted_at: new Date().toISOString().slice(0, 10),
        work_period: draft.workPeriod ?? null,
        work_days: draft.workDays ?? null,
        education: draft.education ?? null,
        preference: draft.preference ?? null,
        num_hires: draft.numHires ?? null,
        company_verified: draft.companyVerified ?? false,
        company_founded_year: draft.companyFoundedYear ?? null,
        hire_count: draft.hireCount ?? null,
      })
      .select()
      .single()

    if (error || !data) throw new Error(error?.message ?? 'Đăng tin thất bại')
    const job = rowToJob(data)
    setJobs((prev) => [job, ...prev])
    return job
  }, [])

  const deleteJob = useCallback(async (id: string) => {
    const rawId = id.replace(/^sb-/, '')
    await supabase.from('local_jobs').update({ active: false }).eq('id', rawId)
    setJobs((prev) => prev.filter((j) => j.id !== id))
  }, [])

  const updateJob = useCallback(async (id: string, patch: Partial<Job>) => {
    const rawId = id.replace(/^sb-/, '')
    await supabase.from('local_jobs').update({
      title: patch.title,
      company: patch.company,
      category: patch.category,
      salary: patch.salary,
      location: patch.location,
      hours: patch.hours,
      description: patch.description,
      employer_phone: patch.employerPhone,
      application_deadline: patch.applicationDeadline,
      urgent: patch.urgent,
    }).eq('id', rawId)
    setJobs((prev) => prev.map((j) => j.id === id ? { ...j, ...patch } : j))
  }, [])

  const value = useMemo(
    () => ({ jobs, loading, refreshJobs, addPostedJob, deleteJob, updateJob }),
    [jobs, loading, refreshJobs, addPostedJob, deleteJob, updateJob],
  )

  return <JobsContext.Provider value={value}>{children}</JobsContext.Provider>
}

export function useJobs() {
  const ctx = useContext(JobsContext)
  if (!ctx) throw new Error('useJobs must be used within JobsProvider')
  return ctx
}
