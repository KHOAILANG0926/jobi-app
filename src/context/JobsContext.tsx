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
import { MOCK_JOBS } from '../data/mockJobs'
import { ensureJobFields } from '../lib/jobUtils'
import { deletePostedJob, loadPostedJobs, savePostedJob, updatePostedJob } from '../lib/storage'
import type { Job } from '../types/job'

const supabase = createClient(
  'https://edhuesdnuxlbcfephutq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkaHVlc2RudXhsYmNmZXBodXRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMDg5MTcsImV4cCI6MjA5NDU4NDkxN30.mnbMkGLy8UwFaOg6qdkDaV6DGZ2LyCSfOhJVB_48_HE'
)

function mergeJobs(supabaseJobs: Job[] = []): Job[] {
  const posted = loadPostedJobs().map(ensureJobFields)
  const byId = new Map<string, Job>()
  for (const j of MOCK_JOBS.map(ensureJobFields)) byId.set(j.id, j)
  for (const j of supabaseJobs.map(ensureJobFields)) byId.set(j.id, j)
  for (const j of posted) byId.set(j.id, j)
  return [...byId.values()].sort(
    (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime(),
  )
}

interface JobsContextValue {
  jobs: Job[]
  refreshJobs: () => void
  addPostedJob: (job: Omit<Job, 'id' | 'postedAt'>) => Job
  deleteJob: (id: string) => void
  updateJob: (id: string, patch: Partial<Job>) => void
}

const JobsContext = createContext<JobsContextValue | null>(null)

export function JobsProvider({ children }: { children: ReactNode }) {
  const [supabaseJobs, setSupabaseJobs] = useState<Job[]>([])
  const [jobs, setJobs] = useState<Job[]>(() => mergeJobs())

  // Load from Supabase on mount
  useEffect(() => {
    supabase
      .from('local_jobs')
      .select('*')
      .eq('active', true)
      .order('posted_at', { ascending: false })
      .then(({ data }) => {
        if (!data) return
        const mapped: Job[] = data.map((r) => ({
          id: `sb-${r.id}`,
          title: r.title ?? '',
          company: r.company ?? '',
          category: r.category ?? 'other',
          salary: r.salary ?? '',
          location: r.location ?? '',
          hours: r.hours ?? '',
          employerPhone: r.employer_phone ?? '',
          applicationDeadline: r.application_deadline ?? '',
          urgent: r.urgent ?? false,
          description: r.description ?? '',
          postedAt: r.posted_at ?? new Date().toISOString().slice(0, 10),
          lat: r.lat ?? undefined,
          lng: r.lng ?? undefined,
        }))
        setSupabaseJobs(mapped)
        setJobs(mergeJobs(mapped))
      })
  }, [])

  const refreshJobs = useCallback(() => {
    setJobs(mergeJobs(supabaseJobs))
  }, [supabaseJobs])

  const addPostedJob = useCallback((draft: Omit<Job, 'id' | 'postedAt'>) => {
    const job: Job = {
      ...draft,
      id: `local-${crypto.randomUUID()}`,
      postedAt: new Date().toISOString().slice(0, 10),
    }
    savePostedJob(job)
    setJobs(mergeJobs(supabaseJobs))
    return job
  }, [supabaseJobs])

  const deleteJob = useCallback((id: string) => {
    deletePostedJob(id)
    setJobs(mergeJobs(supabaseJobs))
  }, [supabaseJobs])

  const updateJob = useCallback((id: string, patch: Partial<Job>) => {
    updatePostedJob(id, patch)
    setJobs(mergeJobs(supabaseJobs))
  }, [supabaseJobs])

  const value = useMemo(
    () => ({ jobs, refreshJobs, addPostedJob, deleteJob, updateJob }),
    [jobs, refreshJobs, addPostedJob, deleteJob, updateJob],
  )

  return <JobsContext.Provider value={value}>{children}</JobsContext.Provider>
}

export function useJobs() {
  const ctx = useContext(JobsContext)
  if (!ctx) throw new Error('useJobs must be used within JobsProvider')
  return ctx
}
