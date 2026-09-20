import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

/**
 * 비밀번호 찾기 — 2026-09-20 사용자 지시("이메일로 등록" 게스트 공고
 * 등록 경로가 무작위 비밀번호로 계정을 만들기 때문에, 그 계정으로 나중에
 * 로그인하려면 비밀번호 재설정 기능이 반드시 있어야 함, 지금까지 이
 * 프로젝트에 아예 없던 기능이었음). supabase.auth.resetPasswordForEmail()
 * 이 보낸 링크를 열면 /dat-lai-mat-khau로 이동한다.
 *
 * 가입된 이메일인지 여부와 무관하게 항상 같은 성공 문구를 보여준다 —
 * "이 이메일은 가입 안 돼 있어요" 같은 에러를 따로 보여주면 그 자체가
 * 어떤 이메일이 가입돼 있는지 캐내는 수단이 될 수 있다(이메일 존재 여부
 * 열거 공격 방지, 업계 표준 관행).
 */
export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email.trim()) {
      setError('Vui lòng nhập email.')
      return
    }
    setLoading(true)
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/dat-lai-mat-khau`,
    })
    setLoading(false)
    setSent(true)
  }

  return (
    <div className="page page--narrow auth-page">
      <header className="page-header">
        <h1 className="page-header__title">Quên mật khẩu</h1>
        <p className="page-header__lead">Nhập email để nhận liên kết đặt lại mật khẩu</p>
      </header>

      {sent ? (
        <div className="form-card">
          <p>
            Nếu <strong>{email.trim()}</strong> có tài khoản, chúng tôi đã gửi một email chứa liên kết đặt lại
            mật khẩu. Vui lòng kiểm tra hộp thư (và thư mục spam).
          </p>
          <p className="auth-page__footer">
            <Link to="/dang-nhap" className="text-link">← Quay lại đăng nhập</Link>
          </p>
        </div>
      ) : (
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
          <button type="submit" className="btn btn--primary btn--block" disabled={loading}>
            {loading ? 'Đang gửi...' : 'Gửi liên kết đặt lại mật khẩu'}
          </button>
          <p className="auth-page__footer">
            <Link to="/dang-nhap" className="text-link">← Quay lại đăng nhập</Link>
          </p>
        </form>
      )}
    </div>
  )
}
