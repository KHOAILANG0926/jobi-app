import { useState } from 'react'
import type { Job, JobCategory } from '../types/job'
import { getCategoryVisual } from '../lib/categoryVisuals'
import { zaloMeUrl } from '../lib/jobUtils'

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

function CompanyLogo({ company, imageUrl, category }: { company: string; imageUrl?: string; category?: string }) {
  const [imgFailed, setImgFailed] = useState(false)
  const [faviconFailed, setFaviconFailed] = useState(false)

  // 알려진 브랜드는 favicon 우선 (CDN 로고가 브랜드 색 정사각형일 수 있어서)
  const domain = Object.entries(FAVICON_DOMAINS).find(([name]) =>
    company.toLowerCase().includes(name.toLowerCase())
  )?.[1]

  if (domain && !faviconFailed) {
    return (
      <img
        src={`https://www.google.com/s2/favicons?sz=128&domain=${domain}`}
        alt={company}
        className="jc__logo"
        onError={() => setFaviconFailed(true)}
      />
    )
  }
  if (imageUrl && !imgFailed) {
    return <img src={imageUrl} alt={company} className="jc__logo" onError={() => setImgFailed(true)} />
  }
  const visual = getCategoryVisual(category || 'other')
  return (
    <span
      className="jc__logo jc__logo--category"
      style={{ backgroundImage: `url(${visual.imageUrl})` }}
    />
  )
}

function reclassify(category: string, title: string, company: string): JobCategory {
  const t = (title + ' ' + company).toLowerCase()
  if (/nhà hàng|quán ăn|quán nhậu|beer|bia|hải sản|lẩu|buffet|jollibee|haidilao|phục vụ bàn|bếp|đầu bếp|phụ bếp|nấu ăn/.test(t))
    return 'restaurant'
  if (/cà phê|cafe|coffee|trà sữa|pha chế|bartender|barista/.test(t))
    return 'cafe'
  return category as JobCategory
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
  const category = reclassify(job.category, job.title, job.company)
  const salary = sanitizeSalary(job.salary)

  const catTag = CATEGORY_TAGS[category] ?? ''
  const h = (job.hours ?? '').toLowerCase()
  const hourTag = h.includes('part-time') ? 'Part-time' : h.includes('full-time') ? 'Full-time' : ''

  const metaParts = [
    job.urgent ? '#Khẩn cấp' : null,
    catTag ? `#${catTag}` : null,
    hourTag ? `#${hourTag}` : null,
    job.location || null,
    job.company || null,
  ].filter(Boolean) as string[]

  const salaryType = salary.toLowerCase().includes('giờ') ? 'Giờ'
    : salary.toLowerCase().includes('ngày') ? 'Ngày'
    : salary.toLowerCase().includes('tháng') ? 'Tháng' : ''
  const salaryNum = salary.replace(/\/(giờ|ngày|tháng)/i, '').trim()

  return (
    <article className={`jc${isApplied ? ' jc--applied' : ''}`}>
      {/* 1열: 로고 */}
      <div className="jc__logo-wrap">
        <CompanyLogo
          company={job.company}
          imageUrl={job.source !== 'facebook' ? job.imageUrl : undefined}
          category={category}
        />
      </div>

      {/* 2열: #태그 · 지역 · 회사명 */}
      <p className="jc__meta">
        {metaParts.join(' · ')}
        {distanceKm !== undefined && ` · \u{1F4CD}${distanceKm.toFixed(1)}km`}
      </p>

      {/* 3열: 제목 */}
      <h3 className="jc__title">{job.title}</h3>

      {/* 4열: 급여 + Zalo + 즐겨찾기 */}
      <div className="jc__footer">
        <span className="jc__salary">
          {salaryType && <span className="jc__salary-type">{salaryType} </span>}
          {salaryNum}
        </span>
        <div className="jc__actions">
          {(job.zalo || job.employerPhone) && (
            <a
              href={zaloMeUrl(job.zalo || job.employerPhone)}
              target="_blank"
              rel="noopener noreferrer"
              className="jc__zalo-btn"
              onClick={(e) => e.stopPropagation()}
              aria-label="Chat qua Zalo"
            >
              Zalo
            </a>
          )}
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
      </div>
    </article>
  )
}
