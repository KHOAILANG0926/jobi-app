import { NavLink } from 'react-router-dom'
import { formatKoreaSalary, koreaJobDisplayLocation, koreaJobDisplayTitle } from '../../lib/koreaJobFormat'
import type { KoreaJob } from '../../types/koreaJob'

// KoreaJobs.tsx(목록)와 KoreaHome.tsx(진입 페이지)가 공유하는 카드.
// Vietnam Job의 JobCard(local_jobs 전용 Job 타입에 묶여 있어 재사용 불가)와
// 동일한 시각 리듬(.jc 스타일)을 따르는 .kjc 클래스를 그대로 쓴다.
export default function KoreaJobCard({ job }: { job: KoreaJob }) {
  const title = koreaJobDisplayTitle(job)
  const location = koreaJobDisplayLocation(job)
  const salary = formatKoreaSalary(job)
  const metaParts = [job.category, location, job.company].filter(Boolean) as string[]

  return (
    <NavLink to={`/viec-han-quoc/${job.id}`} className="kjc">
      <p className="kjc__meta">{metaParts.join(' · ')}</p>
      <h3 className="kjc__title">{title}</h3>
      <div className="kjc__footer">
        <span className="kjc__salary">{salary || 'Thỏa thuận'}</span>
        <span className="kjc__detail-btn">Xem chi tiết</span>
      </div>
    </NavLink>
  )
}
