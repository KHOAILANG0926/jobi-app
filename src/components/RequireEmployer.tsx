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
 *
 * 2026-09-15 사용자 지시로 수정: "권한 없음"과 "권한 조회 실패"가 똑같이
 * 홈으로 조용히 리다이렉트돼 구분이 안 됐다(실제 기업 계정 사용자도 네트워크
 * 오류 한 번이면 아무 안내 없이 튕겨나감). 4가지 상태(확인 중/기업 권한
 * 있음/기업 권한 없음/권한 조회 실패)로 나누고, 조회 실패만 홈으로 보내지
 * 않고 재시도 가능한 오류 화면을 보여준다. 비로그인·"진짜 권한 없음"의
 * 기존 동작(로그인 화면/홈 리다이렉트)은 그대로 유지한다 — DB/RLS/인증
 * 방식은 바꾸지 않는다.
 */
type EmployerCheckState = 'checking' | 'employer' | 'not-employer' | 'error'

export function RequireEmployer({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [state, setState] = useState<EmployerCheckState>('checking')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (loading || !user) return
    let cancelled = false
    setState('checking')
    checkIsEmployer(user.id)
      .then((result) => {
        if (cancelled) return
        setState(result ? 'employer' : 'not-employer')
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
        to={`/dang-nhap?role=employer&redirect=${encodeURIComponent(location.pathname)}`}
        replace
      />
    )
  }
  if (state === 'checking') return null
  if (state === 'error') {
    return (
      <div className="page page--narrow" role="alert">
        <h1>Không thể xác nhận quyền truy cập</h1>
        <p>Đã có lỗi khi kiểm tra quyền nhà tuyển dụng của bạn. Vui lòng thử lại.</p>
        <button type="button" className="btn btn--primary" onClick={() => setAttempt((n) => n + 1)}>
          Thử lại
        </button>
      </div>
    )
  }
  if (state === 'not-employer') {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}
