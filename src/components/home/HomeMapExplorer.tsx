// 메인 중간 영역 — "내 주변 일자리 지도 + 선택한 공고 패널" (2026-10-01).
// 왼쪽: 탐색 조건(위치·반경 / 급여 / 업종 / Thêm điều kiện) + 지도, 오른쪽: 선택 공고 1차 판단 패널.
// 지도·거리에는 확인된 근무지만 쓴다(homeMapFilters.verifiedJobPoints). 데이터 필드가 아직 없는
// 조건은 비활성으로만 보여주고 가짜 판정을 하지 않는다.
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Briefcase, ChevronDown, ChevronUp, Clock, LocateFixed, MapPin, SlidersHorizontal, Wallet, X } from 'lucide-react'
import { useJobs } from '../../context/JobsContext'
import { CATEGORY_LABELS, CATEGORY_SHORT, ALL_CATEGORIES } from '../../data/categories'
import { REGION_MACRO_TABS } from '../../data/jobRegions'
import { findRegionCenter, formatDistanceLabel } from '../../lib/jobCoords'
import { conditionBadges } from '../../lib/jobConditions'
import {
  DEFAULT_FILTERS, EXTRA_CONDITION_GROUPS, PRIMARY_CATEGORIES, RADIUS_MAX_KM, RADIUS_MIN_KM, SALARY_OPTIONS,
  findNearbyJobs, formatSalaryOption, isConditionAvailable,
  type ExtraConditionKey, type HomeMapFilterState, type MapJobPoint,
} from '../../lib/homeMapFilters'
import type { JobCategory } from '../../types/job'
import { formatSearchRadius, locationAccuracyWarning, normalizeSearchRadius, summarizeMapJobs } from '../../lib/homeMapSearch'

const HomeMapCanvas = lazy(() => import('./HomeMapCanvas'))

const DEFAULT_REGION = 'Bắc Ninh'

type Origin =
  | { kind: 'user'; point: MapJobPoint; accuracyMeters: number }
  | { kind: 'region'; label: string; point: MapJobPoint }

function regionOrigin(label: string): Origin | null {
  const point = findRegionCenter(label)
  return point ? { kind: 'region', label, point } : null
}

export default function HomeMapExplorer() {
  const { jobs, mapAcceptanceJobs, loading, jobsError } = useJobs()
  const mapJobs = useMemo(() => [...jobs, ...mapAcceptanceJobs], [jobs, mapAcceptanceJobs])
  const [origin, setOrigin] = useState<Origin>(() => regionOrigin(DEFAULT_REGION) ?? { kind: 'region', label: 'Hà Nội', point: { lat: 21.0285, lng: 105.8542 } })
  const [filters, setFilters] = useState<HomeMapFilterState>(DEFAULT_FILTERS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [locMenuOpen, setLocMenuOpen] = useState(false)
  const [geoState, setGeoState] = useState<'idle' | 'loading' | 'denied' | 'unsupported'>('idle')
  const [showAllCategories, setShowAllCategories] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [recenterRequest, setRecenterRequest] = useState(0)
  const locationRequest = useRef(0)
  useEffect(() => () => { locationRequest.current += 1 }, [])

  const nearby = useMemo(() => findNearbyJobs(mapJobs, origin.point, filters), [mapJobs, origin, filters])
  const counts = useMemo(() => summarizeMapJobs(mapJobs, origin.point, filters), [mapJobs, origin, filters])
  const selected = nearby.find((n) => n.job.id === selectedId) ?? null

  // 필터·위치 변경으로 선택 공고가 결과에서 빠지면 선택을 해제한다.
  useEffect(() => {
    if (selectedId && !nearby.some((n) => n.job.id === selectedId)) setSelectedId(null)
  }, [nearby, selectedId])

  const markers = useMemo(
    () => nearby.map((n) => ({ id: n.job.id, lat: n.point.lat, lng: n.point.lng, label: `${n.job.title} · ${n.job.company}` })),
    [nearby],
  )

  const useCurrentLocation = () => {
    setLocMenuOpen(false)
    if (typeof navigator === 'undefined' || !navigator.geolocation) { setGeoState('unsupported'); return }
    setGeoState('loading')
    const request = ++locationRequest.current
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (request !== locationRequest.current) return
        setOrigin({ kind: 'user', point: { lat: pos.coords.latitude, lng: pos.coords.longitude }, accuracyMeters: pos.coords.accuracy })
        setRecenterRequest((v) => v + 1)
        setGeoState('idle')
      },
      () => { if (request === locationRequest.current) { setGeoState('denied'); setLocMenuOpen(true) } },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }

  const chooseRegion = (label: string) => {
    const next = regionOrigin(label)
    if (next) { locationRequest.current += 1; setOrigin(next); setRecenterRequest((v) => v + 1); setGeoState('idle'); setLocMenuOpen(false) }
  }

  const update = (patch: Partial<HomeMapFilterState>) => setFilters((f) => ({ ...f, ...patch }))
  const toggleCategory = (c: JobCategory) =>
    update({ categories: filters.categories.includes(c) ? filters.categories.filter((x) => x !== c) : [...filters.categories, c] })
  const toggleExtra = (k: ExtraConditionKey) =>
    update({ extras: filters.extras.includes(k) ? filters.extras.filter((x) => x !== k) : [...filters.extras, k] })

  const originLabel = origin.kind === 'user' ? 'Vị trí hiện tại của bạn' : origin.label
  const distanceFrom = origin.kind === 'user' ? 'từ vị trí của bạn' : `từ trung tâm ${origin.label}`
  const visibleCategories = showAllCategories ? ALL_CATEGORIES : PRIMARY_CATEGORIES
  const activeExtraCount = filters.extras.length
  const emptyReason = loading ? 'Đang tải việc làm…'
    : jobsError ? 'Chưa tải được đầy đủ việc làm. Vui lòng thử lại sau.'
    : counts.loaded === 0 ? 'Chưa có tin tuyển dụng trong dữ liệu hiện tại.'
    : counts.verified === 0 ? 'Các tin hiện có chưa có vị trí làm việc được xác minh.'
    : counts.inRadius === 0 ? `Chưa có việc làm đã xác minh trong ${formatSearchRadius(filters.radiusKm)} ${distanceFrom}.`
    : `Có ${counts.inRadius} việc làm trong bán kính này, nhưng chưa khớp các điều kiện đã chọn.`

  return (
    <section className="hme" aria-label="Tìm việc quanh bạn trên bản đồ">
      <div className="hme__controls">
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
                  <LocateFixed size={15} aria-hidden /> {geoState === 'loading' ? 'Đang xác định vị trí…' : 'Dùng vị trí hiện tại'}
                </button>
                {geoState === 'denied' && <p className="hme-loc__hint">Không lấy được vị trí. Hãy chọn khu vực bên dưới.</p>}
                {geoState === 'unsupported' && <p className="hme-loc__hint">Trình duyệt không hỗ trợ định vị. Hãy chọn khu vực.</p>}
                <label className="hme-loc__select-label" htmlFor="hme-region">Chọn khu vực</label>
                <select id="hme-region" className="hme-loc__select" value={origin.kind === 'region' ? origin.label : ''}
                  onChange={(e) => chooseRegion(e.target.value)}>
                  {origin.kind === 'user' && <option value="">Vị trí hiện tại</option>}
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
          {origin.kind === 'region' && filters.radiusKm < 1 && (
            <p className="hme-loc__hint">Bán kính tính từ trung tâm {origin.label}. Dùng vị trí hiện tại để tìm sát nơi bạn đứng.</p>
          )}
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
          <div className="hme-chips hme-chips--grid">
            {visibleCategories.map((c) => (
              <button key={c} type="button" title={CATEGORY_LABELS[c]} className={`hme-chip${filters.categories.includes(c) ? ' is-active' : ''}`}
                aria-pressed={filters.categories.includes(c)} onClick={() => toggleCategory(c)}>
                {CATEGORY_SHORT[c]}
              </button>
            ))}
          </div>
          <button type="button" className="hme-more-link" onClick={() => setShowAllCategories((v) => !v)}>
            {showAllCategories ? 'Thu gọn' : 'Xem thêm'} {showAllCategories ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
          </button>
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
      </div>

      <div className="hme__map">
        <Suspense fallback={<div className="hme-map hme-map--loading">Đang tải bản đồ…</div>}>
          <HomeMapCanvas origin={origin.point} originIsUser={origin.kind === 'user'} radiusKm={filters.radiusKm} recenterRequest={recenterRequest}
            markers={markers} selectedId={selectedId} onSelect={setSelectedId} />
        </Suspense>
      </div>

      <aside className="hme__panel" aria-live="polite">
        {selected ? (
          <div className="hme-job">
            <button type="button" className="hme-job__close" aria-label="Bỏ chọn tin" onClick={() => setSelectedId(null)}><X size={18} /></button>
            <div className="hme-job__company">{selected.job.company}</div>
            <h3 className="hme-job__title">{selected.job.title}</h3>
            <div className="hme-job__chips">
              <span className="hme-tag hme-tag--distance">{formatDistanceLabel(selected.distanceKm)}</span>
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
            <p className="hme-job__note">Khoảng cách tính theo đường chim bay {distanceFrom}.</p>
            <NavLink to={`/viec-lam/${selected.job.id}${selected.job.id.startsWith('acceptance-') ? '?mapAcceptance=1' : ''}`} className="hme-job__detail">Xem chi tiết</NavLink>
          </div>
        ) : (
          <div className="hme-intro">
            <h2 className="hme-intro__title">Tìm việc quanh bạn</h2>
            <p className="hme-intro__summary">{originLabel} · {formatSearchRadius(filters.radiusKm)}</p>
            <div className="hme-intro__count"><strong>{nearby.length}</strong> việc làm có nơi làm việc đã xác minh trên bản đồ</div>
            <p className="hme-intro__hint">
              {nearby.length > 0 ? 'Chọn một ghim trên bản đồ để xem thông tin tin tuyển dụng.' : emptyReason}
            </p>
            {origin.kind !== 'user' && (
              <button type="button" className="hme-intro__locate" onClick={useCurrentLocation} disabled={geoState === 'loading'}>
                <LocateFixed size={16} aria-hidden /> {geoState === 'loading' ? 'Đang xác định vị trí…' : 'Dùng vị trí hiện tại'}
              </button>
            )}
            {geoState === 'denied' && <p className="hme-loc__hint">Không lấy được vị trí. Bạn có thể chọn khu vực ở mục Vị trí.</p>}
          </div>
        )}
      </aside>
      <span hidden data-testid="home-map-job-counts" data-loaded={counts.loaded} data-verified={counts.verified}
        data-in-radius={counts.inRadius} data-matched={counts.matched} data-unverified={counts.unverified}
        data-outside-radius={counts.outsideRadius} data-filtered-out={counts.filteredOut} />
    </section>
  )
}

