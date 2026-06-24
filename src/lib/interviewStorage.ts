const KEY = 'vgb_interviews'

export type InterviewStatus = 'pending' | 'confirmed' | 'cancelled'

export interface InterviewSlot {
  id: string
  jobId: string
  jobTitle: string
  company: string
  seekerId: string
  seekerName?: string
  employerId: string
  datetime: string
  location: string
  notes: string
  status: InterviewStatus
  createdAt: string
}

function loadAll(): InterviewSlot[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as InterviewSlot[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveAll(list: InterviewSlot[]): void {
  localStorage.setItem(KEY, JSON.stringify(list))
  window.dispatchEvent(new CustomEvent('vgb:interviews'))
}

export function loadSeekerInterviews(seekerId: string): InterviewSlot[] {
  return loadAll()
    .filter((s) => s.seekerId === seekerId && s.status !== 'cancelled')
    .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())
}

export function loadEmployerInterviews(employerId: string): InterviewSlot[] {
  return loadAll()
    .filter((s) => s.employerId === employerId && s.status !== 'cancelled')
    .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())
}

export function getInterviewForApplication(jobId: string, seekerId: string): InterviewSlot | null {
  return (
    loadAll().find(
      (s) => s.jobId === jobId && s.seekerId === seekerId && s.status !== 'cancelled',
    ) ?? null
  )
}

export function scheduleInterview(
  input: Omit<InterviewSlot, 'id' | 'createdAt'>,
): InterviewSlot {
  const slot: InterviewSlot = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }
  const all = loadAll()
  const filtered = all.filter(
    (s) => !(s.jobId === input.jobId && s.seekerId === input.seekerId),
  )
  saveAll([slot, ...filtered])
  return slot
}

export function updateInterviewStatus(id: string, status: InterviewStatus): void {
  const all = loadAll()
  const idx = all.findIndex((s) => s.id === id)
  if (idx === -1) return
  all[idx] = { ...all[idx], status }
  saveAll(all)
}

export function subscribeInterviews(handler: () => void): () => void {
  window.addEventListener('vgb:interviews', handler)
  return () => window.removeEventListener('vgb:interviews', handler)
}
