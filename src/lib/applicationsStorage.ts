export type ApplicationStatus =
  | 'submitted'
  | 'reviewing'
  | 'interview'
  | 'accepted'
  | 'rejected'

export interface StatusHistoryEntry {
  status: ApplicationStatus
  changedAt: string
}

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
  statusHistory?: StatusHistoryEntry[]
}

const KEY = 'vgb_applications'

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

function migrateApp(raw: JobApplication): JobApplication {
  if (!raw.statusHistory || raw.statusHistory.length === 0) {
    return {
      ...raw,
      statusHistory: [{ status: raw.status, changedAt: raw.appliedAt }],
    }
  }
  return raw
}

export function loadApplications(): JobApplication[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as JobApplication[]
    return Array.isArray(parsed) ? parsed.map(migrateApp) : []
  } catch {
    return []
  }
}

function persist(list: JobApplication[]) {
  localStorage.setItem(KEY, JSON.stringify(list))
  window.dispatchEvent(new CustomEvent('vgb:applications'))
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
  const now = new Date().toISOString()
  const next: JobApplication = {
    ...entry,
    id: crypto.randomUUID(),
    appliedAt: now,
    status: 'submitted',
    statusHistory: [{ status: 'submitted', changedAt: now }],
  }
  persist([next, ...existing])
  return { ok: true }
}

export function updateApplicationStatus(key: string, status: ApplicationStatus): void {
  const list = loadApplications()
  const idx = list.findIndex((a) => (a.id ? a.id === key : a.appliedAt === key))
  if (idx === -1) return
  const now = new Date().toISOString()
  const prev = list[idx]
  list[idx] = {
    ...prev,
    status,
    statusHistory: [
      ...(prev.statusHistory ?? [{ status: prev.status, changedAt: prev.appliedAt }]),
      { status, changedAt: now },
    ],
  }
  persist(list)
}
