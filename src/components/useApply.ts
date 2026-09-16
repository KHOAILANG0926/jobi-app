import { useCallback, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { snapshotCvPhotoForApplication } from '../lib/accountCvStorage'
import { addApplication } from '../lib/applicationsStorage'
import { loadCv } from '../lib/cvStorage'
import { resolveApplyRoute } from '../lib/jobUtils'
import { loadProfile } from '../lib/storage'
import type { Job } from '../types/job'

export type ApplyStatus = 'idle' | 'confirming' | 'loading' | 'success' | 'error' | 'unavailable'
export type { Job }

export interface UserProfile {
  name: string
  phone: string
  age: string
}

export function buildProfile(scope?: string): UserProfile {
  const profile = loadProfile(scope)
  const cv = loadCv(scope)
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

  // 2026-09-15 사용자 지시로 수정: 이 훅은 RecommendSection("Việc làm phù hợp")/
  // SuggestedJobsPage("Gợi ý việc làm")/UrgentJobsPage/Home.tsx 4곳에서
  // 공유해 쓰는데, 지금까지 job.employerId를 전혀 보지 않고 무조건 내부
  // 지원(applications insert)을 시도했다 — 실측 기준 현재 활성 공고 265건
  // 전부 employer_id가 null(크롤링 출처)이라 이 경로로 들어오면 매번
  // applications_insert RLS 정책(로컬 공고에 employer_id가 있어야 한다는
  // 조건)에 막혀 "Có lỗi xảy ra"만 뜨는 결함이 있었다 — 올바른 동작은
  // JobDetail.tsx가 이미 하듯 원문 사이트로 리다이렉트하는 것. 판정 로직은
  // JobDetail.tsx와 함께 jobUtils.ts의 resolveApplyRoute()로 통합했다(같은
  // 판정이 두 파일에 따로 있으면 한쪽만 고쳤을 때 다시 어긋나는 위험이 있음 —
  // 이번에 실제로 그렇게 어긋나 있던 걸 발견하고 고쳤다).
  const openApply = useCallback((j: Job) => {
    const route = resolveApplyRoute(j)
    if (route.mode === 'external') {
      window.open(route.url, '_blank', 'noopener,noreferrer')
      return
    }
    setJob(j)
    setStatus(route.mode === 'unavailable' ? 'unavailable' : 'confirming')
  }, [])

  const confirm = useCallback(async () => {
    if (!job) return
    setStatus('loading')
    await new Promise<void>((r) => setTimeout(r, 800))
    const p = buildProfile(user?.id)
    // CV 사진 스냅샷 복사가 실패해도(예: 사진을 아예 등록 안 함) 지원 자체는
    // 막지 않는다 — 사진 없이 지원하는 것도 정상 흐름이므로.
    const cvPhotoSnapshotPath = user?.id
      ? await snapshotCvPhotoForApplication(user.id, job.id).catch(() => null)
      : null
    const res = await addApplication({
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
      employerId: job.employerId,
      seekerId: user?.id,
      seekerName: p.name,
      seekerPhone: p.phone,
      cvPhotoSnapshotPath,
    })
    setStatus(res.ok ? 'success' : 'error')
  }, [job, user?.id])

  const close = useCallback(() => setStatus('idle'), [])

  const retry = useCallback(() => {
    if (job) setStatus('confirming')
  }, [job])

  const profile = useMemo(() => buildProfile(user?.id), [user?.id])
  return { status, job, profile, openApply, confirm, close, retry }
}
