import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PasswordField } from '../components/PasswordField'

/**
 * 비밀번호 재설정 확인 화면 — ForgotPassword.tsx가 보낸 이메일 링크나,
 * "이메일로 등록"(게스트 없이 계정 자동 생성) 직후 시스템이 보내는 "비밀번호
 * 설정" 링크 둘 다 이 페이지로 온다. supabase-js는 URL의 recovery 토큰을
 * 자동으로 감지해 임시 세션을 만든다(detectSessionInUrl 기본값) — 그 세션이
 * 있어야만 새 비밀번호를 설정할 수 있으므로, 세션이 없으면(링크가 잘못됐거나
 * 만료됨) 새 비밀번호 폼 대신 안내 문구를 보여준다.
 */
export default function ResetPassword() {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [hasRecoverySession, setHasRecoverySession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasRecoverySession(!!data.session)
      setChecking(false)
    })
  }, [])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('Mật khẩu tối thiểu 6 ký tự.')
      return
    }
    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.')
      return
    }
    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setDone(true)
  }

  if (checking) return null

  return (
    <div className="page page--narrow auth-page">
      <header className="page-header">
        <h1 className="page-header__title">Đặt lại mật khẩu</h1>
      </header>

      {done ? (
        <div className="form-card">
          <p>Đặt lại mật khẩu thành công! Bây giờ bạn có thể dùng mật khẩu mới để đăng nhập.</p>
          <button type="button" className="btn btn--primary btn--block" onClick={() => navigate('/bang-dieu-khien')}>
            Vào trang quản lý
          </button>
        </div>
      ) : !hasRecoverySession ? (
        <div className="form-card">
          <p className="form-error" role="alert">
            Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu liên kết mới.
          </p>
          <button type="button" className="btn btn--primary btn--block" onClick={() => navigate('/quen-mat-khau')}>
            Yêu cầu liên kết mới
          </button>
        </div>
      ) : (
        <form className="form-card" onSubmit={onSubmit} noValidate>
          {error && <p className="form-error" role="alert">{error}</p>}
          <PasswordField
            label="Mật khẩu mới *"
            value={password}
            onChange={setPassword}
            placeholder="Tối thiểu 6 ký tự"
            autoComplete="new-password"
          />
          <PasswordField
            label="Xác nhận mật khẩu mới *"
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="Nhập lại mật khẩu"
            autoComplete="new-password"
          />
          <button type="submit" className="btn btn--primary btn--block" disabled={loading}>
            {loading ? 'Đang lưu...' : 'Đặt lại mật khẩu'}
          </button>
        </form>
      )}
    </div>
  )
}
