import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import JobCard from '../JobCard'
import { CATEGORY_SHORT } from '../../data/categories'
import type { Job } from '../../types/job'
import type { MapSummaryResult } from './DesktopHomeMapExplorer'

const PAGE_SIZE = 20
interface Props {
  result: MapSummaryResult
  onClear: () => void
  isApplied: (id: string) => boolean
  isSaved: (id: string) => boolean
  onApply: (job: Job) => void
  onToggleSave: (job: Job) => void
}

/** A dedicated search lane, separate from the homepage's promotion lane.
 * Paid placement can later order eligible results without changing scope/counts.
 * No payment or entitlement is inferred from urgent/featured flags.
 */
export default function MapSummaryResults({ result, onClear, isApplied, isSaved, onApply, onToggleSave }: Props) {
  const sectionRef = useRef<HTMLElement>(null)
  const [page, setPage] = useState(0)
  const pageCount = Math.max(1, Math.ceil(result.jobs.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const pageJobs = result.jobs.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
  useEffect(() => { setPage(0) }, [result.jobs])
  const scrollToResults = () => {
    const el = sectionRef.current
    if (!el) return
    const header = document.querySelector('.layout__header')
    const height = header instanceof HTMLElement ? header.getBoundingClientRect().height : 0
    el.focus({ preventScroll: true })
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - height - 12,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }
  useEffect(() => { if (result.selectionVersion > 0) scrollToResults() }, [result.selectionVersion])
  return (
    <section className="home-section" ref={sectionRef} tabIndex={-1} aria-labelledby="map-results-title" data-testid="map-summary-results">
      <div className="city-result__head">
        <div>
          <h2 id="map-results-title" className="home-section__title">Việc làm {result.categories.map(c => CATEGORY_SHORT[c]).join(', ')} trong khung bản đồ</h2>
          <p aria-live="polite">{result.jobs.length} việc làm phù hợp với khung bản đồ và bộ lọc hiện tại.</p>
        </div>
        <button type="button" className="city-result__clear" onClick={onClear}>Bỏ lọc ngành</button>
      </div>
      {pageJobs.length === 0 ? <p>Chưa có việc làm phù hợp. Hãy đổi khung bản đồ hoặc bộ lọc.</p> : (
        <div className="home-jobs-grid">
          {pageJobs.map(job => <NavLink key={job.id} className="home-card-wrap" to={`/viec-lam/${job.id}`}>
            <JobCard job={job} isApplied={isApplied(job.id)} onApply={onApply}
              isSaved={isSaved(job.id)} onToggleSave={onToggleSave} />
          </NavLink>)}
        </div>
      )}
      {pageCount > 1 && <nav aria-label="Trang kết quả bản đồ" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 20 }}>
        <button type="button" className="city-result__clear" disabled={currentPage === 0}
          onClick={() => { setPage(currentPage - 1); scrollToResults() }}>← Trước</button>
        <span>Trang {currentPage + 1} / {pageCount}</span>
        <button type="button" className="city-result__clear" disabled={currentPage + 1 === pageCount}
          onClick={() => { setPage(currentPage + 1); scrollToResults() }}>Sau →</button>
      </nav>}
    </section>
  )
}
