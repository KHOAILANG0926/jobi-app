import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Job } from '../../types/job'
import { sortJobsForList, type JobListSortMode } from '../../lib/jobListFilter'
import { useSavedJobIds } from '../data/useAppData'
import AppJobCard from '../ui/AppJobCard'

// 공고 목록 본체 — 건수·정렬·카드·더 보기. 급구·지역별·단기·맞춤·추천·저장·최근 본·검색 결과·브랜드별이 모두 이 부품 하나를 쓴다(프리셋만 다름).
const PAGE = 20
const SORTS: { value: JobListSortMode; label: string }[] = [{ value: 'newest', label: 'Mới nhất' }, { value: 'deadline', label: 'Hạn nộp gần nhất' }]

export default function JobList({ jobs, loading, error, empty, keepOrder, distanceById, reasonById }: {
  jobs: Job[]; loading: boolean; error: boolean; empty: React.ReactNode
  /** 거리순·관련도순처럼 이미 순서가 정해진 목록은 정렬 선택을 숨기고 그 순서를 지킨다 */
  keepOrder?: boolean
  distanceById?: ReadonlyMap<string, number>
  reasonById?: ReadonlyMap<string, string>
}) {
  const [sort, setSort] = useState<JobListSortMode>('newest')
  const [shown, setShown] = useState(PAGE)
  const saved = useSavedJobIds()
  const list = useMemo(() => (keepOrder ? jobs : sortJobsForList(jobs, sort)), [jobs, sort, keepOrder])
  if (error && jobs.length === 0) return <p className="app-state" role="alert">Không tải được danh sách việc làm. Vui lòng thử lại sau.</p>
  if (loading && jobs.length === 0) return <p className="app-state" role="status">Đang tải việc làm…</p>
  return (
    <section aria-label="Danh sách việc làm">
      <div className="app-listbar">
        <span><b>{list.length}</b> việc làm</span>
        {!keepOrder && list.length > 1 && (
          <label className="app-select"><select value={sort} onChange={(e) => setSort(e.target.value as JobListSortMode)} aria-label="Sắp xếp">{SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select><ChevronDown size={14} aria-hidden /></label>
        )}
      </div>
      {list.length === 0 ? empty : (
        <>
          {list.slice(0, shown).map((j) => <AppJobCard key={j.id} job={j} saved={saved.set.has(j.id)} onToggleSave={saved.toggle} distanceKm={distanceById?.get(j.id)} reason={reasonById?.get(j.id)} />)}
          {list.length > shown && <button type="button" className="app-more" onClick={() => setShown((n) => n + PAGE)}>Xem thêm việc làm</button>}
        </>
      )}
    </section>
  )
}
