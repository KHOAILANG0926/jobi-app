import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { sanitizeInternalRedirect } from '../context/AuthContext'

export function ZaloCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    // 2026-09-26 보안 검토 — 성공/취소/실패 경로 전부에서 1회용 인증정보가
    // sessionStorage에 남지 않도록, 읽는 즉시(가드 실패로 조기 종료하는
    // 경우까지 포함해서) 전부 제거한다. 이전엔 zalo_redirect가 성공 경로
    // 끝에서만 지워져서, Zalo 동의 화면에서 취소하거나(code 없이 콜백) 토큰
    // 교환이 실패하면 zalo_cv/zalo_redirect가 그대로 남아있었다.
    const code = searchParams.get('code')
    const returnedState = searchParams.get('state')
    const codeVerifier = sessionStorage.getItem('zalo_cv')
    const savedState = sessionStorage.getItem('zalo_state')
    const redirectTo = sanitizeInternalRedirect(sessionStorage.getItem('zalo_redirect'))
    sessionStorage.removeItem('zalo_cv')
    sessionStorage.removeItem('zalo_state')
    sessionStorage.removeItem('zalo_redirect')

    const appId = import.meta.env.VITE_ZALO_APP_ID as string | undefined

    if (!returnedState || !savedState || returnedState !== savedState) {
      setErrorMsg('Xác thực Zalo thất bại. Phiên đăng nhập không hợp lệ, vui lòng thử lại.')
      setStatus('error')
      return
    }

    if (!code || !codeVerifier || !appId) {
      setErrorMsg('Xác thực Zalo thất bại. Thiếu thông tin.')
      setStatus('error')
      return
    }

    fetch('/api/zalo-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, code_verifier: codeVerifier, app_id: appId }),
    })
      .then(r => r.json())
      .then(async (data: { hashed_token?: string; error?: string }) => {
        if (!data.hashed_token) throw new Error(data.error ?? 'Token error')

        const { error } = await supabase.auth.verifyOtp({
          token_hash: data.hashed_token,
          type: 'magiclink',
        })
        if (error) throw error
        navigate(redirectTo || '/', { replace: true })
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Đăng nhập Zalo thất bại.'
        setErrorMsg(msg)
        setStatus('error')
      })
  }, [])

  if (status === 'error') {
    return (
      <div className="page page--narrow auth-page">
        <header className="page-header">
          <h1 className="page-header__title">Đăng nhập Zalo</h1>
        </header>
        <div className="form-card">
          <p className="form-error" role="alert">{errorMsg}</p>
          <button className="btn btn--primary btn--block" onClick={() => navigate('/dang-nhap')}>
            Quay lại đăng nhập
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page page--narrow auth-page">
      <header className="page-header">
        <h1 className="page-header__title">Đang xác thực...</h1>
        <p className="page-header__lead">Vui lòng chờ trong giây lát</p>
      </header>
    </div>
  )
}
