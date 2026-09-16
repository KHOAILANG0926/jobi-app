import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { checkIsAdmin } from '../lib/accountRoles'

/**
 * app_metadata.role은 서버(service_role)에서만 설정 가능해 클라이언트가 스스로
 * 값을 바꿀 수 없다 (user_metadata와 달리 위조 불가) — 이 값만 관리자 권한 판단에 사용한다.
 *
 * 2026-09-15 사용자 지시로 수정(Astra 조사, RequireEmployer.tsx와 동일한 문제):
 * "관리자 아님"과 "권한 조회 실패"가 똑같이 홈으로 조용히 리다이렉트돼 구분이
 * 안 됐다(네트워크 오류 한 번이면 진짜 관리자도 아무 안내 없이 튕겨나감).
 * checking/admin/not-admin/error 4상태로 나누고, 조회 실패만 홈으로 보내지
 * 않고 재시도 가능한 오류 화면을 보여준다. 비로그인·"진짜 관리자 아님"의
 * 기존 동작은 그대로 유지 — DB/RLS/인증 방식은 바꾸지 않는다.
 */
type AdminCheckState = 'checking' | 'admin' | 'not-admin' | 'error'

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [state, setState] = useState<AdminCheckState>('checking')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (loading || !user) return
    let cancelled = false
    setState('checking')
    checkIsAdmin()
      .then((result) => {
        if (cancelled) return
        setState(result ? 'admin' : 'not-admin')
      })
      .catch(() => {
        if (cancelled) return
        setState('error')
      })
    return () => { cancelled = true }
  }, [user, loading, attempt])

  if (loading) return null

  if (!user) {
    return (
      <Navigate
        to={`/dang-nhap?redirect=${encodeURIComponent(location.pathname)}`}
        replace
      />
    )
  }
  if (state === 'checking') return null
  if (state === 'error') {
    return (
      <div className="page page--narrow" role="alert">
        <h1>Không thể xác nhận quyền truy cập</h1>
        <p>Đã có lỗi khi kiểm tra quyền quản trị của bạn. Vui lòng thử lại.</p>
        <button type="button" className="btn btn--primary" onClick={() => setAttempt((n) => n + 1)}>
          Thử lại
        </button>
      </div>
    )
  }
  if (state === 'not-admin') {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}
