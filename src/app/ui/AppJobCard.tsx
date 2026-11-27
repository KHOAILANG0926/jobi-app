import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bookmark, MapPin } from 'lucide-react'
import { useBrandsOptional } from '../../context/BrandsContext'
import { industryPhotoUrl } from '../../lib/cardPhoto'
import { cardCompanyParts, cardTitle } from '../../lib/cardText'
import { cardThumbnailUrl, jobRepresentativeImageUrl } from '../../lib/companyLogo'
import { conditionBadges } from '../../lib/jobConditions'
import { formatDistanceLabel } from '../../lib/jobCoords'
import { cardSalary, PAY_LABELS } from '../../lib/mainJobCards'
import { shortArea } from '../../lib/shortArea'
import type { Job } from '../../types/job'
import { appApplyButton } from '../data/applyAction'

// 앱 공고 카드(V3 시안). 값은 모두 웹 카드와 같은 lib 함수에서 만든다: 대표 이미지 순서(브랜드 로고 → 공고 사진 → 웹사이트 아이콘 → 업종 사진),
// 회사·지점·제목 정리, 급여 한 줄(단위 색 + 금액), 확인된 조건 배지. 가짜 값은 채우지 않는다 — 없으면 그 줄을 숨긴다.
function Thumb({ job }: { job: Job }) {
  const brands = useBrandsOptional()
  const url = jobRepresentativeImageUrl(job, brands)
  const photo = industryPhotoUrl(job.category, job.subcategory, `${job.company} ${job.title}`, job.description)
  const [failed, setFailed] = useState<string[]>([])
  const src = [cardThumbnailUrl(url), url, photo].find((u): u is string => !!u && !failed.includes(u))
  return (
    <div className="app-card__thumb">
      {src
        ? <img src={src} alt="" loading="lazy" onError={() => setFailed((f) => [...f, src])} />
        : <span className="app-card__thumb-text">{job.company?.trim().slice(0, 2) || 'VL'}</span>}
    </div>
  )
}

export default function AppJobCard({ job, saved, onToggleSave, distanceKm, reason }: { job: Job; saved?: boolean; onToggleSave?: (id: string) => void; distanceKm?: number; reason?: string }) {
  const salary = cardSalary(job)
  const parts = cardCompanyParts(job.company, shortArea(job.location))
  const badges = conditionBadges(job).slice(0, 3)
  const action = appApplyButton(job)
  return (
    <article className="app-card" data-job-id={job.id}>
      <Link to={`/viec-lam/${job.id}`} className="app-card__link" aria-label={`${parts.name} — ${cardTitle(job.title, job.company)}`}>
        <Thumb job={job} />
        <div className="app-card__body">
          <p className="app-card__company">{parts.name}</p>
          <h3 className="app-card__title">{job.urgent && <span className="app-badge-urgent">Tuyển gấp</span>}{cardTitle(job.title, job.company)}</h3>
          {salary && !salary.lines && (
            <p className="app-card__salary">
              {(salary.kind ?? 'other') !== 'other' && <span className="app-pay-tag">{PAY_LABELS[salary.kind ?? 'other']}</span>}
              <span className="app-pay-amount">{salary.text}</span>
            </p>
          )}
          {salary?.lines && <p className="app-card__salary app-card__salary--note">Lương theo vị trí — xem chi tiết</p>}
          <p className="app-card__meta"><MapPin size={13} aria-hidden />{parts.place}{distanceKm !== undefined && ` · ${formatDistanceLabel(distanceKm, false)}`}</p>
          {(badges.length > 0 || reason) && (
            <p className="app-card__tags">
              {reason && <span className="app-tag app-tag--reason">{reason}</span>}
              {badges.map((b) => <span key={b.key} className="app-tag">{b.label}</span>)}
            </p>
          )}
        </div>
      </Link>
      {onToggleSave && (
        <button type="button" className={'app-card__save' + (saved ? ' app-on' : '')} aria-pressed={!!saved} aria-label={saved ? 'Bỏ lưu tin' : 'Lưu tin'} onClick={() => onToggleSave(job.id)}>
          <Bookmark size={22} aria-hidden fill={saved ? 'currentColor' : 'none'} />
        </button>
      )}
      {action.kind === 'internal' && <Link to={`/viec-lam/${job.id}`} className="app-card__action">{action.label}</Link>}
      {action.kind === 'contact' && <a href={action.href} className="app-card__action">{action.label}</a>}
    </article>
  )
}
