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

function logoInitials(name: string): string {
  const parts = name.trim().replace(/[()[\]]/g, '').split(/[\s·\-–—]+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
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

function CompanyLogo({ company }: { company: string }) {
  const [failed, setFailed] = useState(false)
  const domain = FAVICON_DOMAINS[company]

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
    <span className="jc__logo-text" style={{ background: logoColor(company) }}>
      {logoInitials(company)}
    </span>
  )
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
  return (
    <article className={`jc${isApplied ? ' jc--applied' : ''}`}>
      {job.imageUrl && (
        <img src={job.imageUrl} alt="" className="jc__banner" />
      )}
      <div className="jc__logo-area">
        <CompanyLogo company={job.company} />
      </div>

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
