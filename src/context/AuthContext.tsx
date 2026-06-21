import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://edhuesdnuxlbcfephutq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkaHVlc2RudXhsYmNmZXBodXRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMDg5MTcsImV4cCI6MjA5NDU4NDkxN30.mnbMkGLy8UwFaOg6qdkDaV6DGZ2LyCSfOhJVB_48_HE'
)

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

  const value = useMemo(
    () => ({ user, loading, login, signup, logout }),
    [user, loading, login, signup, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}