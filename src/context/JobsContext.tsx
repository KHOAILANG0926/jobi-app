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
    setJobs((data ?? []).map(rowToJob))
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