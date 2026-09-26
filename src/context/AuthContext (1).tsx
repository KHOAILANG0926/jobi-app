import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '../lib/supabase'

export type UserRole = 'seeker' | 'employer'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: UserRole
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>
  signup: (name: string, email: string, password: string, role: UserRole) => Promise<{ ok: true } | { ok: false; error: string }>
  logout: () => Promise<void>
  loginWithZalo: (redirectTo?: string) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user
      if (u) {
        setUser({
          id: u.id,
          email: u.email ?? '',
          name: u.user_metadata?.name ?? '',
          role: u.user_metadata?.role ?? 'seeker',
        })
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user
      if (u) {
        setUser({
          id: u.id,
          email: u.email ?? '',
          name: u.user_metadata?.name ?? '',
          role: u.user_metadata?.role ?? 'seeker',
        })
      } else {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { ok: false as const, error: error.message }
    return { ok: true as const }
  }, [])

  const signup = useCallback(async (name: string, email: string, password: string, role: UserRole) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, role } },
    })
    if (error) return { ok: false as const, error: error.message }
    return { ok: true as const }
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
  }, [])

  const loginWithZalo = useCallback((redirectTo?: string) => {
    const appId = import.meta.env.VITE_ZALO_APP_ID as string | undefined
    if (!appId) { alert('Zalo App ID chưa được cấu hình.'); return }

    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    const codeVerifier = btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    sessionStorage.setItem('zalo_cv', codeVerifier)
    // Zalo OAuth v4는 state 파라미터가 필수(-14036 "State was required").
    // CSRF 방지용으로 무작위 값을 만들어 두고 ZaloCallback.tsx에서 대조한다.
    const stateArr = new Uint8Array(16)
    crypto.getRandomValues(stateArr)
    const state = Array.from(stateArr, b => b.toString(16).padStart(2, '0')).join('')
    sessionStorage.setItem('zalo_state', state)
    // 로그인 시작 전 있던 화면으로 콜백 후 돌아가기 위한 값 — Zalo OAuth는
    // 브라우저가 실제로 페이지를 떠났다 돌아오므로(이메일 로그인과 달리
    // React state로 못 넘김), code_verifier와 같은 방식(sessionStorage)으로
    // 들고 있다가 ZaloCallback.tsx가 읽어서 navigate한다. 없으면 콜백이 '/'로
    // fallback.
    if (redirectTo) sessionStorage.setItem('zalo_redirect', redirectTo)
    else sessionStorage.removeItem('zalo_redirect')

    crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier)).then(buf => {
      const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(buf)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
      const redirectUri = encodeURIComponent(`${window.location.origin}/zalo-callback`)
      window.location.href =
        `https://oauth.zaloapp.com/v4/permission?app_id=${appId}&redirect_uri=${redirectUri}` +
        `&code_challenge=${codeChallenge}&code_challenge_method=S256&state=${state}`
    })
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, signup, logout, loginWithZalo }),
    [user, loading, login, signup, logout, loginWithZalo],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}