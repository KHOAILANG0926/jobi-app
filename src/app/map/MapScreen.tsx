import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { List, LocateFixed, MapPin, Search, X } from 'lucide-react'
import type { HomeMapViewport, MapPoint } from '../../components/home/map/HomeMapTypes'
import { cardCompanyParts, cardTitle } from '../../lib/cardText'
import { formatDistanceLabel } from '../../lib/jobCoords'
import { planJobDirections } from '../../lib/directionsPlan'
import { cardSalary, PAY_LABELS } from '../../lib/mainJobCards'
import { selectedMapEntry, validPoint, type MapBounds } from '../../lib/mapR1'
import { shortArea } from '../../lib/shortArea'
import { appApplyButton } from '../data/applyAction'
import { useAppJobs, useSavedJobIds } from '../data/useAppData'
import { useOrigin } from '../data/useOrigin'
import { useAppFilters } from '../filters/AppFilters'
import AppJobCard from '../ui/AppJobCard'
import BottomSheet from '../ui/BottomSheet'
import FilterRail from '../ui/FilterRail'
import { shortProvince } from '../ui/RegionSheet'
import { useFilterSheets } from '../ui/useFilterSheets'
import { fitViewport, useMapData } from './useMapData'

// 지도 탭(V3): 지도 전체 화면 + 위에 검색(지역)·필터 칩, 아래에 선택 카드와 목록 시트. 지도 부품·핀 계산은 웹 지도와 같다(HomeMapCanvas·mapSearch).
// 지도·핀·기능은 웹 지도 그대로 — 핀은 확정 좌표만, 위치를 모르는 공고는 핀이 없고 목록에서만 보인다.
const HomeMapCanvas = lazy(() => import('../../components/home/HomeMapCanvas'))

export default function MapScreen() {
  const { jobs, loading, areas, areasReady } = useAppJobs()
  const { filters } = useAppFilters()
  const saved = useSavedJobIds()
  const { origin, request } = useOrigin()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null)
  const [bounds, setBounds] = useState<MapBounds | null>(null)
  const [listOpen, setListOpen] = useState(false)
  const [recenter, setRecenter] = useState(0)
  const [radiusActive, setRadiusActive] = useState(false)
  const sheets = useFilterSheets(jobs, { hasOrigin: origin.status === 'ready' })
  const userPoint = origin.status === 'ready' ? origin.point : null
  const data = useMapData(jobs, areas, filters, userPoint, radiusActive && !!userPoint, bounds)
  const fitted = useMemo(() => fitViewport(data.markers), [data.markers])
  const initialViewport = useRef<HomeMapViewport | null>(null)
  if (!initialViewport.current && data.markers.length > 0) initialViewport.current = fitted

  const onViewportChange = useCallback((v: HomeMapViewport) => { if (v.bounds) setBounds(v.bounds) }, [])
  const onSelect = useCallback((id: string, point?: MapPoint) => { setSelectedId(id); setSelectedPoint(point ?? null) }, [])
  const useMyLocation = () => { setRadiusActive(true); if (origin.status === 'ready') setRecenter((n) => n + 1); else request() }
  // 위치가 막 도착하면 그 자리로 지도를 옮긴다.
  const originKey = userPoint ? `${userPoint.lat},${userPoint.lng}` : ''
  useEffect(() => { if (originKey) setRecenter((n) => n + 1) }, [originKey])

  const entry = selectedId ? data.entries.find((e) => e.job.id === selectedId) ?? null : null
  const selected = selectedMapEntry(entry, selectedPoint, userPoint)
  const job = selected?.job
  const salary = job ? cardSalary(job) : null
  const parts = job ? cardCompanyParts(job.company, shortArea(job.location)) : null
  const plan = job ? planJobDirections(job) : null
  const route = plan && plan.tier === 'approved' ? plan.links[0] : plan && plan.tier === 'gate' ? plan.link : plan && plan.tier === 'address' ? plan.links[0] : null
  const action = job ? appApplyButton(job) : null
  const listJobs = data.visibleEntries.length > 0 ? data.visibleEntries : []
  const mapOrigin = userPoint && validPoint(userPoint) ? userPoint : (initialViewport.current ?? fitted).center

  return (
    <div className="app-mapscreen" data-testid="app-map" data-pins={data.markers.length}>
      <div className="app-mapscreen__canvas">
        <Suspense fallback={<p className="app-map-note app-map-note--center" role="status">Đang tải bản đồ…</p>}>
          <HomeMapCanvas origin={mapOrigin} originIsUser={!!userPoint} radiusKm={filters.radiusKm} radiusActive={radiusActive && !!userPoint} recenterRequest={recenter}
            markers={data.markers} selectedId={selectedId} selectedPoint={selectedPoint} onSelect={onSelect} onViewportChange={onViewportChange}
            initialViewport={initialViewport.current ?? undefined} cameraRequest={initialViewport.current ?? undefined} />
        </Suspense>
      </div>
      <div className="app-mapscreen__top">
        <button type="button" className="app-mapsearch" onClick={sheets.openRegion} aria-label="Chọn khu vực làm việc">
          <Search size={20} aria-hidden /><span>{filters.province ? shortProvince(filters.province) : 'Tìm khu vực làm việc'}</span>
        </button>
        <FilterRail onOpen={sheets.openFilter} />
      </div>
      <button type="button" className="app-mapfab" aria-label="Dùng vị trí hiện tại" onClick={useMyLocation} disabled={origin.status === 'loading'}><LocateFixed size={22} aria-hidden /></button>
      {(origin.status === 'denied' || origin.status === 'unsupported') && <p className="app-mapnotice" role="status">Không lấy được vị trí. Bạn vẫn có thể chọn khu vực để xem việc làm.</p>}
      {loading || !areasReady ? <p className="app-mapnotice" role="status">Đang tải việc làm…</p> : null}

      <div className="app-mapscreen__bottom">
        {job && parts && (
          <article className="app-mapcard" data-testid="app-mapcard">
            <button type="button" className="app-icon-btn app-icon-btn--sm app-mapcard__close" aria-label="Đóng" onClick={() => { setSelectedId(null); setSelectedPoint(null) }}><X size={18} aria-hidden /></button>
            <Link to={`/viec-lam/${job.id}`} className="app-mapcard__body">
              <span className="app-card__company">{parts.name}</span>
              <strong className="app-card__title">{job.urgent && <span className="app-badge-urgent">Tuyển gấp</span>}{cardTitle(job.title, job.company)}</strong>
              {salary && !salary.lines && <span className="app-card__salary">{(salary.kind ?? 'other') !== 'other' && <span className="app-pay-tag">{PAY_LABELS[salary.kind ?? 'other']}</span>}<span className="app-pay-amount">{salary.text}</span></span>}
              <span className="app-card__meta"><MapPin size={13} aria-hidden />{parts.place}{selected?.distanceKm != null && ` · ${formatDistanceLabel(selected.distanceKm, false)}`}</span>
            </Link>
            <div className="app-mapcard__actions">
              {route && <a className="app-btn app-btn--ghost" href={route.href} target="_blank" rel="noopener noreferrer">{route.label}</a>}
              {action?.kind === 'internal' && <Link className="app-btn app-btn--primary" to={`/viec-lam/${job.id}`}>{action.label}</Link>}
              {action?.kind === 'contact' && <a className="app-btn app-btn--primary" href={action.href}>{action.label}</a>}
            </div>
          </article>
        )}
        <button type="button" className="app-maplist-btn" onClick={() => setListOpen(true)}><List size={18} aria-hidden />Xem danh sách{data.visibleCount > 0 || data.entries.length > 0 ? ` (${data.visibleCount || data.entries.length})` : ''}</button>
      </div>
      {listOpen && (
        <BottomSheet title={`Việc làm trong khu vực này · ${listJobs.length || data.entries.length}`} onClose={() => setListOpen(false)}>
          {(listJobs.length ? listJobs : data.entries).map((e) => <AppJobCard key={e.job.id} job={e.job} saved={saved.set.has(e.job.id)} onToggleSave={saved.toggle} distanceKm={e.distanceKm ?? undefined} />)}
          {data.unresolvedCount > 0 && <p className="app-state">{data.unresolvedCount} việc làm chưa xác minh vị trí nên chưa có ghim trên bản đồ.</p>}
          {data.entries.length === 0 && <p className="app-state">Chưa có việc làm phù hợp với điều kiện hiện tại.</p>}
        </BottomSheet>
      )}
      {sheets.sheets}
    </div>
  )
}
