import { useState } from 'react'
import { useNavigate, Link, Navigate, useSearchParams } from 'react-router-dom'
import { useAuth, type UserRole } from '../context/AuthContext'

export function Signup() {
  const navigate = useNavigate()
  const { signup, user } = useAuth()
  const [searchParams] = useSearchParams()

  const roleParam = searchParams.get('role') as UserRole | null
  const redirectTo = searchParams.get('redirect') || (roleParam === 'employer' ? '/bang-dieu-khien' : '/')

  const [step, setStep] = useState<'choose' | 'form'>(roleParam ? 'form' : 'choose')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>(roleParam === 'employer' ? 'employer' : 'seeker')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (user) {
    return <Navigate to={user.role === 'employer' ? '/bang-dieu-khien' : '/'} replace />
  }

  const chooseRole = (r: UserRole) => {
    setRole(r)
    setStep('form')
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
    navigate(role === 'employer' ? redirectTo : '/', { replace: true })
  }

  if (step === 'choose') {
    return (
      <div className="signup-choose">
        <div className="signup-choose__head">
          <h1 className="signup-choose__title">Việt Gần Bạn</h1>
          <p className="signup-choose__sub">Tạo tài khoản miễn phí và bắt đầu ngay hôm nay</p>
        </div>

        <div className="signup-choose__cards">
          <button className="signup-role-card signup-role-card--seeker" onClick={() => chooseRole('seeker')}>
            <h2 className="signup-role-card__title">Tìm việc làm</h2>
            <p className="signup-role-card__desc">Đăng CV và tìm việc làm phù hợp với bạn</p>
            <div className="signup-role-card__mascot">
              <img src="/mascot.svg" alt="mascot" />
            </div>
            <span className="signup-role-card__btn signup-role-card__btn--seeker">
              Đăng ký tìm việc
            </span>
          </button>

          <button className="signup-role-card signup-role-card--employer" onClick={() => chooseRole('employer')}>
            <h2 className="signup-role-card__title">Tuyển dụng</h2>
            <p className="signup-role-card__desc">Đăng tin tuyển dụng và tìm nhân tài</p>
            <div className="signup-role-card__mascot">
              <img src="/mascot.svg" alt="mascot employer" style={{ filter: 'hue-rotate(200deg)' }} />
            </div>
            <span className="signup-role-card__btn signup-role-card__btn--employer">
              Đăng ký tuyển dụng
            </span>
          </button>
        </div>

        <div className="signup-choose__footer">
          <span>Đã có tài khoản?</span>
          <Link to="/dang-nhap" className="text-link">Đăng nhập ngay →</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page page--narrow auth-page">
      <header className="page-header">
        <h1 className="page-header__title">
          {role === 'seeker' ? 'Đăng ký tìm việc' : 'Đăng ký tuyển dụng'}
        </h1>
        <p className="page-header__lead">
          <button className="text-link" onClick={() => setStep('choose')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'inherit' }}>
            ← Quay lại
          </button>
        </p>
      </header>
      <form className="form-card" onSubmit={onSubmit} noValidate>
        {error && <p className="form-error" role="alert">{error}</p>}

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

        <button
          type="submit"
          className="btn btn--block"
          style={{ background: role === 'seeker' ? '#e53935' : '#222', color: '#fff', fontWeight: 700, fontSize: '1rem', padding: '0.85rem' }}
          disabled={loading}
        >
          {loading ? 'Đang tạo tài khoản...' : role === 'seeker' ? 'Đăng ký tìm việc' : 'Đăng ký tuyển dụng'}
        </button>
        <p className="auth-page__footer">
          Đã có tài khoản?{' '}
          <Link to="/dang-nhap" className="text-link">Đăng nhập</Link>
        </p>
      </form>
    </div>
  )
}
