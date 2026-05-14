export type ApplicationStatus =
  | 'submitted'
  | 'reviewing'
  | 'interview'
  | 'accepted'
  | 'rejected'

export interface JobApplication {
  id?: string
  jobId: string
  jobTitle: string
  company: string
  employerId?: string
  seekerId?: string
  seekerName?: string
  seekerPhone?: string
  appliedAt: string
  status: ApplicationStatus
}

const KEY = 'jobi_applications'

export const APPLICATION_STATUS_META: Record<
  ApplicationStatus,
  { labelVi: string; badgeClass: string }
> = {
  submitted: { labelVi: 'Đã nộp', badgeClass: 'app-status--submitted' },
  reviewing: { labelVi: 'Đang xem xét', badgeClass: 'app-status--reviewing' },
  interview: { labelVi: 'Phỏng vấn', badgeClass: 'app-status--interview' },
  accepted: { labelVi: 'Đã nhận', badgeClass: 'app-status--accepted' },
  rejected: { labelVi: 'Từ chối', badgeClass: 'app-status--rejected' },
}

export function loadApplications(): JobApplication[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as JobApplication[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persist(list: JobApplication[]) {
  localStorage.setItem(KEY, JSON.stringify(list))
  window.dispatchEvent(new CustomEvent('jobi:applications'))
}

export function hasAppliedToJob(jobId: string, seekerId?: string): boolean {
  if (!seekerId) return false
  return loadApplications().some((a) => a.jobId === jobId && a.seekerId === seekerId)
}

export function addApplication(entry: {
  jobId: string
  jobTitle: string
  company: string
  employerId?: string
  seekerId?: string
  seekerName?: string
  seekerPhone?: string
}): { ok: true } | { ok: false; reason: 'duplicate' | 'unauthenticated' } {
  if (!entry.seekerId) return { ok: false, reason: 'unauthenticated' }
  const existing = loadApplications()
  const isDuplicate = existing.some(
    (a) => a.jobId === entry.jobId && a.seekerId === entry.seekerId,
  )
  if (isDuplicate) return { ok: false, reason: 'duplicate' }
  const next: JobApplication = {
    ...entry,
    id: crypto.randomUUID(),
    appliedAt: new Date().toISOString(),
    status: 'submitted',
  }
  persist([next, ...existing])
  return { ok: true }
}

export function updateApplicationStatus(key: string, status: ApplicationStatus): void {
  const list = loadApplications()
  const idx = list.findIndex((a) => (a.id ? a.id === key : a.appliedAt === key))
  if (idx === -1) return
  list[idx] = { ...list[idx], status }
  persist(list)
}
