import { Navigate, useLocation } from 'react-router-dom'

/** 예전 주소를 새 주소로 넘기되 ?province= 같은 조건은 그대로 가져간다. */
export function RedirectKeepSearch({ to }: { to: string }) {
  const { search, hash } = useLocation()
  return <Navigate to={`${to}${search}${hash}`} replace />
}
