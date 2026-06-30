import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { createClient } from '@supabase/supabase-js'
import { ensureJobFields } from '../lib/jobUtils'
import type { Job } from '../types/job'

const supabase = createClient(
  'https://edhuesdnuxlbcfephutq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkaHVlc2RudXhsYmNmZXBodXRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMDg5MTcsImV4cCI6MjA5NDU4NDkxN30.mnbMkGLy8UwFaOg6qdkDaV6DGZ2LyCSfOhJVB_48_HE'
)

function rowToJob(r: Record<string, unknown>): Job {
  return ensureJobFields({
    id: `sb-${r.id}`,
    title: (r.title as string) ?? '',
    company: (r.company as string) ?? '',
    category: (r.category as Job['category']) ?? 'other',
    salary: (r.salary as string) ?? '',
    location: (r.location as string) ?? '',
    hours: (r.hours as string) ?? '',
    employerPhone: (r.employer_phone as string) ?? '',
    applicationDeadline: (r.application_deadline as string) ?? '',
    urgent: (r.urgent as boolean) ?? false,
    description: (r.description as string) ?? '',
    postedAt: (r.posted_at as string) ?? new Date().toISOString().slice(0, 10),
    lat: (r.lat as number) ?? undefined,
    lng: (r.lng as number) ?? undefined,
    employerId: (r.employer_id as string) ?? undefined,
    sourceUrl: (r.source_url as string) ?? undefined,
  })
}

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
    const { data } = await supabase
      .from('local_jobs')
      .select('*')
      .eq('active', true)
      .order('posted_at', { ascending: false })
    const fetched = (data ?? []).map(rowToJob)
    setJobs(fetched.length > 0 ? fetched : DEMO_JOBS)
    setLoading(false)
  }, [])

  useEffect(() => { fetchJobs() }, [fetchJobs])

  const refreshJobs = useCallback(async () => { await fetchJobs() }, [fetchJobs])

  const addPostedJob = useCallback(async (draft: Omit<Job, 'id' | 'postedAt'>) => {
    const { data, error } = await supabase
      .from('local_jobs')
      .insert({
        title: draft.title,
        company: draft.company,
        category: draft.category,
        salary: draft.salary,
        location: draft.location,
        hours: draft.hours ?? '',
        description: draft.description,
        employer_phone: draft.employerPhone,
        application_deadline: draft.applicationDeadline,
        urgent: draft.urgent ?? false,
        lat: draft.lat ?? null,
        lng: draft.lng ?? null,
        employer_id: draft.employerId ?? null,
        active: true,
        posted_at: new Date().toISOString().slice(0, 10),
        source_url: draft.sourceUrl ?? null,
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