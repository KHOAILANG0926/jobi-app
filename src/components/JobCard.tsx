import './JobCard.css'
import { useId, useState } from 'react'
import type { Job } from '../types/job'
import { companyLogoUrl } from '../lib/companyLogo'
import { formatDistanceLabel } from '../lib/jobCoords'
import { cardSalary, PAY_LABELS, type PayKind } from '../lib/mainJobCards'

function PayLine({ kind, text, block }: { kind: PayKind; text: string; block?: boolean }) {
  return (
    <span className="jc__pay" style={block ? { display: 'block' } : undefined}>
      {kind !== 'other' && <><span className={`jc__pay-label jc__pay-label--${kind}`}>{PAY_LABELS[kind]}</span> </>}<span className="jc__pay-amount">{text}</span>
    </span>
  )
}
import { conditionBadges } from '../lib/jobConditions'

export function CompanyLogo({ company, imageUrl }: { company: string; imageUrl?: string; category?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  if (!imageUrl || failedUrl === imageUrl) return <span className="jc__logo-text" aria-label={company}>{company?.trim() || "Việc làm"}</span>
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
        {/* 2026-11-01 Lee(알바몬): 지급 단위 이름표에 색(월급 빨강·시급/연봉 파랑·일급 보라), 금액은 회색 */}
        <span className="jc__salary">
          {salary?.lines ? salary.lines.map((line, i) => <PayLine key={line} kind={salary.lineKinds?.[i] ?? 'other'} text={line} block />)
            : salary ? <PayLine kind={salary.kind ?? 'other'} text={salary.text} /> : <span className="jc__pay-amount">Chưa xác nhận tiền công</span>}
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
