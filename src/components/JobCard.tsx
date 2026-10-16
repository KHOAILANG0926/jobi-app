import './JobCard.css'
import { useId, useState } from 'react'
import type { Job } from '../types/job'
import { companyLogoUrl } from '../lib/companyLogo'
import { formatDistanceLabel } from '../lib/jobCoords'
import { cardSalary } from '../lib/mainJobCards'
import { conditionBadges } from '../lib/jobConditions'

export function CompanyLogo({ company, imageUrl }: { company: string; imageUrl?: string; category?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  if (!imageUrl || failedUrl === imageUrl) return null
  return <img src={imageUrl} alt={company} className="jc__logo" loading="lazy" onError={() => setFailedUrl(imageUrl)} />
}

export function sanitizeSalary(salary: string): string {
  const m = salary.match(/(\d+[\.,]?\d*)\s*(?:triệu|tr)/i)
  if (m) {
    const val = parseFloat(m[1].replace(',', '.'))
    if (val > 200) return 'Thỏa thuận'
  }
  return salary
}

interface JobCardProps {
  job: Job
  isApplied: boolean
  onApply?: (job: Job) => void
  isSaved?: boolean
  onToggleSave?: (job: Job) => void
  rank?: number
  distanceKm?: number
  /** true = 검증된(location_verified) 정밀 거리 → "N km". false/undefined =
   *  근사 거리(2026-09-05 정책: 미검증 exact/ward 좌표도 거리검색 포함) →
   *  "~N km". */
  distancePrecise?: boolean
}

export default function JobCard({
  job, isApplied, distanceKm, distancePrecise,
}: JobCardProps) {
  const salary = cardSalary(job)
  const [expanded, setExpanded] = useState(false)
  const conditionsId = useId()
  const conditions = [job.hours, job.workDays, ...conditionBadges(job).map(badge => badge.label)]
    .filter((value): value is string => !!value)
  const imageUrl = companyLogoUrl(job.imageUrl)

  return (
    <article className={`jc${isApplied ? ' jc--applied' : ''}${expanded ? ' jc--expanded' : ''}`} data-job-id={job.id}>
      <div className="jc__header">
        <div className="jc__logo-wrap"><CompanyLogo company={job.company} imageUrl={imageUrl} /></div>
        <div className="jc__identity">
          <p className="jc__company">{job.company}</p>
          <p className="jc__meta">
            {job.location}
            {distanceKm !== undefined && ` · ${formatDistanceLabel(distanceKm, distancePrecise)}`}
          </p>
        </div>
      </div>
      <h3 className="jc__title">{job.title.toLowerCase().startsWith(job.company.toLowerCase() + ' ') ? job.title.slice(job.company.length).trim() : job.title}</h3>
      <div className="jc__footer">
        <span className="jc__salary">
          {salary ? salary.text : 'Chưa xác nhận tiền công'}
        </span>
      </div>
      {conditions.length > 0 && <>
        <button type="button" className="jc__conditions-toggle" aria-expanded={expanded} aria-controls={conditionsId}
          onClick={event => { event.preventDefault(); event.stopPropagation(); setExpanded(value => !value) }}>
          {expanded ? 'Thu gọn điều kiện' : 'Xem điều kiện làm việc'}
        </button>
        <ul id={conditionsId} className="jc__conditions">
          {[...new Set(conditions)].map(condition => <li key={condition}>{condition}</li>)}
        </ul>
      </>}
    </article>
  )
}
