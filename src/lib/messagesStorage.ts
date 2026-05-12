import type { Job } from '../types/job'

const KEY = 'jobi_message_threads'

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
  messages: StoredMessage[]
  updatedAt: string
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

export function loadThreads(): MessageThread[] {
  return loadAll()
    .filter((t) => t.jobId && Array.isArray(t.messages))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

export function appendSeekerMessage(
  job: Pick<Job, 'id' | 'title' | 'company' | 'employerPhone'>,
  body: string,
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
      messages: [msg],
      updatedAt: now,
    }
    threads.unshift(thread)
  } else {
    thread.jobTitle = job.title
    thread.company = job.company
    thread.employerPhone = job.employerPhone ?? thread.employerPhone ?? ''
    thread.messages.push(msg)
    thread.updatedAt = now
    const idx = threads.indexOf(thread)
    if (idx > 0) {
      threads.splice(idx, 1)
      threads.unshift(thread)
    }
  }
  saveAll(threads)
  window.dispatchEvent(new CustomEvent('jobi:messages'))

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
      body:
        'Cảm ơn bạn đã nhắn tin. Bộ phận tuyển dụng sẽ liên hệ sớm qua điện thoại hoặc Zalo nếu phù hợp.',
      sentAt: new Date().toISOString(),
    }
    latest.messages.push(reply)
    latest.updatedAt = reply.sentAt
    saveAll(all)
    window.dispatchEvent(new CustomEvent('jobi:messages'))
  }, 1500)
}

export function subscribeMessages(handler: () => void): () => void {
  window.addEventListener('jobi:messages', handler)
  return () => window.removeEventListener('jobi:messages', handler)
}
