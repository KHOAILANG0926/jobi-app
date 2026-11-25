import { SlidersHorizontal } from 'lucide-react'
import { useAppFilters } from '../filters/AppFilters'
import type { FilterSectionId } from './FilterSheet'

// 필터 칩 줄(V2/V3): 필터 아이콘 + 지역·반경 / 업종 / 급여 / 근무조건. 칩은 모두 같은 필터 시트의 해당 섹션을 연다.
export default function FilterRail({ onOpen }: { onOpen: (section?: FilterSectionId) => void }) {
  const { count, reset } = useAppFilters()
  return (
    <div className="app-chip-row app-filter-rail" role="toolbar" aria-label="Bộ lọc việc làm">
      <button type="button" className="app-chip app-chip--filter app-on" onClick={() => onOpen()}><SlidersHorizontal size={16} aria-hidden />Bộ lọc{count > 0 && ` · ${count}`}</button>
      <button type="button" className="app-chip" onClick={() => onOpen('region')}>Khu vực · Bán kính</button>
      <button type="button" className="app-chip" onClick={() => onOpen('category')}>Ngành nghề</button>
      <button type="button" className="app-chip" onClick={() => onOpen('salary')}>Mức lương</button>
      <button type="button" className="app-chip" onClick={() => onOpen('hours')}>Ca làm · Phúc lợi</button>
      {count > 0 && <button type="button" className="app-chip" onClick={reset}>Đặt lại</button>}
    </div>
  )
}
