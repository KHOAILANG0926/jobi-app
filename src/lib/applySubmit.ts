import { snapshotCvPhotoForApplication } from './accountCvStorage'
import { addApplication } from './applicationsStorage'
import { loadCv } from './cvStorage'
import { loadProfile } from './storage'
import type { Job } from '../types/job'

// 사이트 안 지원의 "지원자 요약 + 제출" — 웹 useApply(훅)에 있던 것을 그대로 옮긴 공용 함수(동작 변경 없음).
// 웹(useApply)과 앱(/app 지원 시트)이 같은 코드로 지원 내역을 만든다.
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

/** 지원 제출. CV 사진 스냅샷 복사가 실패해도(사진을 등록 안 함 등) 지원은 막지 않는다. */
export async function submitApplication(job: Job, userId: string | undefined) {
  const p = buildProfile(userId)
  const cvPhotoSnapshotPath = userId
    ? await snapshotCvPhotoForApplication(userId, job.id).catch(() => null)
    : null
  return addApplication({
    jobId: job.id,
    jobTitle: job.title,
    company: job.company,
    employerId: job.employerId,
    seekerId: userId,
    seekerName: p.name,
    seekerPhone: p.phone,
    cvPhotoSnapshotPath,
  })
}
