import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { ReactNode } from 'react'

export function RequireEmployer({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    return (
      <Navigate
        to={`/dang-nhap?role=employer&redirect=${encodeURIComponent(location.pathname)}`}
        replace
      />
    )
  }
  if (user.role !== 'employer') {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}