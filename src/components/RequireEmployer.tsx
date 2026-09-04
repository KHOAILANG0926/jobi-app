import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { checkIsEmployer } from '../lib/accountRoles'

/**
 * 2026-09-04 사용자 지시("RequireEmployer가 user_metadata.role을 신뢰하지
 * 않고 실제 account_roles 또는 서버가 신뢰할 수 있는 역할 조회 결과를
 * 사용하도록 수정"): 이전에는 AuthContext의 user.role(= auth.users.
 * user_metadata.role)을 그대로 봤는데, 이 값은 로그인 후
 * supabase.auth.updateUser({ data: { role: 'employer' } })를 아무나 호출해
 * 스스로 바꿀 수 있다(서버 검증 없음) — 화면 접근 게이트로 신뢰할 수 없다.
 * checkIsEmployer()가 대신 account_roles 테이블(가입 시 1회만 채워지고
 * 이후 사용자가 직접 못 바꿈, RLS로 본인 행만 조회 가능)을 확인한다.
 * RequireAdmin.tsx와 동일한 패턴(loading/checking 분리 + 서버 값 재확인).
 */
export function RequireEmployer({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [checking, setChecking] = useState(true)
  const [isEmployer, setIsEmployer] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!user) {
      setChecking(false)
      return
    }
    let cancelled = false
    checkIsEmployer(user.id).then((result) => {
      if (cancelled) return
      setIsEmployer(result)
      setChecking(false)
    })
    return () => { cancelled = true }
  }, [user, loading])

  if (loading || checking) return null

  if (!user) {
    return (
      <Navigate
        to={`/dang-nhap?role=employer&redirect=${encodeURIComponent(location.pathname)}`}
        replace
      />
    )
  }
  if (!isEmployer) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}
