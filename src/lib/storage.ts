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

export function loadSavedJobIds(): string[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as string[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function toggleSavedJobId(id: string): boolean {
  const ids = new Set(loadSavedJobIds())
  if (ids.has(id)) {
    ids.delete(id)
    localStorage.setItem(SAVED_KEY, JSON.stringify([...ids]))
    window.dispatchEvent(new CustomEvent('vgb:saved-jobs'))
    return false
  }
  ids.add(id)
  localStorage.setItem(SAVED_KEY, JSON.stringify([...ids]))
  window.dispatchEvent(new CustomEvent('vgb:saved-jobs'))
  return true
}

export function isJobSaved(id: string): boolean {
  return loadSavedJobIds().includes(id)
}
