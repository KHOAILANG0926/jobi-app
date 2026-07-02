import { useState } from 'react'
import type { Job } from '../types/job'

const LOGO_PALETTE = [
  '#E53935','#1565C0','#2E7D32','#F57C00',
  '#6A1B9A','#00838F','#AD1457','#37474F',
]

function logoColor(name: string): string {
  let h = 5381
  for (const c of name) h = ((h << 5) + h + c.charCodeAt(0)) & 0x7fffffff
  return LOGO_PALETTE[Math.abs(h) % LOGO_PALETTE.length]
}

const FAVICON_DOMAINS: Record<string, string> = {
  'Highlands Coffee': 'highlandscoffee.com.vn',
  'GrabFood': 'grab.com',
  'Grab': 'grab.com',
  'Circle K': 'circlek.com',
  'Starbucks': 'starbucks.com',
  'KFC': 'kfc.com',
  'Shopee': 'shopee.vn',
  'WinMart': 'winmart.vn',
  'Lotteria': 'lotteria.com',
  'FamilyMart': 'familymart.com',
  'Samsung': 'samsung.com',
  "McDonald's": 'mcdonalds.com',
  'Baemin': 'baemin.vn',
}

function CompanyLogo({ company, imageUrl }: { company: string; imageUrl?: string }) {
  const [failed, setFailed] = useState(false)
  const domain = FAVICON_DOMAINS[company]

  if (imageUrl && !failed) {
    return (
      <img
        src={imageUrl}
        alt=""
        className="jc__logo-img"
        onError={() => setFailed(true)}
      />
    )
  }

  if (domain && !failed) {
    return (
      <img
        src={`https://www.google.com/s2/favicons?sz=64&domain=${domain}`}
        alt=""
        className="jc__logo-img"
        onError={() => setFailed(true)}
      />
    )
  }

  return (
    <span className="jc__logo-text" style={{ color: logoColor(company) }}>
      {company}
    </span>
  )
}

const CATEGORY_TAGS: Record<string, string> = {
  factory: 'Nhà máy',
  cafe: 'Cafe',
  delivery: 'Giao hàng',
  cleaning: 'Vệ sinh',
  retail: 'Bán lẻ',
  other: 'Việc làm',
}

function jobTags(job: Job): string[] {
  const tags: string[] = []
  if (job.urgent) tags.push('Khẩn cấp')
  const catTag = CATEGORY_TAGS[job.category]
  if (catTag) tags.push(catTag)
  const h = (job.hours ?? '').toLowerCase()
  if (h.includes('part-time')) tags.push('Part-time')
  if (h.includes('full-time')) tags.push('Full-time')
  return tags.slice(0, 3)
}

interface JobCardProps {
  job: Job
  isApplied: boolean
  onApply: (job: Job) => void
  isSaved?: boolean
  onToggleSave?: (job: Job) => void
  rank?: number
  distanceKm?: number
}

export default function JobCard({
  job, isApplied, isSaved, onToggleSave, distanceKm,
}: JobCardProps) {
  const tags = jobTags(job)
  return (
    <article className={`jc${isApplied ? ' jc--applied' : ''}`}>
      <div className="jc__logo-area">
        <CompanyLogo company={job.company} imageUrl={job.imageUrl} />
      </div>

      {tags.length > 0 && (
        <p className="jc__tags">{tags.map(t => `#${t}`).join(' ')}</p>
      )}

      <p className="jc__meta">
        {job.company} <span className="jc__dot">·</span> {job.location}
      </p>

      <h3 className="jc__title">{job.title}</h3>

      {distanceKm !== undefined && (
        <p className="jc__dist">📍 {distanceKm.toFixed(1)}km</p>
      )}

      <div className="jc__footer">
        <span className="jc__salary">
          <span className="jc__salary-type">
            {job.salary.toLowerCase().includes('giờ') ? 'Giờ' :
             job.salary.toLowerCase().includes('ngày') ? 'Ngày' :
             job.salary.toLowerCase().includes('tháng') ? 'Tháng' : '₩'}
          </span>
          {' '}{job.salary.replace(/\/(giờ|ngày|tháng)/i, '').trim()}
        </span>
        {onToggleSave && (
          <button
            type="button"
            className={`jc__save${isSaved ? ' jc__save--on' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleSave(job) }}
            aria-label={isSaved ? 'Bỏ lưu' : 'Lưu tin'}
          >
            +
          </button>
        )}
      </div>
      {job.source && (
        <span className="jc__source">Nguồn: {job.source}</span>
      )}
    </article>
  )
}
