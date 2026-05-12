import { FormEvent, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { UserRole } from '../types/auth'

export function Signup() {
  const { signup, user } = useAuth()
  const navigate = useNavigate()
  const [role, setRole] = useState<UserRole>('seeker')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (user) {
    return <Navigate to={user.role === 'employer' ? '/bang-dieu-khien' : '/'} replace />
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const result = signup(name, phone, password, role)
    if (!result.ok) {
      setError(result.error)
      return
    }
    navigate(role === 'employer' ? '/bang-dieu-khien' : '/', { replace: true })
  }

  return (
    <div className="page page--narrow auth-page">
      <header className="page-header">
        <h1 className="page-header__title">Đăng ký</h1>
        <p className="page-header__lead">Tạo tài khoản Jobi để tìm việc hoặc tuyển dụng.</p>
      </header>

      <form className="form-card" onSubmit={onSubmit}>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        <fieldset className="role-picker">
          <legend className="role-picker__legend">Bạn là</legend>
          <div className="role-picker__options" role="group">
            <button
              type="button"
              className={`role-picker__btn${role === 'seeker' ? ' role-picker__btn--active' : ''}`}
              onClick={() => setRole('seeker')}
            >
              Tìm việc
            </button>
            <button
              type="button"
              className={`role-picker__btn${role === 'employer' ? ' role-picker__btn--active' : ''}`}
              onClick={() => setRole('employer')}
            >
              Tuyển dụng
            </button>
          </div>
        </fieldset>

        <label className="field">
          <span className="field__label">Họ và tên</span>
          <input
            className="field__input"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
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
          <span className="field__label">Mật khẩu (tối thiểu 6 ký tự)</span>
          <input
            className="field__input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </label>

        <button type="submit" className="btn btn--primary btn--block">
          Đăng ký
        </button>
        <p className="auth-page__footer">
          Đã có tài khoản?{' '}
          <Link to="/dang-nhap" className="text-link">
            Đăng nhập
          </Link>
        </p>
      </form>
    </div>
  )
}
