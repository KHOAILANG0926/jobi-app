import { useCallback, useEffect, useMemo, useState } from 'react'
import { loadApplications, subscribeApplications, type JobApplication } from '../../lib/applicationsStorage'
import { fetchEmployerJobs } from '../../lib/jobRows'
import type { Job } from '../../types/job'
import { applicationsOfMyJobs, countByJob, pendingApplications } from './bizView'
import { onEvent } from '../../lib/eventBus'

/** 기업 화면이 쓰는 자료: 내 공고(공개·비공개·관리자 숨김 모두, employer_id로 직접 조회)와 내 공고의 지원 — 웹 기업 대시보드와 같은 함수. */
export function useBizData(userId: string) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [jobsLoading, setJobsLoading] = useState(true)
  const [jobsError, setJobsError] = useState(false)
  const [applications, setApplications] = useState<JobApplication[]>([])

  const reloadJobs = useCallback(async () => {
    setJobsLoading(true); setJobsError(false)
    try { setJobs(await fetchEmployerJobs(userId)) } catch { setJobs([]); setJobsError(true) } finally { setJobsLoading(false) }
  }, [userId])
  useEffect(() => { void reloadJobs() }, [reloadJobs])

  const reloadApplications = useCallback(() => { loadApplications().then(setApplications).catch(() => {}) }, [])
  useEffect(() => {
    reloadApplications()
    const offEvent = onEvent('applications', reloadApplications)
    const off = subscribeApplications(reloadApplications)
    return () => { offEvent(); off() }
  }, [reloadApplications])

  const mine = useMemo(() => applicationsOfMyJobs(applications, jobs.map((j) => j.id)), [applications, jobs])
  const countsByJob = useMemo(() => countByJob(mine), [mine])
  const pending = useMemo(() => pendingApplications(mine), [mine])
  return { jobs, jobsLoading, jobsError, reloadJobs, applications: mine, reloadApplications, countsByJob, pending }
}
