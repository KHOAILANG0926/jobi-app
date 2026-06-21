import { useState } from 'react'
import { useNavigate, Link, Navigate } from 'react-router-dom'
import { useAuth, type UserRole } from '../context/AuthContext'

export function Signup() {
  const navigate = useNavigate()
  const { signup, user } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('seeker')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (user) {
    return <Navigate to={user.role === 'employer' ? '/bang-dieu-khien' : '/'} replace />
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Vui lòng điền đầy đủ thông tin.')
      return
    }
    if (password.length < 6) {
      setError('Mật khẩu tối thiểu 6 ký tự.')
      return
    }
    setLoading(true)
    const result = await signup(name.trim(), email.trim(), password, role)
    setLoading(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    navigate(role === 'employer' ? '/bang-dieu-khien' : '/', { replace: true })
  }

  return (
    <div className="page page--narrow auth-page">
      <header className="page-header">
        <h1 className="page-header__title">Việc gần Bạn</h1>
        <p className="page-header__lead">Tạo tài khoản miễn phí</p>
      </header>
      <form className="form-card" onSubmit={onSubmit} noValidate>
        {error && <p className="form-error" role="alert">{error}</p>}

        <fieldset className="role-picker">
          <legend className="role-picker__legend">Bạn là</legend>
          <div className="role-picker__options" role="group">
            <button type="button"
              className={`role-picker__btn${role === 'seeker' ? ' role-picker__btn--active' : ''}`}
              onClick={() => setRole('seeker')}>
              🔍 Tìm việc
            </button>
            <button type="button"
              className={`role-picker__btn${role === 'employer' ? ' role-picker__btn--active' : ''}`}
              onClick={() => setRole('employer')}>
              🏢 Tuyển dụng
            </button>
          </div>
        </fieldset>

        <label className="field">
          <span className="field__label">Họ và tên *</span>
          <input className="field__input" value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nguyễn Văn A" autoComplete="name" />
        </label>

        <label className="field">
          <span className="field__label">Email *</span>
          <input className="field__input" type="email" value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@email.com" autoComplete="email" />
        </label>

        <label className="field">
          <span className="field__label">Mật khẩu *</span>
          <input className="field__input" type="password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Tối thiểu 6 ký tự" autoComplete="new-password" />
        </label>

        <button type="submit" className="btn btn--primary btn--block" disabled={loading}>
          {loading ? 'Đang tạo tài khoản...' : 'Đăng ký'}
        </button>
        <p className="auth-page__footer">
          Đã có tài khoản?{' '}
          <Link to="/dang-nhap" className="text-link">Đăng nhập</Link>
        </p>
      </form>
    </div>
  )
}