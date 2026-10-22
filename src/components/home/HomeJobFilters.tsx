import { useEffect, useMemo, useRef } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { JOB_DURATION_OPTIONS } from '../../data/jobDuration'
import { parseJobSearchParamsFromQueryString } from '../../lib/jobSearch'
import './home-job-filters.css'

export function useHomeJobConditions() {
  const { search } = useLocation()
  return useMemo(() => {
    const { jobDurations, pledgeOnly } = parseJobSearchParamsFromQueryString(search)
    return { jobDurations, pledgeOnly }
  }, [search])
}

/** Conditions sit immediately above the existing main job cards, on both layouts. */
export default function HomeJobFilters({ count, loading }: { count: number; loading: boolean }) {
  const location = useLocation()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { jobDurations, pledgeOnly } = useHomeJobConditions()
  const ref = useRef<HTMLElement>(null)
  const active = Boolean(jobDurations?.length || pledgeOnly)

  useEffect(() => {
    if (loading || location.hash !== '#home-job-filters') return
    const frame = requestAnimationFrame(() => {
      const section = ref.current
      if (!section) return
      const header = document.querySelector('.layout__header')
      const headerHeight = header instanceof HTMLElement ? header.getBoundingClientRect().height : 0
      window.scrollTo({ top: section.getBoundingClientRect().top + window.scrollY - headerHeight - 12, behavior: 'instant' })
    })
    return () => cancelAnimationFrame(frame)
  }, [location.key, location.hash, loading])

  const update = (key: 'duration' | 'pledge', value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    navigate({ pathname: location.pathname, search: next.toString(), hash: '#home-job-filters' }, { preventScrollReset: true })
  }
  const clear = () => {
    const next = new URLSearchParams(params)
    next.delete('duration')
    next.delete('pledge')
    navigate({ pathname: location.pathname, search: next.toString(), hash: '#home-job-filters' }, { preventScrollReset: true })
  }

  return (
    <section id="home-job-filters" className="home-job-filters" ref={ref} aria-label="Lọc danh sách việc làm">
      <h2 className="home-job-filters__title">Tìm việc theo điều kiện</h2>
      <div className="home-job-filters__controls">
        <label className="home-job-filters__duration">
          <span>Thời gian làm việc</span>
          <select aria-label="Thời gian làm việc" value={jobDurations?.[0] ?? ''}
            onChange={e => update('duration', e.target.value)}>
            <option value="">Tất cả thời gian làm việc</option>
            {JOB_DURATION_OPTIONS.map(duration => <option key={duration} value={duration}>{duration}</option>)}
          </select>
        </label>
        <label className="home-job-filters__pledge">
          <input type="checkbox" checked={Boolean(pledgeOnly)} onChange={e => update('pledge', e.target.checked ? '1' : '')} />
          <span>Có cam kết hợp đồng / BHXH</span>
        </label>
        {active && <button type="button" onClick={clear}>Xóa điều kiện</button>}
      </div>
      <p className="home-job-filters__summary" role="status">
        {loading ? 'Đang tải việc làm…' : `${count} việc làm${active ? ' phù hợp' : ''}`}
        {active && <> · {jobDurations?.join(', ')}{jobDurations?.length && pledgeOnly ? ' · ' : ''}{pledgeOnly ? 'Có cam kết hợp đồng / BHXH' : ''}</>}
      </p>
    </section>
  )
}
