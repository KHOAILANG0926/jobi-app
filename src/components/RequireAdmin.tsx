import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

/**
 * app_metadata.role은 서버(service_role)에서만 설정 가능해 클라이언트가 스스로
 * 값을 바꿀 수 없다 (user_metadata와 달리 위조 불가) — 이 값만 관리자 권한 판단에 사용한다.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [checking, setChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!user) {
      setChecking(false)
      return
    }
    let cancelled = false
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return
      setIsAdmin(data.user?.app_metadata?.role === 'admin')
      setChecking(false)
    })
    return () => { cancelled = true }
  }, [user, loading])

  if (loading || checking) return null

  if (!user) {
    return (
      <Navigate
        to={`/dang-nhap?redirect=${encodeURIComponent(location.pathname)}`}
        replace
      />
    )
  }
  if (!isAdmin) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}
