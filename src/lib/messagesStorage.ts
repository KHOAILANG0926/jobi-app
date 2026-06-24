import type { Job } from '../types/job'

const KEY = 'vgb_message_threads'

export type MessageFrom = 'seeker' | 'employer'

export interface StoredMessage {
  id: string
  from: MessageFrom
  body: string
  sentAt: string
}

export interface MessageThread {
  jobId: string
  jobTitle: string
  company: string
  employerPhone?: string
  seekerName?: string
  messages: StoredMessage[]
  updatedAt: string
  unreadBySeeker?: boolean
  unreadByEmployer?: boolean
}

function loadAll(): MessageThread[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as MessageThread[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveAll(threads: MessageThread[]) {
  localStorage.setItem(KEY, JSON.stringify(threads))
}

function dispatch() {
  window.dispatchEvent(new CustomEvent('vgb:messages'))
}

export function loadThreads(): MessageThread[] {
  return loadAll()
    .filter((t) => t.jobId && Array.isArray(t.messages))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

export function loadEmployerThreads(jobIds: string[]): MessageThread[] {
  if (!jobIds.length) return []
  const set = new Set(jobIds)
  return loadAll()
    .filter((t) => t.jobId && Array.isArray(t.messages) && set.has(t.jobId))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

export function countUnreadForSeeker(): number {
  return loadAll().filter((t) => t.unreadBySeeker).length
}

export function countUnreadForEmployer(jobIds: string[]): number {
  const set = new Set(jobIds)
  return loadAll().filter((t) => set.has(t.jobId) && t.unreadByEmployer).length
}

export function markReadBySeeker(jobId: string): void {
  const threads = loadAll()
  const thread = threads.find((t) => t.jobId === jobId)
  if (!thread || !thread.unreadBySeeker) return
  thread.unreadBySeeker = false
  saveAll(threads)
  dispatch()
}

export function markReadByEmployer(jobId: string): void {
  const threads = loadAll()
  const thread = threads.find((t) => t.jobId === jobId)
  if (!thread || !thread.unreadByEmployer) return
  thread.unreadByEmployer = false
  saveAll(threads)
  dispatch()
}

export function appendSeekerMessage(
  job: Pick<Job, 'id' | 'title' | 'company' | 'employerPhone'>,
  body: string,
  seekerName?: string,
): void {
  const text = body.trim()
  if (!text) return
  const threads = loadAll()
  let thread = threads.find((t) => t.jobId === job.id)
  const now = new Date().toISOString()
  const msg: StoredMessage = {
    id: crypto.randomUUID(),
    from: 'seeker',
    body: text,
    sentAt: now,
  }
  if (!thread) {
    thread = {
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
      employerPhone: job.employerPhone ?? '',
      seekerName: seekerName ?? '',
      messages: [msg],
      updatedAt: now,
      unreadByEmployer: true,
      unreadBySeeker: false,
    }
    threads.unshift(thread)
  } else {
    thread.jobTitle = job.title
    thread.company = job.company
    thread.employerPhone = job.employerPhone ?? thread.employerPhone ?? ''
    if (seekerName) thread.seekerName = seekerName
    thread.messages.push(msg)
    thread.updatedAt = now
    thread.unreadByEmployer = true
    thread.unreadBySeeker = false
    const idx = threads.indexOf(thread)
    if (idx > 0) {
      threads.splice(idx, 1)
      threads.unshift(thread)
    }
  }
  saveAll(threads)
  dispatch()

  const seekerMsgId = msg.id
  window.setTimeout(() => {
    const all = loadAll()
    const latest = all.find((t) => t.jobId === job.id)
    if (!latest || latest.messages.length === 0) return
    const last = latest.messages[latest.messages.length - 1]
    if (last.from !== 'seeker' || last.id !== seekerMsgId) return
    const reply: StoredMessage = {
      id: crypto.randomUUID(),
      from: 'employer',
      body: 'Cảm ơn bạn đã nhắn tin. Bộ phận tuyển dụng sẽ liên hệ sớm qua điện thoại hoặc Zalo nếu phù hợp.',
      sentAt: new Date().toISOString(),
    }
    latest.messages.push(reply)
    latest.updatedAt = reply.sentAt
    latest.unreadBySeeker = true
    saveAll(all)
    dispatch()
  }, 1500)
}

export function appendEmployerMessage(jobId: string, body: string): void {
  const text = body.trim()
  if (!text) return
  const threads = loadAll()
  const thread = threads.find((t) => t.jobId === jobId)
  if (!thread) return
  const now = new Date().toISOString()
  const msg: StoredMessage = {
    id: crypto.randomUUID(),
    from: 'employer',
    body: text,
    sentAt: now,
  }
  thread.messages.push(msg)
  thread.updatedAt = now
  thread.unreadBySeeker = true
  thread.unreadByEmployer = false
  const idx = threads.indexOf(thread)
  if (idx > 0) {
    threads.splice(idx, 1)
    threads.unshift(thread)
  }
  saveAll(threads)
  dispatch()
}

export function subscribeMessages(handler: () => void): () => void {
  window.addEventListener('vgb:messages', handler)
  return () => window.removeEventListener('vgb:messages', handler)
}
