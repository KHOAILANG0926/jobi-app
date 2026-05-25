import { FormEvent, useState } from 'react'
import { Link, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function Login() {
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const from = (location.state as { from?: string } | null)?.from

  if (user) {
    return <Navigate to={user.role === 'employer' ? '/bang-dieu-khien' : '/'} replace />
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const result = login(phone, password)
    if (!result.ok) {
      setError(result.error)
      return
    }
    if (from) {
      navigate(from, { replace: true })
      return
    }
    navigate(result.user.role === 'employer' ? '/bang-dieu-khien' : '/', { replace: true })
  }

  return (
    <div className="page page--narrow auth-page">
      <header className="page-header">
        <h1 className="page-header__title">Đăng nhập</h1>
        <p className="page-header__lead">Chào mừng bạn quay lại Việc gần Bạn.</p>
      </header>

      <form className="form-card" onSubmit={onSubmit}>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <label className="field">
          <span className="field__label">Số điện thoại</span>
          <input
            className="field__input"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0900 000 000"
            required
          />
        </label>
        <label className="field">
          <span className="field__label">
            Mật khẩu <span style={{ color: '#999', fontWeight: 400, fontSize: '13px' }}>(nếu có)</span>
          </span>
          <input
            className="field__input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Để trống nếu không có mật khẩu"
          />
        </label>
        <button type="submit" className="btn btn--primary btn--block">
          Đăng nhập
        </button>
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
