import { CATEGORY_ICONS, CATEGORY_SHORT, CATEGORY_SOLID } from '../data/categories'
import type { Job } from '../types/job'

/* ── helpers ─────────────────────────────────────────────────────── */

const LOGO_PALETTE = [
  '#E53935','#1565C0','#2E7D32','#F57C00',
  '#6A1B9A','#00838F','#AD1457','#37474F',
  '#c62828','#283593','#558b2f','#e65100',
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

function daysLeft(deadline?: string): number | null {
  if (!deadline) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(deadline)
  return Math.ceil((d.getTime() - today.getTime()) / 86_400_000)
}

/* ── component ───────────────────────────────────────────────────── */

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
  job, isApplied, onApply, isSaved, onToggleSave, rank, distanceKm,
}: JobCardProps) {
  const days = daysLeft(job.applicationDeadline)
  const catColor = CATEGORY_SOLID[job.category]
  const catBg = catColor + '18'  // ~10% alpha
  const logoBg = logoColor(job.company)
  const initials = logoInitials(job.company)

  const deadlineBadge = () => {
    if (days === null) return null
    if (days < 0) return <span className="jc-badge jc-badge--expired">Hết hạn</span>
    if (days === 0) return <span className="jc-badge jc-badge--today">Hôm nay!</span>
    if (days <= 3) return <span className="jc-badge jc-badge--soon">Còn {days} ngày</span>
    return null
  }

  return (
    <article className={`jc${isApplied ? ' jc--applied' : ''}`} style={{ '--cat-color': catColor } as React.CSSProperties}>
      {/* Left accent bar (category color) */}
      <div className="jc__accent" style={{ background: catColor }} />

      <div className="jc__body">
        {/* ── Top row: badges ────────────────────────────── */}
        <div className="jc__badges">
          <span className="jc__cat-badge" style={{ color: catColor, background: catBg }}>
            {CATEGORY_ICONS[job.category]}&nbsp;{CATEGORY_SHORT[job.category]}
          </span>
          {job.urgent && <span className="jc__urgent">🔥 Tuyển gấp</span>}
          {deadlineBadge()}
          {rank && <span className="jc__rank">#{rank}</span>}
          {distanceKm !== undefined && (
            <span className="jc__dist">📍 {distanceKm.toFixed(1)} km</span>
          )}
        </div>

        {/* ── Title ──────────────────────────────────────── */}
        <h3 className="jc__title">{job.title}</h3>

        {/* ── Company row ────────────────────────────────── */}
        <div className="jc__company-row">
          <span className="jc__logo" style={{ background: logoBg }} aria-hidden>
            {initials}
          </span>
          <div className="jc__company-info">
            <span className="jc__company">{job.company}</span>
            <span className="jc__location">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
              {job.location}
            </span>
            {job.hours && <span className="jc__hours">⏰ {job.hours}</span>}
          </div>
        </div>

        {/* ── Footer: salary + actions ────────────────────── */}
        <div className="jc__footer">
          <div className="jc__salary-wrap">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
            </svg>
            <span className="jc__salary">{job.salary}</span>
          </div>

          <div className="jc__actions">
            {onToggleSave && (
              <button
                type="button"
                className={`jc__save${isSaved ? ' jc__save--saved' : ''}`}
                onClick={(e) => { e.stopPropagation(); onToggleSave(job) }}
                aria-label={isSaved ? 'Bỏ lưu' : 'Lưu tin'}
                aria-pressed={isSaved}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
                  <path
                    d="M7 3.5h10a2 2 0 012 2v16.5l-7-4.25L5 22V5.5a2 2 0 012-2z"
                    fill={isSaved ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            )}
            <button
              type="button"
              className={`jc__apply${isApplied ? ' jc__apply--done' : ''}`}
              onClick={(e) => { e.stopPropagation(); !isApplied && onApply(job) }}
              disabled={isApplied}
              aria-label={isApplied ? 'Đã ứng tuyển' : `Ứng tuyển: ${job.title}`}
            >
              {isApplied ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
                    <path d="M2 7l4 4 6-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Đã ứng tuyển
                </>
              ) : 'Ứng tuyển ngay'}
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}
