import type { Job } from '../types/job'
import type { JobApplication } from './applicationsStorage'

export type NotificationType = 'deadline' | 'status_change'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  body: string
  jobId: string
  createdAt: string
  read: boolean
}

const NOTIF_KEY = 'vgb_notifications'
const SEEN_STATUS_KEY = 'vgb_notif_seen_statuses'
const SEEN_DEADLINE_KEY = 'vgb_notif_seen_deadlines'

function scopedKey(base: string, scope: string): string {
  return `${base}:${scope}`
}

const STATUS_LABELS: Record<string, string> = {
  submitted: 'Đã nộp',
  reviewing: 'Đang xem xét',
  interview: 'Phỏng vấn',
  accepted: 'Đã nhận',
  rejected: 'Từ chối',
}

export function loadNotifications(scope: string): AppNotification[] {
  try {
    const raw = localStorage.getItem(scopedKey(NOTIF_KEY, scope))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persistNotifications(list: AppNotification[], scope: string): void {
  localStorage.setItem(scopedKey(NOTIF_KEY, scope), JSON.stringify(list.slice(0, 50)))
  window.dispatchEvent(new CustomEvent('vgb:notifications'))
}

export function markRead(id: string, scope: string): void {
  const list = loadNotifications(scope)
  const idx = list.findIndex((n) => n.id === id)
  if (idx === -1) return
  list[idx] = { ...list[idx], read: true }
  persistNotifications(list, scope)
}

export function markAllRead(scope: string): void {
  persistNotifications(loadNotifications(scope).map((n) => ({ ...n, read: true })), scope)
}

export function clearAll(scope: string): void {
  persistNotifications([], scope)
}

function loadSeenStatuses(scope: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(scopedKey(SEEN_STATUS_KEY, scope))
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

function loadSeenDeadlines(scope: string): Set<string> {
  try {
    const raw = localStorage.getItem(scopedKey(SEEN_DEADLINE_KEY, scope))
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

export function generateNotifications(savedJobs: Job[], applications: JobApplication[], scope: string): void {
  const now = new Date()
  const todayMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  let notifs = loadNotifications(scope)
  const seenStatuses = loadSeenStatuses(scope)
  const seenDeadlines = loadSeenDeadlines(scope)
  let changed = false

  // --- 1. Deadline alerts for saved jobs ---
  for (const job of savedJobs) {
    if (!job.applicationDeadline) continue
    const [y, m, d] = job.applicationDeadline.split('-').map(Number)
    const deadlineMs = Date.UTC(y, m - 1, d)
    const daysLeft = Math.round((deadlineMs - todayMs) / 86_400_000)
    if (daysLeft < 0) continue // already expired

    // Alert bucket: ">1 day and <= 3 days" → key :3d
    //               "0 or 1 day"            → key :1d
    const checks: Array<{ key: string; condition: boolean; days: number }> = [
      { key: `${job.id}:3d`, condition: daysLeft > 1 && daysLeft <= 3, days: daysLeft },
      { key: `${job.id}:1d`, condition: daysLeft <= 1, days: daysLeft },
    ]

    for (const { key, condition, days } of checks) {
      if (condition && !seenDeadlines.has(key)) {
        const body =
          days === 0
            ? `"${job.title}" tại ${job.company} hết hạn HÔM NAY!`
            : `"${job.title}" tại ${job.company} còn ${days} ngày nộp hồ sơ.`
        notifs = [
          {
            id: `dl_${job.id}_${key.split(':')[1]}_${Date.now()}`,
            type: 'deadline',
            title: 'Sắp hết hạn nộp hồ sơ',
            body,
            jobId: job.id,
            createdAt: now.toISOString(),
            read: false,
          },
          ...notifs,
        ]
        seenDeadlines.add(key)
        changed = true
      }
    }
  }

  // --- 2. Status-change alerts for applications ---
  for (const app of applications) {
    const last = seenStatuses[app.jobId]
    if (last === undefined) {
      // First time seeing — record but don't alert
      seenStatuses[app.jobId] = app.status
      changed = true
    } else if (last !== app.status) {
      notifs = [
        {
          id: `sc_${app.jobId}_${app.status}_${Date.now()}`,
          type: 'status_change',
          title: 'Cập nhật trạng thái đơn ứng tuyển',
          body: `"${app.jobTitle}" tại ${app.company}: ${STATUS_LABELS[last] ?? last} → ${STATUS_LABELS[app.status] ?? app.status}`,
          jobId: app.jobId,
          createdAt: now.toISOString(),
          read: false,
        },
        ...notifs,
      ]
      seenStatuses[app.jobId] = app.status
      changed = true
    }
  }

  if (changed) {
    localStorage.setItem(scopedKey(SEEN_STATUS_KEY, scope), JSON.stringify(seenStatuses))
    localStorage.setItem(scopedKey(SEEN_DEADLINE_KEY, scope), JSON.stringify([...seenDeadlines]))
    persistNotifications(notifs, scope)
  }
}
