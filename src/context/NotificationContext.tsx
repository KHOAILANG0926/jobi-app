import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { loadApplications } from '../lib/applicationsStorage'
import {
  dismissAlertNotifications,
  listAlertNotifications,
  markAlertNotificationsRead,
  type JobAlertNotificationRow,
} from '../lib/jobAlerts'
import { toAppJobId } from '../lib/jobId'
import {
  clearAll,
  generateNotifications,
  loadNotifications,
  markAllRead,
  markRead,
  type AppNotification,
} from '../lib/notificationsStorage'
import { loadSavedJobIds } from '../lib/storage'
import type { Job } from '../types/job'
import { useAuth } from './AuthContext'
import { useJobs } from './JobsContext'

interface NotificationContextValue {
  notifications: AppNotification[]
  unreadCount: number
  markRead: (id: string) => void
  markAllRead: () => void
  clearAll: () => void
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

// 서버 희망조건 알림(job_alert_notifications)은 id 앞에 이 접두사를 붙여
// localStorage 알림(마감임박/지원상태)과 구분한다.
const SERVER_PREFIX = 'ja_'

function serverToAppNotification(n: JobAlertNotificationRow, jobs: Job[]): AppNotification {
  const appJobId = toAppJobId(n.jobId)
  const job = jobs.find((j) => j.id === appJobId)
  const what = job ? `"${job.title}" tại ${job.company}` : `Tin tuyển dụng #${n.jobId}`
  return {
    id: `${SERVER_PREFIX}${n.id}`,
    type: 'job_match',
    title: 'Tin mới phù hợp điều kiện của bạn',
    body: n.preferenceName ? `${what} — đạt đủ điều kiện bắt buộc của "${n.preferenceName}".` : `${what} — đạt đủ điều kiện bắt buộc.`,
    jobId: appJobId,
    createdAt: n.createdAt,
    read: n.readAt !== null,
  }
}

function serverIds(list: AppNotification[]): number[] {
  return list.filter((n) => n.id.startsWith(SERVER_PREFIX)).map((n) => Number(n.id.slice(SERVER_PREFIX.length)))
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { jobs } = useJobs()
  const notificationScope = user?.id ?? 'guest'
  const isSeeker = user?.role === 'seeker'
  const [notificationState, setNotificationState] = useState(() => ({
    scope: notificationScope,
    items: loadNotifications(notificationScope),
  }))
  const [serverState, setServerState] = useState<{ scope: string; rows: JobAlertNotificationRow[] }>({ scope: '', rows: [] })

  const localItems = notificationState.scope === notificationScope
    ? notificationState.items
    : loadNotifications(notificationScope)
  const serverRows = serverState.scope === notificationScope ? serverState.rows : []

  const notifications = useMemo(() => {
    const merged = [...localItems, ...serverRows.map((r) => serverToAppNotification(r, jobs))]
    return merged.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [localItems, serverRows, jobs])

  const refresh = useCallback(() => {
    setNotificationState({ scope: notificationScope, items: loadNotifications(notificationScope) })
  }, [notificationScope])

  const refreshServer = useCallback(async () => {
    if (!isSeeker) {
      setServerState({ scope: notificationScope, rows: [] })
      return
    }
    try {
      const rows = await listAlertNotifications()
      setServerState({ scope: notificationScope, rows })
    } catch {
      // 네트워크/권한 오류 시 이전 목록 유지 — 로컬 알림은 계속 동작해야 한다.
    }
  }, [isSeeker, notificationScope])

  const check = useCallback(async () => {
    const savedIds = loadSavedJobIds(user?.id)
    const savedJobs = jobs.filter((j) => savedIds.includes(j.id))
    const applications = user?.role === 'seeker' ? await loadApplications() : []
    generateNotifications(savedJobs, applications, notificationScope)
    refresh()
    await refreshServer()
  }, [jobs, notificationScope, refresh, refreshServer, user?.id, user?.role])

  // Run on mount and every 60 s
  useEffect(() => {
    check()
    const id = setInterval(check, 60_000)
    return () => clearInterval(id)
  }, [check])

  // React to job/application events
  useEffect(() => {
    const onCheck = () => check()
    const onRefresh = () => refresh()
    window.addEventListener('vgb:saved-jobs', onCheck)
    window.addEventListener('vgb:applications', onCheck)
    window.addEventListener('vgb:notifications', onRefresh)
    return () => {
      window.removeEventListener('vgb:saved-jobs', onCheck)
      window.removeEventListener('vgb:applications', onCheck)
      window.removeEventListener('vgb:notifications', onRefresh)
    }
  }, [check, refresh])

  const handleMarkRead = useCallback(
    (id: string) => {
      if (id.startsWith(SERVER_PREFIX)) {
        const serverId = Number(id.slice(SERVER_PREFIX.length))
        void markAlertNotificationsRead([serverId]).then(refreshServer, () => undefined)
        return
      }
      markRead(id, notificationScope)
      refresh()
    },
    [notificationScope, refresh, refreshServer],
  )

  const handleMarkAllRead = useCallback(() => {
    markAllRead(notificationScope)
    refresh()
    const unreadServer = serverIds(notifications.filter((n) => !n.read))
    if (unreadServer.length > 0) void markAlertNotificationsRead(unreadServer).then(refreshServer, () => undefined)
  }, [notificationScope, notifications, refresh, refreshServer])

  const handleClearAll = useCallback(() => {
    clearAll(notificationScope)
    refresh()
    // 서버 알림은 삭제가 아니라 숨김 — 같은 공고가 다시 알림되지 않게 기록은 남긴다.
    const ids = serverIds(notifications)
    if (ids.length > 0) void dismissAlertNotifications(ids).then(refreshServer, () => undefined)
  }, [notificationScope, notifications, refresh, refreshServer])

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  )

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      markRead: handleMarkRead,
      markAllRead: handleMarkAllRead,
      clearAll: handleClearAll,
    }),
    [notifications, unreadCount, handleMarkRead, handleMarkAllRead, handleClearAll],
  )

  return (
    <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider')
  return ctx
}
