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

function DeadlineBadge({ days }: { days: number | null }) {
  if (days === null) return null
  if (days < 0)  return <span className="jc-tag jc-tag--expired">Hết hạn</span>
  if (days === 0) return <span className="jc-tag jc-tag--today">HÔM NAY</span>
  if (days <= 3)  return <span className="jc-tag jc-tag--soon">D-{days}</span>
  return null
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
  const catColor  = CATEGORY_SOLID[job.category]
  const catBg     = catColor + '15'
  const logoBg    = logoColor(job.company)
  const initials  = logoInitials(job.company)

  return (
    <article
      className={`jc${isApplied ? ' jc--applied' : ''}`}
      style={{ '--cc': catColor } as React.CSSProperties}
    >
      {/* ── TOP SECTION ─────────────────────────────────────── */}
      <div className="jc__top">
        {/* Company logo avatar */}
        <span className="jc__logo" style={{ background: logoBg }} aria-hidden>
          {initials}
        </span>

        {/* Title + meta */}
        <div className="jc__info">
          {rank && <span className="jc__rank">#{rank}</span>}
          <h3 className="jc__title">{job.title}</h3>
          <p className="jc__company-loc">
            <span className="jc__company">{job.company}</span>
            <span className="jc__loc-sep">·</span>
            <span className="jc__location">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden style={{ flexShrink: 0 }}>
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
              {job.location}
            </span>
          </p>
          {job.hours && (
            <p className="jc__hours">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
              </svg>
              {job.hours}
            </p>
          )}
          {distanceKm !== undefined && (
            <p className="jc__dist-info">📍 {distanceKm.toFixed(1)} km</p>
          )}
        </div>

        {/* Bookmark */}
        {onToggleSave && (
          <button
            type="button"
            className={`jc__save${isSaved ? ' jc__save--on' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleSave(job) }}
            aria-label={isSaved ? 'Bỏ lưu' : 'Lưu tin'}
            aria-pressed={isSaved}
          >
            <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden>
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
      </div>

      {/* ── BOTTOM SECTION ──────────────────────────────────── */}
      <div className="jc__bottom">
        {/* Tags row */}
        <div className="jc__tags">
          <span className="jc__cat-tag" style={{ color: catColor, background: catBg }}>
            {CATEGORY_ICONS[job.category]} {CATEGORY_SHORT[job.category]}
          </span>
          {job.urgent && <span className="jc__tag-urgent">🔥 Gấp</span>}
          <DeadlineBadge days={days} />
        </div>

        {/* Salary + apply */}
        <div className="jc__action-row">
          <span className="jc__salary">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm.88 14.76V18h-1.76v-1.27c-1.14-.22-2.27-.88-2.76-2.08l1.59-.64c.35.82 1.05 1.27 1.92 1.27.85 0 1.41-.42 1.41-1.04 0-.58-.38-.88-1.64-1.22C10.32 12.6 9 12.06 9 10.58c0-1.29.99-2.14 2.12-2.37V7h1.76v1.22c1.16.24 1.95.96 2.23 2.03l-1.58.63c-.21-.7-.73-1.09-1.49-1.09-.73 0-1.23.4-1.23.94 0 .58.49.84 1.73 1.16 1.44.37 2.46.96 2.46 2.46 0 1.33-1.01 2.2-2.12 2.41z"/>
            </svg>
            {job.salary}
          </span>
          <button
            type="button"
            className={`jc__apply${isApplied ? ' jc__apply--done' : ''}`}
            onClick={(e) => { e.stopPropagation(); !isApplied && onApply(job) }}
            disabled={isApplied}
            aria-label={isApplied ? 'Đã ứng tuyển' : `Ứng tuyển: ${job.title}`}
          >
            {isApplied ? (
              <>
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <path d="M2 7l4 4 6-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Đã nộp
              </>
            ) : 'Ứng tuyển'}
          </button>
        </div>
      </div>
    </article>
  )
}
