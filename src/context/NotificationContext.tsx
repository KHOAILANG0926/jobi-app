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
  clearAll,
  generateNotifications,
  loadNotifications,
  markAllRead,
  markRead,
  type AppNotification,
} from '../lib/notificationsStorage'
import { loadSavedJobIds } from '../lib/storage'
import { useJobs } from './JobsContext'

interface NotificationContextValue {
  notifications: AppNotification[]
  unreadCount: number
  markRead: (id: string) => void
  markAllRead: () => void
  clearAll: () => void
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { jobs } = useJobs()
  const [notifications, setNotifications] = useState<AppNotification[]>(() =>
    loadNotifications(),
  )

  const refresh = useCallback(() => {
    setNotifications(loadNotifications())
  }, [])

  const check = useCallback(async () => {
    const savedIds = loadSavedJobIds()
    const savedJobs = jobs.filter((j) => savedIds.includes(j.id))
    const applications = await loadApplications()
    generateNotifications(savedJobs, applications)
    refresh()
  }, [jobs, refresh])

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
      markRead(id)
      refresh()
    },
    [refresh],
  )

  const handleMarkAllRead = useCallback(() => {
    markAllRead()
    refresh()
  }, [refresh])

  const handleClearAll = useCallback(() => {
    clearAll()
    refresh()
  }, [refresh])

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
