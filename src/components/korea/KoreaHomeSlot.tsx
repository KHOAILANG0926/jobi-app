import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { fetchKoreaJobs } from '../../lib/koreaJobsApi'

/** The Vietnam home consumes a small Korea-owned slot, never Korea job fields. */
export default function KoreaHomeSlot() {
  const [available, setAvailable] = useState(false)
  useEffect(() => {
    let active = true
    void fetchKoreaJobs().then(jobs => { if (active) setAvailable(jobs.length > 0) })
    return () => { active = false }
  }, [])
  if (!available) return null
  return <NavLink className="home-korea-slot" to="/viec-han-quoc">
    <span aria-hidden>🇰🇷</span><span><strong>Việc làm tại Hàn Quốc</strong><small>Khám phá cơ hội việc làm</small></span><span aria-hidden>→</span>
  </NavLink>
}
