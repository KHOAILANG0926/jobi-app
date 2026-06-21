import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
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
    navigate('/', { replace: true })
  }

  return (
    <div className="page page--narrow">
      <header className="page-header">
        <h1 className="page-header__title">Đăng nhập</h1>
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

        <div className="form-actions">
          <button type="submit" className="btn btn--primary" disabled={loading}>
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </div>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 14 }}>
          Chưa có tài khoản?{' '}
          <Link to="/dang-ky" style={{ color: '#e53e3e', fontWeight: 500 }}>Đăng ký</Link>
        </p>
      </form>
    </div>
  )
}