import { useCallback, useState, type ReactNode } from 'react'
import type { Job } from '../../types/job'
import { useAppFilters } from '../filters/AppFilters'
import { lazy, Suspense } from 'react'
import type { FilterSectionId } from './FilterSheet'

// 시트는 열 때 처음 불러온다(지역·성·동 자료가 커서 첫 화면에서 빼기 위함).
const FilterSheet = lazy(() => import('./FilterSheet'))
const RegionSheet = lazy(() => import('./RegionSheet'))

// 필터 시트·지역 시트를 여는 공통 훅 — 홈·검색·목록·지도가 같은 시트·같은 상태를 쓴다.
export function useFilterSheets(jobs: Job[], opts?: { hasOrigin?: boolean }): { openFilter: (section?: FilterSectionId) => void; openRegion: () => void; sheets: ReactNode } {
  const { filters, setFilters, patch } = useAppFilters()
  const [filterSection, setFilterSection] = useState<FilterSectionId | null | 'all'>(null)
  const [region, setRegion] = useState(false)
  const openFilter = useCallback((s?: FilterSectionId) => setFilterSection(s ?? 'all'), [])
  const openRegion = useCallback(() => setRegion(true), [])
  const sheets = (
    <Suspense fallback={null}>
      {filterSection && <FilterSheet initial={filters} jobs={jobs} hasOrigin={opts?.hasOrigin} section={filterSection === 'all' ? undefined : filterSection} onApply={setFilters} onClose={() => setFilterSection(null)} />}
      {region && <RegionSheet province={filters.province} wards={filters.wards} onApply={(province, wards) => patch({ province, wards })} onClose={() => setRegion(false)} />}
    </Suspense>
  )
  return { openFilter, openRegion, sheets }
}
