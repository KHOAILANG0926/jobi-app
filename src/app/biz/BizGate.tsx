import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { checkIsEmployer } from '../../lib/accountRoles'

// 기업 화면 입구 — 웹 RequireEmployer와 같은 기준: 화면 접근은 클라이언트 값(user_metadata.role)이 아니라 서버 account_roles로 판정한다.
// 조회 실패와 '기업 아님'을 구분해 안내한다.
export default function BizGate({ children }: { children: (userId: string) => ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [state, setState] = useState<'checking' | 'yes' | 'no' | 'error'>('checking')

  useEffect(() => {
    if (!user) { setState('checking'); return }
    let cancelled = false
    setState('checking')
    checkIsEmployer(user.id).then((ok) => { if (!cancelled) setState(ok ? 'yes' : 'no') }).catch(() => { if (!cancelled) setState('error') })
    return () => { cancelled = true }
  }, [user?.id])

  if (loading || (user && state === 'checking')) return <p className="app-state" role="status">Đang tải…</p>
  if (!user) {
    return (
      <div className="app-page" data-testid="app-biz-login"><header className="app-pagebar"><h1 className="app-pagebar__title">Nhà tuyển dụng</h1></header>
        <div className="app-menu__login"><p>Đăng nhập tài khoản nhà tuyển dụng để đăng tin và quản lý ứng viên</p>
          <div><Link className="app-btn app-btn--primary" to={'/dang-nhap?redirect=' + encodeURIComponent(location.pathname)}>Đăng nhập</Link><Link className="app-btn app-btn--ghost" to="/dang-ky?role=employer">Đăng ký tuyển dụng</Link></div></div>
      </div>
    )
  }
  if (state === 'error') return <div className="app-page"><header className="app-pagebar"><h1 className="app-pagebar__title">Nhà tuyển dụng</h1></header><p className="app-state" role="alert">Không kiểm tra được quyền nhà tuyển dụng lúc này. Vui lòng thử lại.</p></div>
  if (state === 'no') return <div className="app-page" data-testid="app-biz-denied"><header className="app-pagebar"><h1 className="app-pagebar__title">Nhà tuyển dụng</h1></header><p className="app-state">Tài khoản này không phải tài khoản nhà tuyển dụng.</p><Link to="/" className="app-more">Về trang chủ</Link></div>
  return <>{children(user.id)}</>
}
