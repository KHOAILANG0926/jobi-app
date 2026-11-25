import { lazy, Suspense, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, LocateFixed } from 'lucide-react'
import type { Job } from '../../types/job'
import { useAppFilters } from '../filters/AppFilters'
import type { AppJobAreas } from '../filters/applyFilters'
import { fitViewport, useMapData } from './useMapData'

// 홈 지도 미리보기(V3 B안: 추천 바로 아래). 웹과 같은 지도 부품(HomeMapCanvas)·같은 핀 계산(mapSearch)을 쓰고, 누르면 지도 탭으로 간다.
// 크기·핀·기능은 웹 지도 그대로이며 여기서는 크기만 정한다(184px).
const HomeMapCanvas = lazy(() => import('../../components/home/HomeMapCanvas'))

export default function MiniMap({ jobs, areas }: { jobs: Job[]; areas: AppJobAreas }) {
  const { filters } = useAppFilters()
  const navigate = useNavigate()
  const data = useMapData(jobs, areas, filters, null, false, null)
  const viewport = useMemo(() => fitViewport(data.markers), [data.markers])
  if (jobs.length === 0) return null
  return (
    <section className="app-section" aria-label="Việc làm quanh bạn" data-testid="app-minimap">
      <div className="app-section__head"><h2>Việc làm quanh bạn</h2><Link to="/ban-do">Mở bản đồ<ChevronRight size={14} aria-hidden /></Link></div>
      <div className="app-minimap">
        <Suspense fallback={<p className="app-map-note" role="status">Đang tải bản đồ…</p>}>
          <HomeMapCanvas key={data.markers.length ? 'pins' : 'empty'} origin={viewport.center} originIsUser={false} radiusKm={filters.radiusKm} recenterRequest={0}
            markers={data.markers} selectedId={null} initialViewport={viewport} cameraRequest={viewport}
            onSelect={() => navigate('/ban-do')} />
        </Suspense>
        <Link to="/ban-do" className="app-minimap__veil" aria-label="Mở bản đồ việc làm"><span className="app-minimap__btn"><LocateFixed size={18} aria-hidden /></span></Link>
      </div>
    </section>
  )
}
