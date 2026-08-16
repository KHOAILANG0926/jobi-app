import { useState } from 'react'
import type { Job } from '../types/job'
import { getCategoryVisual } from '../lib/categoryVisuals'

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
  'Jollibee': 'jollibee.com.vn',
  'Haidilao': 'haidilao.com',
}

function CompanyPhoto({ company, imageUrl, category }: { company: string; imageUrl?: string; category?: string }) {
  const [failed, setFailed] = useState(false)
  const domain = FAVICON_DOMAINS[company]

  if (imageUrl && !failed) {
    return (
      <img src={imageUrl} alt="" className="jc__photo" onError={() => setFailed(true)} />
    )
  }

  if (domain && !failed) {
    return (
      <img
        src={`https://www.google.com/s2/favicons?sz=128&domain=${domain}`}
        alt=""
        className="jc__photo"
        onError={() => setFailed(true)}
      />
    )
  }

  const visual = getCategoryVisual(category || 'other')
  return (
    <span
      className="jc__photo jc__photo--category"
      style={{ backgroundImage: `url(${visual.imageUrl})` }}
    />
  )
}

const CATEGORY_TAGS: Record<string, string> = {
  factory:    'Nhà máy',
  cafe:       'Cafe',
  restaurant: 'Nhà hàng',
  delivery:   'Giao hàng',
  cleaning:   'Vệ sinh',
  retail:     'Bán lẻ',
  other:      'Việc làm',
}

function sanitizeSalary(salary: string): string {
  const m = salary.match(/(\d+[\.,]?\d*)\s*(?:triệu|tr)/i)
  if (m) {
    const val = parseFloat(m[1].replace(',', '.'))
    if (val > 200) return 'Thỏa thuận'
  }
  return salary
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
  const salary = sanitizeSalary(job.salary)
  return (
    <article className={`jc${isApplied ? ' jc--applied' : ''}`}>
      {/* 헤더: 항상 justify-between, 사진은 우측 고정 */}
      <div className="jc__header">
        <p className="jc__company">{job.company || ' '}</p>
        <CompanyPhoto
          company={job.company}
          imageUrl={job.source !== 'facebook' ? job.imageUrl : undefined}
          category={job.category}
        />
      </div>

      {tags.length > 0 && (
        <p className="jc__tags">{tags.map(t => `#${t}`).join(' ')}</p>
      )}

      <p className="jc__meta">{job.location}</p>

      <h3 className="jc__title">{job.title}</h3>

      {distanceKm !== undefined && (
        <p className="jc__dist">📍 {distanceKm.toFixed(1)}km</p>
      )}

      <div className="jc__footer">
        <span className="jc__salary">
          <span className="jc__salary-type">
            {salary.toLowerCase().includes('giờ') ? 'Giờ' :
             salary.toLowerCase().includes('ngày') ? 'Ngày' :
             salary.toLowerCase().includes('tháng') ? 'Tháng' : ''}
          </span>
          {' '}{salary.replace(/\/(giờ|ngày|tháng)/i, '').trim()}
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
