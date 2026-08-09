import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function ZaloCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const code = searchParams.get('code')
    const codeVerifier = sessionStorage.getItem('zalo_cv')
    const appId = import.meta.env.VITE_ZALO_APP_ID as string | undefined

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
        sessionStorage.removeItem('zalo_cv')
        if (!data.hashed_token) throw new Error(data.error ?? 'Token error')

        const { error } = await supabase.auth.verifyOtp({
          token_hash: data.hashed_token,
          type: 'magiclink',
        })
        if (error) throw error
        navigate('/', { replace: true })
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
