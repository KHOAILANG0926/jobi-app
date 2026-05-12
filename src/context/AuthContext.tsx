import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { AuthUser, UserRole } from '../types/auth'
import {
  authenticate,
  clearSession,
  loadSession,
  registerAccount,
} from '../lib/authStorage'

interface AuthContextValue {
  user: AuthUser | null
  login: (
    phone: string,
    password: string,
  ) => { ok: true; user: AuthUser } | { ok: false; error: string }
  signup: (
    name: string,
    phone: string,
    password: string,
    role: UserRole,
  ) => { ok: true } | { ok: false; error: string }
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => loadSession())

  const login = useCallback((phone: string, password: string) => {
    const result = authenticate(phone, password)
    if (result.ok) {
      setUser(result.user)
      return { ok: true as const, user: result.user }
    }
    return result
  }, [])

  const signup = useCallback(
    (name: string, phone: string, password: string, role: UserRole) => {
      const reg = registerAccount(name, phone, password, role)
      if (!reg.ok) return reg
      const auth = authenticate(phone, password)
      if (auth.ok) {
        setUser(auth.user)
        return { ok: true as const }
      }
      return { ok: false, error: 'Đăng ký thành công nhưng đăng nhập thất bại.' }
    },
    [],
  )

  const logout = useCallback(() => {
    clearSession()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, login, signup, logout }),
    [user, login, signup, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
