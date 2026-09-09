import type { Job } from '../types/job'

const POSTED_KEY = 'vgb_posted_jobs'
const PROFILE_KEY = 'vgb_profile'
const SAVED_KEY = 'vgb_saved_job_ids'

function scopedKey(key: string, scope?: string): string {
  return scope ? `${key}:${scope}` : key
}

export function loadPostedJobs(): Job[] {
  try {
    const raw = localStorage.getItem(POSTED_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Job[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function savePostedJob(job: Job): void {
  const existing = loadPostedJobs()
  localStorage.setItem(POSTED_KEY, JSON.stringify([job, ...existing]))
}

export function deletePostedJob(id: string): void {
  const updated = loadPostedJobs().filter((j) => j.id !== id)
  localStorage.setItem(POSTED_KEY, JSON.stringify(updated))
  window.dispatchEvent(new CustomEvent('vgb:jobs'))
}

export function updatePostedJob(id: string, patch: Partial<Job>): void {
  const updated = loadPostedJobs().map((j) => (j.id === id ? { ...j, ...patch } : j))
  localStorage.setItem(POSTED_KEY, JSON.stringify(updated))
  window.dispatchEvent(new CustomEvent('vgb:jobs'))
}

export interface SeekerProfile {
  fullName: string
  phone: string
  email: string
  city: string
  bio: string
}

export function hasStoredProfile(scope?: string): boolean {
  return localStorage.getItem(scopedKey(PROFILE_KEY, scope)) !== null
}

const defaultProfile: SeekerProfile = {
  fullName: 'Nguyễn Văn A',
  phone: '0901 234 567',
  email: 'nguyenvana@email.com',
  city: 'TP. Hồ Chí Minh',
  bio: 'Sinh viên năm 3, mong muốn tìm việc bán thời gian buổi tối và cuối tuần.',
}

export function createEmptyProfile(): SeekerProfile {
  return { fullName: '', phone: '', email: '', city: '', bio: '' }
}

export function loadProfile(scope?: string): SeekerProfile {
  try {
    const raw = localStorage.getItem(scopedKey(PROFILE_KEY, scope))
    if (!raw) return scope ? createEmptyProfile() : { ...defaultProfile }
    return { ...defaultProfile, ...JSON.parse(raw) }
  } catch {
    return scope ? createEmptyProfile() : { ...defaultProfile }
  }
}

export function saveProfile(p: SeekerProfile, scope?: string): void {
  localStorage.setItem(scopedKey(PROFILE_KEY, scope), JSON.stringify(p))
  window.dispatchEvent(new CustomEvent('vgb:profile-saved'))
}

// 저장한 공고는 계정별로 분리한다(scope = user.id) — 미로그인(scope 없음)일 때는
// 기존 전역 키(vgb_saved_job_ids)를 그대로 쓴다(하위호환, 기존 게스트 저장 데이터
// 보존). 로그인 사용자는 vgb_saved_job_ids:<uid> 키를 쓰므로 같은 브라우저를
// 공유하는 서로 다른 계정끼리 저장 목록이 섞이지 않는다. 다만 이 저장소는 여전히
// localStorage이므로 기기 간 동기화는 지원하지 않는다(계정 서버 동기화가 실제로
// 붙기 전까지는 "이 브라우저에서 로그인한 계정" 범위로만 분리됨).
export function loadSavedJobIds(scope?: string): string[] {
  try {
    const raw = localStorage.getItem(scopedKey(SAVED_KEY, scope))
    if (!raw) return []
    const parsed = JSON.parse(raw) as string[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function toggleSavedJobId(id: string, scope?: string): boolean {
  const key = scopedKey(SAVED_KEY, scope)
  const ids = new Set(loadSavedJobIds(scope))
  if (ids.has(id)) {
    ids.delete(id)
    localStorage.setItem(key, JSON.stringify([...ids]))
    window.dispatchEvent(new CustomEvent('vgb:saved-jobs'))
    return false
  }
  ids.add(id)
  localStorage.setItem(key, JSON.stringify([...ids]))
  window.dispatchEvent(new CustomEvent('vgb:saved-jobs'))
  return true
}

export function isJobSaved(id: string, scope?: string): boolean {
  return loadSavedJobIds(scope).includes(id)
}
