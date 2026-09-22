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
import { rowToJob } from '../lib/jobRows'
import { supabase } from '../lib/supabase'
import { fetchJobsData } from '../lib/fetchJobsData'
import type { Job } from '../types/job'

interface JobsContextValue {
  jobs: Job[]
  loading: boolean
  jobsError: boolean
  refreshJobs: () => Promise<void>
  /** guestManageToken이 있으면 employerId 없이(비로그인 게스트 등록) 저장한다 —
   *  20260920120000_local_jobs_guest_posting.sql의 local_jobs_guest_insert
   *  정책이 "employer_id is null AND guest_manage_token is not null"만 허용. */
  addPostedJob: (job: Omit<Job, 'id' | 'postedAt'> & { guestManageToken?: string }) => Promise<Job>
  deleteJob: (id: string) => Promise<void>
  updateJob: (id: string, patch: Partial<Job>) => Promise<void>
}

const JobsContext = createContext<JobsContextValue | null>(null)

interface JobsProviderProps {
  children: ReactNode
  /** SSR이 이미 렌더링 시점에 채워둔 초기 데이터 — 있으면 마운트 시 effect
   *  fetch를 건너뛰고 이 값을 그대로 쓴다(같은 요청을 브라우저에서 중복
   *  실행하지 않기 위함). SSR 경로가 아니면 항상 undefined. */
  initialJobs?: Job[]
  initialJobsError?: boolean
}

export function JobsProvider({ children, initialJobs, initialJobsError }: JobsProviderProps) {
  const hasInitialJobs = initialJobs !== undefined
  const [jobs, setJobs] = useState<Job[]>(initialJobs ?? [])
  const [loading, setLoading] = useState(!hasInitialJobs)
  const [jobsError, setJobsError] = useState(initialJobsError ?? false)

  const fetchJobs = useCallback(async () => {
    setLoading(true)
    const result = await fetchJobsData(supabase)
    setJobsError(result.jobsError)
    setJobs(result.jobs)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (hasInitialJobs) return
    fetchJobs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchJobs])

  const refreshJobs = useCallback(async () => { await fetchJobs() }, [fetchJobs])

  const addPostedJob = useCallback(async (draft: Omit<Job, 'id' | 'postedAt'> & { guestManageToken?: string }) => {
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
        subcategory: draft.subcategory ?? null,
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
        // 2026-09-20 "등록 없이 빠르게 게시" — 비로그인 게스트 등록은
        // employer_id 없이 guest_manage_token만으로 온다(local_jobs_guest_insert
        // RLS가 이 조합만 anon INSERT를 허용). 로그인 경로는 항상 undefined.
        guest_manage_token: draft.guestManageToken ?? null,
        origin: 'employer',
        admin_hidden: false,
        active: true,
        posted_at: new Date().toISOString().slice(0, 10),
        work_period: draft.workPeriod ?? null,
        job_duration: draft.jobDuration ?? null,
        gender_requirement: draft.genderRequirement ?? null,
        age_requirement: draft.ageRequirement ?? null,
        work_days: draft.workDays ?? null,
        education: draft.education ?? null,
        preference: draft.preference ?? null,
        num_hires: draft.numHires ?? null,
        company_verified: draft.companyVerified ?? false,
        company_founded_year: draft.companyFoundedYear ?? null,
        hire_count: draft.hireCount ?? null,
        labor_contract_pledge: draft.laborContractPledge ?? null,
        social_insurance_pledge: draft.socialInsurancePledge ?? null,
      })
      // guest_manage_token 컬럼은 anon/authenticated 양쪽 다 컬럼 단위로 SELECT가
      // REVOKE돼 있다(마이그레이션 참고) — bare .select()(=select=*)로 반환받으면
      // 막 INSERT한 이 요청 본인한테까지도 권한 오류가 날 수 있어, 공개 목록
      // 조회(fetchJobs)와 동일한 안전한 컬럼 목록만 명시적으로 돌려받는다.
      .select('id,title,company,category,subcategory,salary,location,hours,employer_phone,employer_id,application_deadline,urgent,description,posted_at,lat,lng,active,created_at,image_url,source,work_period,job_duration,gender_requirement,age_requirement,work_days,education,preference,num_hires,company_verified,company_founded_year,hire_count,labor_contract_pledge,social_insurance_pledge,images,source_url,recruitment_regions')
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
    () => ({ jobs, loading, jobsError, refreshJobs, addPostedJob, deleteJob, updateJob }),
    [jobs, loading, jobsError, refreshJobs, addPostedJob, deleteJob, updateJob],
  )

  return <JobsContext.Provider value={value}>{children}</JobsContext.Provider>
}

export function useJobs() {
  const ctx = useContext(JobsContext)
  if (!ctx) throw new Error('useJobs must be used within JobsProvider')
  return ctx
}
