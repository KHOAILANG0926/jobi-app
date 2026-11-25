import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, Eye, EyeOff } from 'lucide-react'
import { sanitizeInternalRedirect, useAuth, type UserRole } from '../../context/AuthContext'
import { checkIsEmployer } from '../../lib/accountRoles'
import { supabase } from '../../lib/supabase'

// 로그인·가입 — 웹과 같은 AuthContext(Supabase 인증)·같은 문구·같은 검사. 이동은 /app 안 경로만 허용(sanitizeInternalRedirect).
function PasswordInput({ label, value, onChange, autoComplete, placeholder }: { label: string; value: string; onChange: (v: string) => void; autoComplete: string; placeholder?: string }) {
  const [shown, setShown] = useState(false)
  return (
    <label className="app-field"><span>{label}</span>
      <span className="app-field__pw">
        <input type={shown ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} placeholder={placeholder} />
        <button type="button" className="app-icon-btn" aria-label={shown ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setShown((v) => !v)}>{shown ? <EyeOff size={20} aria-hidden /> : <Eye size={20} aria-hidden />}</button>
      </span>
    </label>
  )
}

function AuthBar({ title }: { title: string }) {
  const navigate = useNavigate()
  return <header className="app-pagebar"><button type="button" className="app-icon-btn" aria-label="Quay lại" onClick={() => navigate(-1)}><ChevronLeft size={24} aria-hidden /></button><h1 className="app-pagebar__title">{title}</h1></header>
}

export function LoginScreen() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [params] = useSearchParams()
  const redirect = sanitizeInternalRedirect(params.get('redirect'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password.trim()) { setError('Vui lòng điền email và mật khẩu.'); return }
    setBusy(true)
    const res = await login(email.trim(), password)
    if (!res.ok) { setBusy(false); setError('Email hoặc mật khẩu không đúng.'); return }
    let target = redirect
    if (!target) {
      // 역할은 클라이언트 값(user_metadata)이 아니라 서버 account_roles로 판정한다(웹 Login과 같음).
      const { data } = await supabase.auth.getUser()
      const uid = data.user?.id
      const isEmployer = uid ? await checkIsEmployer(uid).catch(() => false) : false
      target = isEmployer ? '/biz' : '/'
    }
    setBusy(false)
    navigate(target, { replace: true })
  }

  return (
    <div className="app-page" data-testid="app-login">
      <AuthBar title="Đăng nhập" />
      <form className="app-form" onSubmit={submit} noValidate>
        <p className="app-form__lead">Chào mừng bạn trở lại</p>
        {error && <p className="app-form__error" role="alert">{error}</p>}
        <label className="app-field"><span>Email *</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@email.com" autoComplete="email" /></label>
        <PasswordInput label="Mật khẩu *" value={password} onChange={setPassword} autoComplete="current-password" placeholder="••••••••" />
        <p className="app-form__aux"><a href="/quen-mat-khau">Quên mật khẩu?</a></p>
        <button type="submit" className="app-btn app-btn--primary app-btn--block" disabled={busy}>{busy ? 'Đang đăng nhập...' : 'Đăng nhập'}</button>
        <p className="app-form__foot">Chưa có tài khoản? <Link to={'/dang-ky' + (redirect ? `?redirect=${encodeURIComponent(redirect)}` : '')}>Đăng ký</Link></p>
      </form>
    </div>
  )
}

export function SignupScreen() {
  const navigate = useNavigate()
  const { signup, user } = useAuth()
  const [params] = useSearchParams()
  const roleParam = params.get('role')
  const redirect = sanitizeInternalRedirect(params.get('redirect'))
  const [role, setRole] = useState<UserRole>(roleParam === 'employer' ? 'employer' : 'seeker')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={user.role === 'employer' ? '/biz' : '/'} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) { setError('Vui lòng điền đầy đủ thông tin.'); return }
    if (password.length < 6) { setError('Mật khẩu tối thiểu 6 ký tự.'); return }
    if (password !== confirmPassword) { setError('Mật khẩu xác nhận không khớp.'); return }
    setBusy(true)
    const res = await signup(name.trim(), email.trim(), password, role)
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    navigate(role === 'employer' ? '/biz' : (redirect ?? '/'), { replace: true })
  }

  return (
    <div className="app-page" data-testid="app-signup">
      <AuthBar title="Đăng ký" />
      <form className="app-form" onSubmit={submit} noValidate>
        <div className="app-seg" role="group" aria-label="Loại tài khoản">
          <button type="button" className={role === 'seeker' ? 'app-on' : ''} aria-pressed={role === 'seeker'} onClick={() => setRole('seeker')}>Tìm việc làm</button>
          <button type="button" className={role === 'employer' ? 'app-on' : ''} aria-pressed={role === 'employer'} onClick={() => setRole('employer')}>Tuyển dụng</button>
        </div>
        {error && <p className="app-form__error" role="alert">{error}</p>}
        <label className="app-field"><span>Họ và tên *</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Văn A" autoComplete="name" /></label>
        <label className="app-field"><span>Email *</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@email.com" autoComplete="email" /></label>
        <PasswordInput label="Mật khẩu *" value={password} onChange={setPassword} autoComplete="new-password" placeholder="Tối thiểu 6 ký tự" />
        <PasswordInput label="Xác nhận mật khẩu *" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" placeholder="Nhập lại mật khẩu" />
        <button type="submit" className="app-btn app-btn--primary app-btn--block" disabled={busy}>{busy ? 'Đang tạo tài khoản...' : role === 'seeker' ? 'Đăng ký tìm việc' : 'Đăng ký tuyển dụng'}</button>
        <p className="app-form__foot">Đã có tài khoản? <Link to={'/dang-nhap' + (redirect ? `?redirect=${encodeURIComponent(redirect)}` : '')}>Đăng nhập</Link></p>
      </form>
    </div>
  )
}
