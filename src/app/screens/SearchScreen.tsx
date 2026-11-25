import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, Menu, Search, X } from 'lucide-react'
import { CATEGORY_LABELS } from '../../data/categories'
import type { JobCategory } from '../../types/job'
import { useAppJobs } from '../data/useAppData'
import { useAppFilters } from '../filters/AppFilters'
import { applyAppFilters } from '../filters/applyFilters'
import FilterRail from '../ui/FilterRail'
import { useFilterSheets } from '../ui/useFilterSheets'
import JobList from './JobList'

// 검색 화면(V3): ← + 입력창 / 비어 있으면 "Từ khóa phổ biến" / 입력하면 결과(공통 목록 + 필터 칩 줄).
// 인기 검색어 집계는 아직 없어, 지금 올라와 있는 실제 공고의 업종 이름을 공고 수 순으로 보여 준다(없는 키워드를 지어내지 않는다).
export default function SearchScreen() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const q = params.get('q') ?? ''
  const [draft, setDraft] = useState(q)
  const { jobs, loading: jobsLoading, jobsError, areas, areasReady } = useAppJobs()
  const loading = jobsLoading || !areasReady
  const { filters } = useAppFilters()
  const sheets = useFilterSheets(jobs)
  const keywords = useMemo(() => {
    const counts = new Map<JobCategory, number>()
    for (const j of jobs) counts.set(j.category, (counts.get(j.category) ?? 0) + 1)
    return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c]) => CATEGORY_LABELS[c])
  }, [jobs])
  const results = useMemo(() => (q.trim() ? applyAppFilters(jobs, { ...filters, query: q }, areas) : []), [jobs, filters, areas, q])
  const submit = (value: string) => { const v = value.trim(); setDraft(v); setParams(v ? { q: v } : {}, { replace: true }) }
  return (
    <div className="app-page" data-testid="app-search">
      <header className="app-pagebar">
        <button type="button" className="app-icon-btn" aria-label="Quay lại" onClick={() => navigate(-1)}><ChevronLeft size={24} aria-hidden /></button>
        <form className="app-searchbox" role="search" onSubmit={(e) => { e.preventDefault(); submit(draft) }}>
          <Search size={20} aria-hidden />
          <input type="search" autoFocus={!q} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Bạn muốn tìm việc gì?" aria-label="Từ khóa tìm việc" enterKeyHint="search" />
          {draft && <button type="button" className="app-icon-btn app-icon-btn--sm" aria-label="Xóa từ khóa" onClick={() => submit('')}><X size={18} aria-hidden /></button>}
        </form>
        {q && <Link to="/menu" className="app-icon-btn" aria-label="Danh mục"><Menu size={22} aria-hidden /></Link>}
      </header>
      {!q.trim() ? (
        <section className="app-section" aria-label="Từ khóa phổ biến">
          <div className="app-section__head"><h2>Từ khóa phổ biến</h2></div>
          {keywords.length > 0
            ? <div className="app-chip-row app-chip-row--wrap app-kw">{keywords.map((k) => <button key={k} type="button" className="app-chip" onClick={() => submit(k)}>{k}</button>)}</div>
            : <p className="app-state">{loading ? 'Đang tải…' : 'Chưa có từ khóa để gợi ý.'}</p>}
        </section>
      ) : (
        <>
          <FilterRail onOpen={sheets.openFilter} />
          <JobList jobs={results} loading={loading} error={jobsError} empty={<p className="app-state">Không tìm thấy việc làm cho “{q}”. Thử từ khóa khác.</p>} />
        </>
      )}
      {sheets.sheets}
    </div>
  )
}
