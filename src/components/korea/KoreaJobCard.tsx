import { NavLink } from 'react-router-dom'
import { Bookmark, BookmarkCheck } from 'lucide-react'
import { formatKoreaSalary, koreaJobDisplayLocation, koreaJobDisplayTitle } from '../../lib/koreaJobFormat'
import type { KoreaJob } from '../../types/koreaJob'

// KoreaJobs.tsx(목록)와 KoreaHome.tsx(진입 페이지)가 공유하는 카드.
// Vietnam Job의 JobCard(local_jobs 전용 Job 타입에 묶여 있어 재사용 불가)와
// 동일한 시각 리듬(.jc 스타일)을 따르는 .kjc 클래스를 그대로 쓴다.
interface KoreaJobCardProps {
  job: KoreaJob
  isSaved?: boolean
  onToggleSave?: (job: KoreaJob) => void
}

export default function KoreaJobCard({ job, isSaved, onToggleSave }: KoreaJobCardProps) {
  const title = koreaJobDisplayTitle(job)
  const location = koreaJobDisplayLocation(job)
  const salary = formatKoreaSalary(job)
  const metaParts = [job.category, location, job.company].filter(Boolean) as string[]

  return (
    <NavLink to={`/viec-han-quoc/${job.id}`} className="kjc">
      {onToggleSave && (
        // 카드 전체가 이미 상세 페이지로 가는 NavLink라, JobCard.tsx의 Zalo
        // 버튼과 같은 이유로 <a> 안에 <a>를 중첩하지 않기 위해 <button>을 쓰고
        // preventDefault/stopPropagation으로 카드 클릭(이동)과 분리한다.
        <button
          type="button"
          className={`kjc__save${isSaved ? ' kjc__save--active' : ''}`}
          aria-label={isSaved ? 'Bỏ lưu tin' : 'Lưu tin'}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onToggleSave(job)
          }}
        >
          {isSaved ? <BookmarkCheck size={16} strokeWidth={1.8} /> : <Bookmark size={16} strokeWidth={1.8} />}
        </button>
      )}
      <p className="kjc__meta">{metaParts.join(' · ')}</p>
      <h3 className="kjc__title">{title}</h3>
      <div className="kjc__footer">
        <span className="kjc__salary">{salary || 'Thỏa thuận'}</span>
        <span className="kjc__detail-btn">Xem chi tiết</span>
      </div>
    </NavLink>
  )
}
