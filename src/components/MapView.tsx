import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import JobCard from './JobCard'
import { useAuth } from '../context/AuthContext'
import { useJobs } from '../context/JobsContext'
import {
  addAddressSearchHistory,
  clearAddressSearchHistory,
  getAddressSearchHistory,
  reverseGeocode,
  searchAddress,
  type AddressSuggestion,
} from '../lib/geoapify'
import { calcDistanceKm, resolveDistanceSearchPoint, VIETNAM_CENTER } from '../lib/jobCoords'
import { loadSavedJobIds, toggleSavedJobId } from '../lib/storage'
import type { Job } from '../types/job'

// 2026-09-20 사용자 지시("메인화면 밑으로 하지말고 별도 화면은 만들어줘,
// Công cụ 이거처럼") — 오늘 Home.tsx에 만들었던 "Gần tôi" 상시 검색+지도+
// 리스트 뷰(카카오맵 스타일)를 이 전용 페이지(`/ban-do`, 헤더에선 아직
// 미연결)로 옮긴다. 이 페이지 자체는 원래 있었지만(GPS+반경+지도핀+거리순
// 리스트, 옛 OSM 타일 직접 호출 방식) 헤더 어디에도 연결이 안 돼 방치돼
// 있었던 걸 발견 — 새로 만들지 않고 이 기존 라우트를 오늘 만든 기능
// (Geoapify 타일, 주소 검색+히스토리, 안전한 핀 클릭 링크)으로 교체한다.
const JobLocationMap = lazy(() => import('./JobLocationMap'))

export default function MapView() {
  const { jobs } = useJobs()
  const { user } = useAuth()

  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [nearAddressLabel, setNearAddressLabel] = useState<string | null>(null)
  const [geoErrorMsg, setGeoErrorMsg] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [nearRadius, setNearRadius] = useState(5)
  const [addressQuery, setAddressQuery] = useState('')
  const [addressSearching, setAddressSearching] = useState(false)
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([])
  const [addressSearched, setAddressSearched] = useState(false)
  const [addressHistory, setAddressHistory] = useState<string[]>(() => getAddressSearchHistory())
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set(loadSavedJobIds(user?.id)))

  useEffect(() => {
    const sync = () => setSavedIds(new Set(loadSavedJobIds(user?.id)))
    sync()
    window.addEventListener('vgb:saved-jobs', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('vgb:saved-jobs', sync)
      window.removeEventListener('storage', sync)
    }
  }, [user?.id])
  const handleToggleSave = useCallback((job: Job) => {
    toggleSavedJobId(job.id, user?.id)
    setSavedIds(new Set(loadSavedJobIds(user?.id)))
  }, [user?.id])

  // 2026-09-20 사용자 지시(카카오맵 "주변 탐색" 아이콘 줄 캡처 — "5km,
  // 10km 차등을 두고 공고가 자동반영되서 나열되는 식으로 만들고 싶다") —
  // radius를 넘기면 GPS 확보와 동시에 그 반경으로 바로 설정, 넘기지 않으면
  // 기존처럼 현재 nearRadius를 그대로 씀("Dùng vị trí hiện tại" 버튼은
  // 계속 인자 없이 호출).
  const handleUseCurrentLocation = (radius?: number) => {
    if (locating) return
    if (!navigator.geolocation) { setGeoErrorMsg('Trình duyệt không hỗ trợ định vị.'); return }
    setGeoErrorMsg(null)
    setNearAddressLabel(null)
    if (radius !== undefined) setNearRadius(radius)
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserCoords(coords)
        reverseGeocode(coords.lat, coords.lng).then(setNearAddressLabel)
      },
      () => {
        setLocating(false)
        setGeoErrorMsg('Không thể lấy vị trí. Hãy cho phép định vị để xem việc gần bạn.')
      },
      { timeout: 10_000 },
    )
  }
  const handleAddressSearch = (queryOverride?: string) => {
    const q = (queryOverride ?? addressQuery).trim()
    if (!q || addressSearching) return
    if (queryOverride !== undefined) setAddressQuery(queryOverride)
    setAddressSearching(true)
    setAddressSearched(false)
    addAddressSearchHistory(q)
    setAddressHistory(getAddressSearchHistory())
    searchAddress(q).then((results) => {
      setAddressSearching(false)
      setAddressSearched(true)
      setAddressSuggestions(results)
    })
  }
  const selectAddressSuggestion = (s: AddressSuggestion) => {
    setGeoErrorMsg(null)
    setUserCoords({ lat: s.lat, lng: s.lng })
    setNearAddressLabel(s.label)
    setAddressQuery('')
    setAddressSuggestions([])
    setAddressSearched(false)
  }

  const jobDistances = useMemo<Record<string, { km: number; precise: boolean }>>(() => {
    if (!userCoords) return {}
    const r: Record<string, { km: number; precise: boolean }> = {}
    for (const job of jobs) {
      const point = resolveDistanceSearchPoint(job)
      if (!point) continue
      r[job.id] = { km: calcDistanceKm(userCoords.lat, userCoords.lng, point.lat, point.lng), precise: point.precise }
    }
    return r
  }, [jobs, userCoords])

  const filtered = useMemo(() => {
    if (!userCoords) return []
    return jobs
      .filter((j) => {
        const d = jobDistances[j.id]
        return d !== undefined && d.km <= nearRadius
      })
      .sort((a, b) => (jobDistances[a.id]?.km ?? 99) - (jobDistances[b.id]?.km ?? 99))
  }, [jobs, userCoords, jobDistances, nearRadius])

  return (
    <div className="page mapview-page">
      <header className="page-header">
        <h1 className="page-header__title">📍 Việc làm gần bạn</h1>
        <p className="page-header__lead">
          Dùng vị trí hiện tại hoặc nhập địa chỉ để xem việc làm trong bán kính gần bạn trên bản đồ.
        </p>
      </header>

      <div className="near-me-view__split">
        <div className="near-me-view__sidebar">
          <div className="near-me-address-search">
            <div className="near-me-address-search__row">
              <input
                type="text"
                className="field__input"
                placeholder="Nhập địa chỉ, quận/huyện, thành phố..."
                value={addressQuery}
                onChange={(e) => setAddressQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddressSearch() } }}
              />
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => handleAddressSearch()}
                disabled={addressSearching || !addressQuery.trim()}
              >
                {addressSearching ? 'Đang tìm...' : 'Tìm'}
              </button>
            </div>
            {addressSuggestions.length > 0 && (
              <ul className="near-me-address-suggestions">
                {addressSuggestions.map((s, i) => (
                  <li key={i}>
                    <button type="button" onClick={() => selectAddressSuggestion(s)}>{s.label}</button>
                  </li>
                ))}
              </ul>
            )}
            {addressSearched && addressSuggestions.length === 0 && !addressSearching && (
              <p className="hint">Không tìm thấy địa chỉ phù hợp, hãy thử nhập chi tiết hơn.</p>
            )}
            {addressHistory.length > 0 && addressSuggestions.length === 0 && !addressSearched && (
              <div className="near-me-address-history">
                <div className="near-me-address-history__head">
                  <span>Lịch sử tìm kiếm</span>
                  <button
                    type="button"
                    className="near-me-address-history__clear"
                    onClick={() => { clearAddressSearchHistory(); setAddressHistory([]) }}
                  >
                    Xóa hết
                  </button>
                </div>
                <ul className="near-me-address-suggestions">
                  {addressHistory.map((q) => (
                    <li key={q}>
                      <button type="button" onClick={() => handleAddressSearch(q)}>🕘 {q}</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {!userCoords && (
            <div className="near-me-explore">
              <p className="near-me-explore__label">Khám phá gần đây</p>
              <div className="near-me-explore__row">
                <button
                  type="button"
                  className="near-me-explore__item"
                  onClick={() => handleUseCurrentLocation(5)}
                  disabled={locating}
                >
                  <span className="near-me-explore__icon" aria-hidden>📍</span>
                  <span className="near-me-explore__text">Trong 5km</span>
                </button>
                <button
                  type="button"
                  className="near-me-explore__item"
                  onClick={() => handleUseCurrentLocation(10)}
                  disabled={locating}
                >
                  <span className="near-me-explore__icon" aria-hidden>📍</span>
                  <span className="near-me-explore__text">Trong 10km</span>
                </button>
              </div>
            </div>
          )}
          <div className="near-me-view__controls">
            <button type="button" className="btn btn--primary btn--sm" onClick={() => handleUseCurrentLocation()} disabled={locating}>
              {locating ? 'Đang định vị...' : userCoords ? 'Cập nhật vị trí' : 'Dùng vị trí hiện tại'}
            </button>
            {userCoords && (
              <div className="near-me-view__radii" role="group" aria-label="Bán kính tìm kiếm">
                {[1, 3, 5, 10].map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`near-me-controls__radius-btn${nearRadius === r ? ' is-active' : ''}`}
                    onClick={() => setNearRadius(r)}
                  >
                    {r} km
                  </button>
                ))}
              </div>
            )}
          </div>
          {geoErrorMsg && <p className="near-me-status__text near-me-status__text--error">📍 {geoErrorMsg}</p>}
          <p className="near-me-status__summary">
            📍 {userCoords
              ? `${nearAddressLabel ? `Đang tìm việc gần ${nearAddressLabel}` : 'Đang dùng vị trí hiện tại của bạn'} · Bán kính ${nearRadius} km · ${filtered.length} kết quả`
              : 'Chưa xác định vị trí — dùng GPS hoặc nhập địa chỉ ở trên để xem việc làm gần bạn.'}
          </p>
          {!userCoords ? (
            <p className="hint">Danh sách công việc sẽ hiện ra ở đây sau khi xác định vị trí.</p>
          ) : filtered.length === 0 ? (
            <div className="city-result__empty">
              <span>🔍</span>
              <p>Không có việc làm nào trong bán kính {nearRadius} km.</p>
              {nearRadius < 10 && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setNearRadius(10)}>
                  Mở rộng lên 10 km
                </button>
              )}
            </div>
          ) : (
            <div className="home-jobs-grid">
              {filtered.map((job) => (
                <NavLink key={job.id} className="home-card-wrap" to={`/viec-lam/${job.id}`}>
                  <JobCard
                    job={job}
                    isApplied={false}
                    isSaved={savedIds.has(job.id)}
                    onToggleSave={handleToggleSave}
                    distanceKm={jobDistances[job.id]?.km}
                    distancePrecise={jobDistances[job.id]?.precise}
                  />
                </NavLink>
              ))}
            </div>
          )}
        </div>
        <div className="near-me-view__map">
          <Suspense fallback={<div className="near-me-map__loading">Đang tải bản đồ...</div>}>
            <JobLocationMap
              lat={userCoords?.lat ?? VIETNAM_CENTER.lat}
              lng={userCoords?.lng ?? VIETNAM_CENTER.lng}
              title="Vị trí của bạn"
              zoom={userCoords ? 13 : 5}
              extraMarkers={!userCoords ? [] : [
                { lat: userCoords.lat, lng: userCoords.lng, label: nearAddressLabel || 'Vị trí của bạn', precise: false },
                ...filtered.flatMap((j) => {
                  const point = resolveDistanceSearchPoint(j)
                  if (!point) return []
                  return [{
                    lat: point.lat,
                    lng: point.lng,
                    label: `${j.title} · ${j.company}`,
                    precise: point.precise,
                    href: `/viec-lam/${j.id}`,
                  }]
                }),
              ]}
            />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
