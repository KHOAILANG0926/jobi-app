import { useState } from 'react'
import { useNavigate, Link, useSearchParams, useLocation } from 'react-router-dom'
import { useAuth, type UserRole } from '../context/AuthContext'
import { ZaloIcon } from '../components/ZaloIcon'

export function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, loginWithZalo } = useAuth()
  const [searchParams] = useSearchParams()

  const roleParam = searchParams.get('role') as UserRole | null
  // 두 경로 다 지원: JobDetail의 "지원하기"는 navigate state(state.from)로 넘기고,
  // ReportButton/RequireAdmin/RequireEmployer는 URL의 ?redirect=로 넘긴다 — state가
  // 있으면 그걸 우선하고, 없으면 기존 쿼리파라미터 방식으로 그대로 fallback한다.
  const stateFrom = (location.state as { from?: string } | null)?.from
  const redirectTo = stateFrom || searchParams.get('redirect') || (roleParam === 'employer' ? '/bang-dieu-khien' : '/')

  const [role, setRole] = useState<UserRole>(roleParam === 'employer' ? 'employer' : 'seeker')
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
    setLoading(false)
    if (!result.ok) {
      setError('Email hoặc mật khẩu không đúng.')
      return
    }
    navigate(redirectTo, { replace: true })
  }

  return (
    <div className="page page--narrow auth-page">
      <header className="page-header">
        <h1 className="page-header__title">Đăng nhập</h1>
        <p className="page-header__lead">Chào mừng bạn trở lại</p>
      </header>
      <form className="form-card" onSubmit={onSubmit} noValidate>
        {error && <p className="form-error" role="alert">{error}</p>}

        <fieldset className="role-picker">
          <legend className="role-picker__legend">Đăng nhập với tư cách</legend>
          <div className="role-picker__options" role="group">
            <button
              type="button"
              className={`role-picker__btn${role === 'seeker' ? ' role-picker__btn--active' : ''}`}
              onClick={() => setRole('seeker')}
            >
              🔍 Tìm việc
            </button>
            <button
              type="button"
              className={`role-picker__btn${role === 'employer' ? ' role-picker__btn--active' : ''}`}
              onClick={() => setRole('employer')}
            >
              🏢 Tuyển dụng
            </button>
          </div>
        </fieldset>

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

        <label className="field">
          <span className="field__label">Mật khẩu *</span>
          <input
            className="field__input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </label>

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
          <Link
            to={`/dang-ky?role=${role}`}
            className="text-link"
          >
            Đăng ký
          </Link>
        </p>
      </form>
    </div>
  )
}
