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
import { shortArea } from '../lib/shortArea'

export function CompanyLogo({ company, imageUrl }: { company: string; imageUrl?: string; category?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  // 2026-11-01 Lee(알바몬): 로고 칸에는 그림만 — 사진이 없으면 회사 이름 첫 글자 칸(이름 글자는 아래 한 줄에만).
  if (!imageUrl || failedUrl === imageUrl) return <span className="jc__logo-initial" aria-label={company}>{(company?.trim() || 'V').charAt(0).toLocaleUpperCase('vi')}</span>
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

  const area = shortArea(job.location)
  const identity = [job.company?.trim(), area].filter(Boolean).join(' · ')

  // 2026-11-01 Lee(알바몬 카드 구성): ① 로고 그림만 ② 회사 · 동/성 (작은 회색 한 줄) ③ 제목(보통 굵기, 2줄) ④ 급여 한 줄(단위 색 + 회색 금액).
  // 직무가 여럿이거나 금액이 없으면 회색 안내 한 줄. 카드 위 유료 그라데이션 띠는 그대로(감싸는 칸이 그림).
  return (
    <article className={`jc jc--alba${isApplied ? ' jc--applied' : ''}${expanded ? ' jc--expanded' : ''}`} data-job-id={job.id}>
      <div className="jc__header">
        <div className="jc__logo-wrap"><CompanyLogo company={job.company} imageUrl={imageUrl} /></div>
      </div>
      <p className="jc__identity">
        {identity}
        {distanceKm !== undefined && ` · ${formatDistanceLabel(distanceKm, distancePrecise)}`}
      </p>
      <h3 className="jc__title">{job.title.toLowerCase().startsWith(job.company.toLowerCase() + ' ') ? job.title.slice(job.company.length).trim() : job.title}</h3>
      <div className="jc__footer">
        <span className="jc__salary">
          {salary && !salary.lines ? <PayLine kind={salary.kind ?? 'other'} text={salary.text} />
            : <span className="jc__pay-amount jc__pay-amount--none">₫ {salary?.lines ? 'Xem lương theo vị trí' : 'Xem trong tin tuyển dụng'}</span>}
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
