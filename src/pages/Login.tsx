import { useState } from 'react'
import { useNavigate, Link, useSearchParams, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ZaloIcon } from '../components/ZaloIcon'
import { PasswordField } from '../components/PasswordField'
import { checkIsEmployer } from '../lib/accountRoles'
import { supabase } from '../lib/supabase'

/**
 * 2026-09-20 사용자 지시("Đăng nhập이랑 Đăng ký가 똑같아 보인다") — 로그인
 * 화면에 있던 역할 선택 칩("🔍 Tìm việc/🏢 Tuyển dụng")과 "Xác nhận mật
 * khẩu"(비밀번호 재입력) 둘 다 원래 로그인의 목적과 안 맞아서 제거한다:
 * - 재입력 확인은 "새 비밀번호를 만들 때"(가입/재설정) 오타 방지용이지,
 *   이미 있는 비밀번호를 입력하는 로그인에는 의미가 없다.
 * - 역할은 이미 계정에 정해져 있으므로 로그인 시 다시 고를 필요가 없다
 *   — 로그인 성공 후 실제 서버 판정(checkIsEmployer, account_roles 기반
 *   — RequireEmployer.tsx와 동일한 신뢰 기준, user_metadata.role은 클라
 *   이언트가 스스로 바꿀 수 있어 신뢰하지 않음)으로 이동 위치를 정한다.
 */
export function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, loginWithZalo } = useAuth()
  const [searchParams] = useSearchParams()

  // 두 경로 다 지원: JobDetail의 "지원하기"는 navigate state(state.from)로 넘기고,
  // ReportButton/RequireAdmin/RequireEmployer는 URL의 ?redirect=로 넘긴다 — state가
  // 있으면 그걸 우선하고, 없으면 기존 쿼리파라미터 방식으로 그대로 fallback한다.
  const stateFrom = (location.state as { from?: string } | null)?.from
  const explicitRedirect = stateFrom || searchParams.get('redirect')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password.trim()) {
      setError('Vui lòng điền email và mật khẩu.')
      return
    }
    setLoading(true)
    const result = await login(email.trim(), password)
    if (!result.ok) {
      setLoading(false)
      setError('Email hoặc mật khẩu không đúng.')
      return
    }

    let target = explicitRedirect
    if (!target) {
      const { data } = await supabase.auth.getUser()
      const uid = data.user?.id
      const isEmployer = uid ? await checkIsEmployer(uid).catch(() => false) : false
      target = isEmployer ? '/bang-dieu-khien' : '/'
    }
    setLoading(false)
    navigate(target, { replace: true })
  }

  return (
    <div className="page page--narrow auth-page">
      <header className="page-header">
        <h1 className="page-header__title">Đăng nhập</h1>
        <p className="page-header__lead">Chào mừng bạn trở lại</p>
      </header>
      <form className="form-card" onSubmit={onSubmit} noValidate>
        {error && <p className="form-error" role="alert">{error}</p>}

        <label className="field">
          <span className="field__label">Email *</span>
          <input
            className="field__input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@email.com"
            autoComplete="email"
          />
        </label>

        <PasswordField
          label="Mật khẩu *"
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
          autoComplete="current-password"
        />
        <p className="auth-page__forgot">
          <Link to="/quen-mat-khau" className="text-link">Quên mật khẩu?</Link>
        </p>

        <button type="submit" className="btn btn--primary btn--block" disabled={loading}>
          {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>

        {import.meta.env.VITE_ZALO_APP_ID && (
          <>
            <div className="auth-divider"><span>hoặc</span></div>
            <button type="button" className="btn-zalo-login" onClick={loginWithZalo}>
              <ZaloIcon size={22} />
              Đăng nhập bằng Zalo
            </button>
          </>
        )}

        <p className="auth-page__footer">
          Chưa có tài khoản?{' '}
          <Link to="/dang-ky" className="text-link">
            Đăng ký
          </Link>
        </p>
      </form>
    </div>
  )
}
