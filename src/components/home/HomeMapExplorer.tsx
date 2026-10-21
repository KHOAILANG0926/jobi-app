import { planJobDirections } from '../../lib/directionsPlan'
import { getUserLocation, onUserLocation } from '../../lib/userLocation'
import { fitWithNearest } from '../../lib/fitPins'
// 메인 중간 영역 — "내 주변 일자리 지도 + 선택한 공고 패널" (2026-10-01).
// 왼쪽: 탐색 조건(위치·반경 / 급여 / 업종 / Thêm điều kiện) + 지도, 오른쪽: 선택 공고 1차 판단 패널.
// 지도·거리에는 확인된 근무지만 쓴다(homeMapFilters.verifiedJobPoints). 데이터 필드가 아직 없는
// 조건은 비활성으로만 보여주고 가짜 판정을 하지 않는다.
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { Briefcase, ChevronDown, ChevronUp, Clock, LocateFixed, MapPin, SlidersHorizontal, Wallet, X } from 'lucide-react'
import { useJobs } from '../../context/JobsContext'
import { CATEGORY_SHORT } from '../../data/categories'
import { REGION_MACRO_TABS, jobMatchesRegion } from '../../data/jobRegions'
import { findRegionCenter, formatDistanceLabel } from '../../lib/jobCoords'
import { conditionBadges } from '../../lib/jobConditions'
import {
  DEFAULT_FILTERS, EXTRA_CONDITION_GROUPS, RADIUS_MAX_KM, RADIUS_MIN_KM, SALARY_OPTIONS,
  formatSalaryOption, isConditionAvailable, verifiedJobPoints,
  type ExtraConditionKey, type HomeMapFilterState, type MapJobPoint,
} from '../../lib/homeMapFilters'
import { formatSearchRadius, locationAccuracyWarning, normalizeSearchRadius } from '../../lib/homeMapSearch'
import type { HomeMapMode, NearbyState } from './map/HomeMapTypes'
import NearbyLifePanel from './NearbyLifePanel'
import PlaceDetailPanel from './PlaceDetailPanel'
import { chainWheelToPage } from './pageScrollChain'
import MobileDetailSheet from './MobileDetailSheet'
import { jobsNearPlace, type PickedPlace } from '../../lib/mapPlace'
import { occupationGroupsInJobs, useOccupationNames } from '../../lib/occupations'
import { DEFAULT_VIEWPORT, VIEWPORT_KEY, readViewport, mapSearch, selectedMapEntry, LOCATION_LABELS, validPoint, type RepresentativePoints, type MapBounds } from '../../lib/mapR1'
import type { HomeMapViewport } from './map/HomeMapTypes'
import { observeInViewOnce } from '../../lib/inViewOnce'
import type { Job } from '../../types/job'

const HomeMapCanvas = lazy(() => import('./HomeMapCanvas'))
/** 'Ngành nghề'에 처음부터 보이는 그룹 수(공고 많은 순). 나머지는 'Xem thêm'. */
const OCCUPATION_GROUPS_PRIMARY = 6

const DEFAULT_REGION = 'Hà Nội'
/** index.css의 .hme 모바일 레이아웃 기준과 같은 값. */
const MOBILE_LAYOUT_QUERY = '(max-width: 760px)'

type Origin =
  | { kind: 'user'; point: MapJobPoint; accuracyMeters: number }
  | { kind: 'region'; label: string; point: MapJobPoint }
  | { kind: 'chosen'; point: MapJobPoint }

function regionOrigin(label: string): Origin | null {
  const point = findRegionCenter(label)
  return point ? { kind: 'region', label, point } : null
}

export interface HomeDiscoveryState {
  jobs: Job[]
  originLabel: string
  geoState: 'idle' | 'loading' | 'denied' | 'unsupported'
  loading: boolean
  jobsError: boolean
  filterCount: number
  locate: () => void
  openLocation: () => void
  openFilters: (section: number) => void
  showMap: () => void
  reset: () => void
}

interface HomeMapExplorerProps {
  jobsOverride?: Job[]
  renderBeforeMap?: (state: HomeDiscoveryState) => ReactNode
  renderAfterMap?: (state: HomeDiscoveryState) => ReactNode
}

export default function HomeMapExplorer({ jobsOverride, renderBeforeMap, renderAfterMap }: HomeMapExplorerProps = {}) {
  const { jobs, mapAcceptanceJobs, loading, jobsError } = useJobs()
  const [isMobileLayout, setIsMobileLayout] = useState(false)
  const [chosenRegion, setChosenRegion] = useState<string | null>(null)
  const mapJobs = useMemo(() => {
    if (!isMobileLayout) return [...jobs, ...mapAcceptanceJobs]
    const source = [...(jobsOverride ?? jobs), ...mapAcceptanceJobs]
    const region = REGION_MACRO_TABS.flatMap(tab => tab.provinces).find(item => item.label === chosenRegion)
    return region ? source.filter(job => jobMatchesRegion(job.location, region.id, job.workLocations)) : source
  }, [jobsOverride, jobs, mapAcceptanceJobs, chosenRegion, isMobileLayout])
  const [origin, setOrigin] = useState<Origin>(() => regionOrigin(DEFAULT_REGION) ?? { kind: 'region', label: 'Hà Nội', point: { lat: 21.0285, lng: 105.8542 } })
  const [initialViewport, setInitialViewport] = useState<HomeMapViewport>(DEFAULT_VIEWPORT)
  const [viewportReady, setViewportReady] = useState(false)
  const [bounds, setBounds] = useState<MapBounds | null>(null)
  const [cameraRequest, setCameraRequest] = useState<HomeMapViewport | undefined>()
  const [radiusActive, setRadiusActive] = useState(false)
  const [pickingOrigin, setPickingOrigin] = useState(false)
  const [representatives, setRepresentatives] = useState<RepresentativePoints>({})
  useEffect(() => {
    try { setInitialViewport(readViewport(localStorage.getItem(VIEWPORT_KEY)) ?? DEFAULT_VIEWPORT) } catch { /* storage disabled */ }
    setViewportReady(true)
  }, [])
  // Public job coordinates only. Never send camera/GPS/selected origin to our server.
  useEffect(() => {
    const controller = new AbortController()
    const ids = [...new Set(mapJobs.map(j => j.id).filter(id => /^sb-\d+$/.test(id)).map(id => id.slice(3)))]
    void (async () => {
      const found: RepresentativePoints = {}
      for (let i = 0; i < ids.length; i += 100) {
        try {
          const response = await fetch(`/api/map-locations?ids=${ids.slice(i, i + 100).join(',')}`, { signal: controller.signal })
          if (response.ok) Object.assign(found, (await response.json()).points ?? {})
        } catch { if (controller.signal.aborted) return }
      }
      if (!controller.signal.aborted) setRepresentatives(found)
    })()
    return () => controller.abort()
  }, [mapJobs])
  const onViewportChange = (v: HomeMapViewport) => {
    setBounds(v.bounds ?? null)
    try { if (validPoint(v.center)) localStorage.setItem(VIEWPORT_KEY, JSON.stringify({ center: v.center, zoom: v.zoom })) } catch { /* optional persistence */ }
  }
  const [filters, setFilters] = useState<HomeMapFilterState>(DEFAULT_FILTERS)
  const [selectedPoint, setSelectedPoint] = useState<MapJobPoint | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [locMenuOpen, setLocMenuOpen] = useState(false)
  const [geoState, setGeoState] = useState<'idle' | 'loading' | 'denied' | 'unsupported'>('idle')
  const [showAllCategories, setShowAllCategories] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [mobileView, setMobileView] = useState<'map' | 'list'>('map')
  const filterFocus = useRef<HTMLElement | null>(null)
  const explorerRef = useRef<HTMLElement>(null)
  const [recenterRequest, setRecenterRequest] = useState(0)
  const [nearbyState, setNearbyState] = useState<NearbyState>({ status: 'idle' })
  const [pickedPlace, setPickedPlace] = useState<PickedPlace | null>(null)
  const [placeZoomRequest, setPlaceZoomRequest] = useState(0)
  const [mapMode, setMapMode] = useState<HomeMapMode>('street')
  const locationRequest = useRef(0)
  // 지도는 화면 근처에 처음 보일 때만 불러온다(그 전엔 타일 요청 0). 한 번 불러오면 유지.
  const mapBoxRef = useRef<HTMLDivElement>(null)
  const [mapInView, setMapInView] = useState(false)
  useEffect(() => {
    const el = mapBoxRef.current
    if (!el || mapInView) return
    return observeInViewOnce(el, () => setMapInView(true))
  }, [mapInView])
  useEffect(() => () => { locationRequest.current += 1 }, [])
  // 모바일 레이아웃(index.css의 .hme 760px 기준)에서만 상세를 하단 sheet로 띄운다. SSR·데스크톱은 false.
  useEffect(() => {
    const query = window.matchMedia(MOBILE_LAYOUT_QUERY)
    const update = () => setIsMobileLayout(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  const controlsRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!mobileFiltersOpen || !isMobileLayout) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileFiltersOpen(false)
      if (event.key !== 'Tab') return
      const elements = [...(controlsRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), select, input, a[href]') ?? [])].filter(el => el.getClientRects().length)
      const first = elements[0], last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    controlsRef.current?.querySelector<HTMLElement>('button')?.focus()
    document.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKey); filterFocus.current?.focus() }
  }, [mobileFiltersOpen, isMobileLayout])
  // 필터·패널 스크롤이 끝에 닿으면 같은 휠 동작을 페이지 스크롤로 잇는다(pageScrollChain.ts).
  useEffect(() => {
    const cleanups = [controlsRef.current, panelRef.current].filter((el): el is HTMLElement => !!el).map(chainWheelToPage)
    return () => cleanups.forEach((cleanup) => cleanup())
  }, [])

  const searchOrigin = radiusActive ? origin.point : null
  const result = useMemo(() => mapSearch(mapJobs, filters, searchOrigin, radiusActive ? filters.radiusKm : null, bounds, representatives), [mapJobs, filters, origin, radiusActive, bounds, representatives])
  const nearby = result.entries
  const occupationGroups = useMemo(() => {
    const r = mapSearch(mapJobs, { ...filters, occupationGroups: [] }, searchOrigin, radiusActive ? filters.radiusKm : null, bounds, representatives)
    // Mobile discovery includes text locations; desktop keeps its previous viewport-only occupation scope.
    const available = radiusActive ? r.radiusJobs : isMobileLayout ? r.entries : r.entries.filter(e => r.visibleIds.has(e.job.id))
    const groups = occupationGroupsInJobs(available.map(e => e.job))
    const missing = (filters.occupationGroups ?? []).filter(c => !groups.some(g => g.code === c)).map(code => ({ code, count: 0 }))
    return [...groups, ...missing]
  }, [mapJobs, filters, origin, radiusActive, bounds, representatives, isMobileLayout])
  const occupationNames = useOccupationNames(occupationGroups.map(g => g.code))
  const selected = selectedMapEntry(nearby.find(n => n.job.id === selectedId) ?? null, selectedPoint, searchOrigin)
  const listEntries = radiusActive ? result.radiusJobs : result.entries
  const directions = selected ? planJobDirections(selected.job) : null

  // 필터·위치 변경으로 선택 공고가 결과에서 빠지면 선택을 해제한다.
  useEffect(() => {
    if (selectedId && !nearby.some((n) => n.job.id === selectedId)) setSelectedId(null)
  }, [nearby, selectedId])

  // 클릭한 건물/시설 주변 공고: 필터와 무관하게 확인된 근무지 좌표가 있는 모든 공고 기준.
  const verifiedJobs = useMemo(() => mapJobs.map((job) => ({ job, points: verifiedJobPoints(job) })).filter((j) => j.points.length > 0), [mapJobs])
  const placeJobs = useMemo(() => (pickedPlace ? jobsNearPlace(pickedPlace, verifiedJobs) : []), [pickedPlace, verifiedJobs])
  const selectableIds = useMemo(() => new Set(nearby.map((n) => n.job.id)), [nearby])
  const selectJob = (id: string, point?: MapJobPoint) => { setPickedPlace(null); setSelectedId(id); setSelectedPoint(point ?? null) }

  const markers = result.markers
  // 내 위치를 켜면 내 위치와 가까운 공고 핀이 함께 보이게 지도를 맞춘다(2026-10-21 Lee "메인 화면에 핀이 없어").
  const markersRef = useRef(markers)
  markersRef.current = markers
  const userPointKey = origin.kind === 'user' ? `${origin.point.lat},${origin.point.lng}` : null
  // 핀이 위치보다 늦게 도착할 수 있다(이미 허용한 기기는 접속하자마자 위치를 받음, 2026-10-21 Lee "핀이 아예 없어").
  // 그래서 위치가 바뀔 때와, 그 위치에서 핀이 처음 생길 때 한 번 더 맞춘다(같은 위치에서 핀까지 맞춘 뒤에는 다시 움직이지 않음).
  const fittedWithPins = useRef<string | null>(null)
  const hasPins = markers.length > 0
  useEffect(() => {
    if (!userPointKey || origin.kind !== 'user') return
    if (fittedWithPins.current === userPointKey) return
    if (hasPins) fittedWithPins.current = userPointKey
    // 지도가 위치로 먼저 이동한 뒤에 맞추도록 다음 틱에 요청한다
    const t = setTimeout(() => setCameraRequest(fitWithNearest(origin.point, markersRef.current)), 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPointKey, hasPins])
  // 휴대폰 첫 화면: 지도가 하노이 중심이라 박닌 핀이 지도 끝에 붙어 안 보였다(2026-10-21 Lee "메인에 지도 핀이 없는데").
  // 공고 핀이 처음 들어오면 한 번, 핀 전체가 보이게 지도 가운데·확대를 맞춘다. 내 위치를 쓰는 중이면 건드리지 않는다.
  const fittedOnce = useRef(false)
  useEffect(() => {
    if (fittedOnce.current || origin.kind === 'user' || markers.length === 0) return
    fittedOnce.current = true
    const lats = markers.map((m) => m.lat), lngs = markers.map((m) => m.lng)
    const span = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs), 0.01)
    const zoom = Math.max(7, Math.min(13, Math.floor(Math.log2(360 / span)) - 2))
    setCameraRequest({ center: { lat: (Math.max(...lats) + Math.min(...lats)) / 2, lng: (Math.max(...lngs) + Math.min(...lngs)) / 2 }, zoom })
  }, [markers, origin.kind])

  // 첫 방문 위치 허용(LocationPrompt)으로 받은 위치를 바로 지도 출발점으로 쓴다(2026-10-20 Lee).
  useEffect(() => {
    const apply = (p: { lat: number; lng: number; accuracy: number }) => {
      if (!validPoint({ lat: p.lat, lng: p.lng })) return
      setRadiusActive(true)
      setOrigin({ kind: 'user', point: { lat: p.lat, lng: p.lng }, accuracyMeters: p.accuracy })
      // 지도 이동은 아래 '내 위치 + 가까운 핀' 맞춤이 한다(2026-10-21)
    }
    const now = getUserLocation()
    if (now) apply(now)
    return onUserLocation(apply)
  }, [])

  const useCurrentLocation = () => {
    setChosenRegion(null)
    setLocMenuOpen(false)
    setPickingOrigin(false)
    if (typeof navigator === 'undefined' || !navigator.geolocation) { setGeoState('unsupported'); return }
    setGeoState('loading')
    const request = ++locationRequest.current
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (request !== locationRequest.current) return
        if (!validPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude })) { setGeoState('denied'); return }
        setRadiusActive(true)
        setOrigin({ kind: 'user', point: { lat: pos.coords.latitude, lng: pos.coords.longitude }, accuracyMeters: pos.coords.accuracy })
        // 지도 이동은 아래 '내 위치 + 가까운 핀' 맞춤이 한다(2026-10-21)
        setGeoState('idle')
      },
      () => { if (request === locationRequest.current) { setGeoState('denied'); setLocMenuOpen(true) } },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }

  const chooseRegion = (label: string) => {
    const next = regionOrigin(label)
    if (next) { locationRequest.current += 1; setChosenRegion(label); setRadiusActive(false); setPickingOrigin(false); setOrigin(next); setCameraRequest({center: next.point, zoom: 10}); setGeoState('idle'); setLocMenuOpen(false) }
  }

  const update = (patch: Partial<HomeMapFilterState>) => setFilters((f) => ({ ...f, ...patch }))
  // 2026-10-15 사용자 결정: 'Ngành nghề'는 공식 직업분류 2단계 그룹 — 실제 공고가 있는 그룹만 보여준다.
  const selectedGroups = filters.occupationGroups ?? []
  const toggleOccupationGroup = (code: string) =>
    update({ occupationGroups: selectedGroups.includes(code) ? selectedGroups.filter((x) => x !== code) : [...selectedGroups, code] })
  const toggleExtra = (k: ExtraConditionKey) =>
    update({ extras: filters.extras.includes(k) ? filters.extras.filter((x) => x !== k) : [...filters.extras, k] })

  const originLabel = origin.kind === 'user' ? 'Vị trí hiện tại của bạn' : origin.kind === 'chosen' ? 'Điểm đã chọn' : origin.label
  const distanceFrom = origin.kind === 'user' ? 'từ vị trí của bạn' : 'từ điểm đã chọn'
  const visibleGroups = showAllCategories ? occupationGroups : occupationGroups.slice(0, OCCUPATION_GROUPS_PRIMARY)
  const activeExtraCount = filters.extras.length
  const emptyReason = loading ? 'Đang tải việc làm…' : jobsError ? 'Chưa tải được đầy đủ việc làm. Vui lòng thử lại sau.' : 'Chưa có việc làm phù hợp với điều kiện đã chọn.'
  const clearRadius = () => { locationRequest.current += 1; setRadiusActive(false); setPickingOrigin(false); setGeoState('idle') }
  const pickOrigin = (point: MapJobPoint) => {
    if (!pickingOrigin || !validPoint(point)) return
    locationRequest.current += 1
    setChosenRegion(null)
    setOrigin({kind:'chosen', point}); setRadiusActive(true); setPickingOrigin(false); setPickedPlace(null); setRecenterRequest(v => v + 1)
  }
  const distanceLabel = selected?.point && selected.distanceKm !== null
    ? selected.point.kind === 'gate' ? `Cách cổng KCN khoảng ${selected.distanceKm.toFixed(1)} km`
      : selected.point.kind === 'area' ? `Cách điểm đại diện khoảng ${selected.distanceKm.toFixed(1)} km` : formatDistanceLabel(selected.distanceKm)
    : null

  const openFilters = (section: number) => {
    filterFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (section === 3) setMoreOpen(true)
    setMobileFiltersOpen(true)
    // Wait for the sheet render before bringing the requested existing section into view.
    requestAnimationFrame(() => controlsRef.current?.querySelectorAll<HTMLElement>('.hme-block')[section]?.scrollIntoView({ block: 'start' }))
  }
  const discoveryState: HomeDiscoveryState = {
    jobs: listEntries.map(entry => entry.job).filter(job => !job.id.startsWith('acceptance-')),
    originLabel: radiusActive ? originLabel : chosenRegion ?? 'Chọn khu vực', geoState, loading, jobsError,
    filterCount: selectedGroups.length + filters.extras.length + (filters.minSalary !== null ? 1 : 0) + (radiusActive || chosenRegion ? 1 : 0),
    locate: useCurrentLocation,
    openLocation: () => { setLocMenuOpen(true); openFilters(0) },
    openFilters,
    showMap: () => { setMobileView('map'); explorerRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }) },
    reset: () => { setFilters(DEFAULT_FILTERS); setChosenRegion(null); clearRadius(); setPickedPlace(null); setSelectedId(null) },
  }

  // 선택 상세(장소·건물 또는 공고). 데스크톱은 오른쪽 패널, 모바일(≤760px)은 하단 sheet(MobileDetailSheet).
  const detail = pickedPlace ? (
    <PlaceDetailPanel
      place={pickedPlace}
      origin={radiusActive ? { label: originLabel, point: origin.point } : null}
      selectedJob={selected?.point?.kind === 'exact' ? { title: selected.job.title, point: selected.point } : null}
      jobs={placeJobs}
      selectableIds={selectableIds}
      mapMode={mapMode}
      onMapModeChange={setMapMode}
      onSelectJob={selectJob}
      onRequestZoom={() => setPlaceZoomRequest((v) => v + 1)}
      onClose={() => setPickedPlace(null)}
    />
  ) : selected ? (
    <div className="hme-job">
      <button type="button" className="hme-job__close" aria-label="Bỏ chọn tin" onClick={() => setSelectedId(null)}><X size={18} /></button>
      <div className="hme-job__company">{selected.job.company}</div>
      <h3 className="hme-job__title">{selected.job.title}</h3>
      <div className="hme-job__chips">
        <span className="hme-tag">{selected.point ? LOCATION_LABELS[selected.point.kind] : 'Đang xác minh vị trí'}</span>
        {distanceLabel && <span className="hme-tag hme-tag--distance">{distanceLabel}</span>}
        {selected.job.salary && <span className="hme-tag hme-tag--salary">{selected.job.salary}</span>}
        {selected.job.urgent && <span className="hme-tag hme-tag--urgent">Tuyển gấp</span>}
        <span className="hme-tag">{CATEGORY_SHORT[selected.job.category]}</span>
        {conditionBadges(selected.job).map((b) => (
          <span key={b.key} className={`hme-tag hme-tag--${b.tone}`}>{b.label}</span>
        ))}
      </div>
      <dl className="hme-job__rows">
        <div><dt><MapPin size={14} aria-hidden /> Khu vực</dt><dd>{selected.job.location || 'Chưa cập nhật'}</dd></div>
        <div><dt><Clock size={14} aria-hidden /> Giờ làm</dt><dd>{selected.job.hours || 'Chưa cập nhật'}</dd></div>
        {selected.job.workPeriod && <div><dt><Briefcase size={14} aria-hidden /> Hình thức</dt><dd>{selected.job.workPeriod}</dd></div>}
      </dl>
      {radiusActive && <p className="hme-job__note">Khoảng cách tính theo đường chim bay {distanceFrom}.</p>}
      {selected.point && selected.point.kind !== 'exact' && <p className="hme-job__note">Đây là vị trí đại diện, không phải vị trí chính xác của nơi làm việc.</p>}
      <NavLink to={`/viec-lam/${selected.job.id}${selected.job.id.startsWith('acceptance-') ? '?mapAcceptance=1' : ''}`} className="hme-job__detail">Xem chi tiết</NavLink>
      <div className="jd2-map-links">
        {directions?.tier === 'approved' && directions.links.map((link) => <span key={link.href}>
          <a className="jd2-map-dir" href={link.viewHref} target="_blank" rel="noopener noreferrer">Xem trên Google Maps</a>{' '}
          <a className="jd2-map-dir" href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a>
        </span>)}
        {directions?.tier === 'gate' && <><a className="jd2-map-dir" href={directions.link.href} target="_blank" rel="noopener noreferrer">{directions.link.label}</a><p className="jd2-map-dir-note">{directions.note}</p></>}
        {directions?.tier === 'address' && <>{directions.links.map((link) => <span key={link.href}>
          <a className="jd2-map-dir" href={link.viewHref} target="_blank" rel="noopener noreferrer">Xem trên Google Maps</a>{' '}
          <a className="jd2-map-dir" href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a>
        </span>)}{directions.call && <a className="jd2-map-dir" href={directions.call.href}>Gọi hỏi đường</a>}<p className="jd2-map-dir-note">{directions.note}</p></>}
        {directions?.tier === 'call' && <a className="jd2-map-dir" href={directions.href}>{directions.label}</a>}
      </div>
      {selected.point?.kind === 'exact' && <NearbyLifePanel state={nearbyState} jobId={selected.job.id} />}
    </div>
  ) : null

  return (
    <>
    {renderBeforeMap?.(discoveryState)}
    <section ref={explorerRef} className={`hme${mobileFiltersOpen ? ' hme--filters-open' : ''} hme--view-${mobileView}`} aria-label="Tìm việc quanh bạn trên bản đồ">
      <div className="hme-mobile-toolbar">
        <h2>Việc làm quanh bạn</h2>
        <div><button type="button" aria-pressed={mobileView === 'map'} onClick={() => setMobileView('map')}>Bản đồ</button><button type="button" aria-pressed={mobileView === 'list'} onClick={() => setMobileView('list')}>Danh sách</button><button type="button" aria-label="Mở bộ lọc bản đồ" onClick={() => openFilters(0)}><SlidersHorizontal size={17} /></button></div>
      </div>
      <div className="hme__controls" ref={controlsRef} role={isMobileLayout && mobileFiltersOpen ? 'dialog' : undefined} aria-modal={isMobileLayout && mobileFiltersOpen ? true : undefined} aria-label="Bộ lọc việc làm">
        <div className="hme-mobile-filter-head"><h2>Bộ lọc việc làm</h2><button type="button" aria-label="Đóng bộ lọc" onClick={() => setMobileFiltersOpen(false)}><X /></button></div>
        {/* 위치 + 검색 반경 — 하나의 기능 */}
        <div className="hme-block">
          <div className="hme-block__head"><MapPin size={16} aria-hidden /> <span>Vị trí</span></div>
          <div className="hme-loc">
            <button type="button" className="hme-loc__current" onClick={() => setLocMenuOpen((v) => !v)} aria-expanded={locMenuOpen}>
              <span className="hme-loc__label">{originLabel}</span>
              <ChevronDown size={16} aria-hidden />
            </button>
            {locMenuOpen && (
              <div className="hme-loc__menu">
                <button type="button" className="hme-loc__use" onClick={useCurrentLocation} disabled={geoState === 'loading'}>
                  <LocateFixed size={15} aria-hidden /> {geoState === 'loading' ? 'Đang xác định vị trí…' : 'Gần tôi'}
                </button>
                {geoState === 'denied' && <p className="hme-loc__hint">Không lấy được vị trí. Hãy chọn khu vực bên dưới.</p>}
                {geoState === 'unsupported' && <p className="hme-loc__hint">Trình duyệt không hỗ trợ định vị. Hãy chọn khu vực.</p>}
                <label className="hme-loc__select-label" htmlFor="hme-region">Chọn khu vực</label>
                <select id="hme-region" className="hme-loc__select" value={isMobileLayout ? chosenRegion ?? '' : origin.kind === 'region' ? origin.label : ''}
                  onChange={(e) => chooseRegion(e.target.value)}>
                  {isMobileLayout ? <option value="" disabled>Chọn khu vực</option> : origin.kind !== 'region' && <option value="">Vị trí hiện tại</option>}
                  {REGION_MACRO_TABS.map((t) => (
                    <optgroup key={t.id} label={t.label}>
                      {t.provinces.map((p) => <option key={p.id} value={p.label}>{p.label}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
            )}
          </div>
          {origin.kind === 'user' && (
            <p className="hme-loc__hint" role="status">
              {Number.isFinite(origin.accuracyMeters) ? `Độ chính xác vị trí: khoảng ${Math.round(origin.accuracyMeters)} m.` : 'Chưa xác định được độ chính xác vị trí.'}
              {locationAccuracyWarning(origin.accuracyMeters, filters.radiusKm) && ' Sai số lớn hơn bán kính tìm kiếm; kết quả gần bạn có thể chưa chính xác.'}
            </p>
          )}
          <button type="button" className="hme-loc__use" onClick={useCurrentLocation} disabled={geoState === 'loading'}>Gần tôi</button>
          <button type="button" className="hme-loc__use" aria-pressed={pickingOrigin} onClick={() => { locationRequest.current += 1; setGeoState('idle'); setPickingOrigin(v => !v) }}>Chọn điểm trên bản đồ</button>
          {pickingOrigin && <p role="status">Chạm một lần trên bản đồ để chọn điểm. <button type="button" onClick={() => setPickingOrigin(false)}>Hủy</button></p>}
          {!radiusActive && <p className="hme-loc__hint">Không giới hạn khoảng cách. Chọn Gần tôi hoặc một điểm để tìm theo bán kính.</p>}
          {radiusActive && <>
          <button type="button" className="hme-more-link" onClick={clearRadius}>Bỏ giới hạn bán kính</button>
          <p className="hme-loc__hint">Khoảng cách đường chim bay · {originLabel}</p>
          <div className="hme-radius">
            <div className="hme-radius__row">
              <span>Bán kính tìm kiếm</span>
              <strong>{formatSearchRadius(filters.radiusKm)}</strong>
            </div>
            <input type="range" min={RADIUS_MIN_KM} max={RADIUS_MAX_KM} step={0.1} value={filters.radiusKm}
              aria-label="Bán kính tìm kiếm (km)" aria-valuetext={formatSearchRadius(filters.radiusKm)} onChange={(e) => update({ radiusKm: normalizeSearchRadius(Number(e.target.value)) })} />
            <div className="hme-radius__scale"><span>{formatSearchRadius(RADIUS_MIN_KM)}</span><span>{formatSearchRadius(RADIUS_MAX_KM)}</span></div>
            <div className="hme-radius__quick" aria-label="Chọn nhanh bán kính">
              {[0.1, 0.3, 0.5, 1, 3, 5, 10, 20].map((km) => (
                <button key={km} type="button" aria-pressed={filters.radiusKm === km} className={filters.radiusKm === km ? 'is-active' : ''} onClick={() => update({ radiusKm: km })}>{formatSearchRadius(km)}</button>
              ))}
            </div>
          </div>
          </>}
        </div>

        {/* 급여 — 최소 희망 월급 */}
        <div className="hme-block">
          <div className="hme-block__head"><Wallet size={16} aria-hidden /> <span>Lương tháng tối thiểu</span></div>
          <div className="hme-chips">
            {SALARY_OPTIONS.map((v) => (
              <button key={v} type="button" className={`hme-chip${filters.minSalary === v ? ' is-active' : ''}`}
                aria-pressed={filters.minSalary === v} onClick={() => update({ minSalary: filters.minSalary === v ? null : v })}>
                {formatSalaryOption(v)}
              </button>
            ))}
          </div>
          <label className="hme-check">
            <input type="checkbox" checked={filters.includeNegotiable} onChange={(e) => update({ includeNegotiable: e.target.checked })} />
            Gồm cả tin lương thỏa thuận
          </label>
        </div>

        {/* 업종 */}
        <div className="hme-block">
          <div className="hme-block__head"><Briefcase size={16} aria-hidden /> <span>Ngành nghề</span></div>
          {occupationGroups.length === 0 ? (
            <p className="hme-empty-note">{loading ? 'Đang tải…' : 'Chưa có việc làm phân loại theo nghề trong khu vực này.'}</p>
          ) : (
            <>
              <div className="hme-chips hme-chips--list">
                {visibleGroups.map((g) => {
                  const name = occupationNames.get(g.code) ?? `Nhóm nghề ${g.code}`
                  const active = selectedGroups.includes(g.code)
                  return (
                    <button key={g.code} type="button" title={name} className={`hme-chip${active ? ' is-active' : ''}`}
                      aria-pressed={active} onClick={() => toggleOccupationGroup(g.code)}>
                      {name} <span className="hme-chip__count">{g.count}</span>
                    </button>
                  )
                })}
              </div>
              {occupationGroups.length > OCCUPATION_GROUPS_PRIMARY && (
                <button type="button" className="hme-more-link" onClick={() => setShowAllCategories((v) => !v)}>
                  {showAllCategories ? 'Thu gọn' : 'Xem thêm'} {showAllCategories ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
                </button>
              )}
            </>
          )}
        </div>

        {/* 조건 더보기 */}
        <div className="hme-block">
          <button type="button" className="hme-block__toggle" onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen}>
            <SlidersHorizontal size={16} aria-hidden /> <span>Thêm điều kiện{activeExtraCount > 0 ? ` (${activeExtraCount})` : ''}</span>
            {moreOpen ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}
          </button>
          {moreOpen && (
            <div className="hme-extra">
              {EXTRA_CONDITION_GROUPS.map((g) => (
                <div key={g.title} className="hme-extra__group">
                  <div className="hme-extra__title">{g.title}</div>
                  <div className="hme-chips">
                    {g.items.map((c) => {
                      const available = isConditionAvailable(c.key)
                      const on = filters.extras.includes(c.key)
                      return (
                        <button key={c.key} type="button" className={`hme-chip hme-chip--sm${on ? ' is-active' : ''}`}
                          disabled={!available} aria-pressed={on} title={available ? undefined : 'Đang cập nhật dữ liệu'}
                          onClick={() => toggleExtra(c.key)}>
                          {c.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
              <p className="hme-extra__note">Chỉ hiện tin đã ghi rõ điều kiện này. Tin chưa cập nhật thông tin sẽ không được tính.</p>
              {activeExtraCount > 0 && (
                <button type="button" className="hme-more-link" onClick={() => update({ extras: [] })}>Bỏ chọn điều kiện</button>
              )}
            </div>
          )}
        </div>
        <div className="hme-mobile-filter-actions"><button type="button" onClick={discoveryState.reset}>Đặt lại</button><button type="button" onClick={() => setMobileFiltersOpen(false)}>Xem {listEntries.length} việc làm</button></div>
      </div>

      <div className="hme__map" ref={mapBoxRef}>
        {!mapInView || !viewportReady ? <div className="hme-map hme-map--loading">Đang tải bản đồ…</div> : (
        <Suspense fallback={<div className="hme-map hme-map--loading">Đang tải bản đồ…</div>}>
          <HomeMapCanvas initialViewport={initialViewport} cameraRequest={cameraRequest} onViewportChange={onViewportChange} radiusActive={radiusActive} pickingOrigin={pickingOrigin} onOriginPick={pickOrigin} origin={origin.point} originIsUser={origin.kind === 'user'} radiusKm={filters.radiusKm} recenterRequest={recenterRequest}
            markers={markers} selectedId={selectedId} selectedPoint={selected?.point} onSelect={selectJob} onNearbyChange={setNearbyState}
            mapMode={mapMode} onMapModeChange={setMapMode} pickedPlace={pickedPlace} onPlacePick={setPickedPlace} placeZoomRequest={placeZoomRequest} />
        </Suspense>
        )}
      </div>

      <aside className="hme__panel" aria-live="polite" ref={panelRef}>
        {detail && !isMobileLayout ? detail : (
          <div className="hme-intro">
            <h2 className="hme-intro__title">Tìm việc quanh bạn</h2>
            <p className="hme-intro__summary">{radiusActive ? `${originLabel} · ${formatSearchRadius(filters.radiusKm)}` : isMobileLayout ? `${chosenRegion ?? 'Tất cả khu vực'} · Không giới hạn khoảng cách` : 'Hà Nội · Bắc Ninh / Khu vực trên bản đồ · Không giới hạn khoảng cách'}</p>
            <div className="hme-intro__count"><strong>{result.visibleCount}</strong> việc làm trong khung bản đồ hiện tại</div>
            {radiusActive && <p>{result.radiusJobs.length} việc làm có vị trí chính xác trong bán kính</p>}
            <p>{result.unresolvedCount} tin chưa xác định được vị trí · Ghim nét đứt: vị trí đại diện</p>
            <div className="hme-map-r1-results">
              {listEntries.map(e => <button type="button" key={e.job.id} onClick={() => selectJob(e.job.id)}>{e.job.title}<small>{e.point ? LOCATION_LABELS[e.point.kind] : 'Đang xác minh vị trí'}</small></button>)}
            </div>
            <p className="hme-intro__hint">
              {nearby.length > 0 ? 'Chọn một ghim trên bản đồ để xem thông tin tin tuyển dụng.' : emptyReason}
            </p>
            {origin.kind !== 'user' && (
              <button type="button" className="hme-intro__locate" onClick={useCurrentLocation} disabled={geoState === 'loading'}>
                <LocateFixed size={16} aria-hidden /> {geoState === 'loading' ? 'Đang xác định vị trí…' : 'Gần tôi'}
              </button>
            )}
            {geoState === 'denied' && <p className="hme-loc__hint">Không lấy được vị trí. Bạn có thể chọn khu vực ở mục Vị trí.</p>}
          </div>
        )}
      </aside>
      {isMobileLayout && detail && (
        <MobileDetailSheet selectionKey={pickedPlace?.key ?? selectedId ?? ''} label={pickedPlace ? 'Thông tin địa điểm' : 'Thông tin tin tuyển dụng'}
          onClose={() => { setPickedPlace(null); setSelectedId(null) }}>
          {detail}
        </MobileDetailSheet>
      )}
      <span hidden data-testid="home-map-job-counts" data-loading={loading} data-loaded={new Set(mapJobs.map(j => j.id)).size}
        data-in-radius={result.radiusJobs.length} data-matched={result.visibleCount} data-unverified={result.unresolvedCount} data-radius-active={radiusActive} />
    </section>
    {renderAfterMap?.(discoveryState)}
    </>
  )
}

