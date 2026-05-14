import { useCallback, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { addApplication } from '../lib/applicationsStorage'
import { loadCv } from '../lib/cvStorage'
import { loadProfile } from '../lib/storage'
import type { Job } from '../types/job'

export type ApplyStatus = 'idle' | 'confirming' | 'loading' | 'success' | 'error'
export type { Job }

export interface UserProfile {
  name: string
  phone: string
  age: string
}

function buildProfile(): UserProfile {
  const profile = loadProfile()
  const cv = loadCv()
  let age = '—'
  if (cv.dateOfBirth) {
    const years = new Date().getFullYear() - new Date(cv.dateOfBirth).getFullYear()
    if (years > 0 && years < 100) age = String(years)
  }
  return {
    name: cv.fullName || profile.fullName || '—',
    phone: cv.phone || profile.phone || '—',
    age,
  }
}

export function useApply() {
  const { user } = useAuth()
  const [status, setStatus] = useState<ApplyStatus>('idle')
  const [job, setJob] = useState<Job | null>(null)

  const openApply = useCallback((j: Job) => {
    setJob(j)
    setStatus('confirming')
  }, [])

  const confirm = useCallback(async () => {
    if (!job) return
    setStatus('loading')
    await new Promise<void>((r) => setTimeout(r, 800))
    const p = buildProfile()
    const res = addApplication({
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
      employerId: job.employerId,
      seekerId: user?.id,
      seekerName: p.name,
      seekerPhone: p.phone,
    })
    setStatus(res.ok ? 'success' : 'error')
  }, [job, user?.id])

  const close = useCallback(() => setStatus('idle'), [])

  const retry = useCallback(() => {
    if (job) setStatus('confirming')
  }, [job])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const profile = useMemo(buildProfile, [])
  return { status, job, profile, openApply, confirm, close, retry }
}
