import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useJobs } from '../context/JobsContext'
import { calcDistanceKm, resolveDistanceSearchPoint } from '../lib/jobCoords'
import type { Job } from '../types/job'

type JobWithDist = Job & { lat: number; lng: number; precise: boolean; distance?: number }

// 근사(precise=false) 위치용 마커 — 정확한 위치가 아님을 시각적으로
// 구분하기 위해 기본 핀 대신 옅은 회색 원을 쓴다(2026-09-05 2단계
// 거리검색 정책: 정밀/근사 마커를 구분해야 함).
const approximateMarkerIcon = L.divIcon({
  className: 'mapview__approx-marker',
  html: '<span style="display:block;width:14px;height:14px;border-radius:50%;background:#9aa0a6;border:2px solid #fff;box-shadow:0 0 2px rgba(0,0,0,.4)"></span>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

export default function MapView() {
  const { jobs: rawJobs } = useJobs()
  const navigate = useNavigate()
  // 2026-09-05 최종 제품 정책(2단계 거리검색으로 개정) — 이 "내 주변 채용"
  // 지도는 거리 기반 기능(반경 필터·거리순 정렬)이므로 지도 표시 자격이
  // 아니라 거리검색 자격 기준을 써야 한다. resolveDistanceSearchPoint()는
  // 이제 정밀(location_verified===true)과 근사(미검증이지만 실제
  // 지오코딩된 exact/ward 좌표) 두 등급을 precise 플래그로 구분해 반환한다
  // — 행정 중심점/모집지역 중심점/회사 등록주소는 여전히 절대 섞이지
  // 않는다. 자격 있는 좌표가 아예 없는 공고만 이 지도에서 계속 제외한다.
  const jobsWithCoords = useMemo<JobWithDist[]>(() => {
    const out: JobWithDist[] = []
    for (const j of rawJobs) {
      const point = resolveDistanceSearchPoint(j)
      if (!point) continue
      out.push({ ...j, lat: point.lat, lng: point.lng, precise: point.precise })
    }
    return out
  }, [rawJobs])

  const mapRef = useRef<HTMLDivElement>(null)
  const mapInst = useRef<L.Map | null>(null)
  const circleRef = useRef<L.Circle | null>(null)
  const markersRef = useRef<L.Marker[]>([])
  const userMarkerRef = useRef<L.CircleMarker | null>(null)

  const [userLoc, setUserLoc] = useState<[number, number] | null>(null)
  const [radius, setRadius] = useState(5)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)

  // Initialize map once
  useEffect(() => {
    if (!mapRef.current || mapInst.current) return
    const map = L.map(mapRef.current).setView([16.0471, 108.2068], 6)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
    }).addTo(map)
    mapInst.current = map
    return () => {
      map.remove()
      mapInst.current = null
    }
  }, [])

  // Get geolocation once on mount
  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc: [number, number] = [pos.coords.latitude, pos.coords.longitude]
        setUserLoc(loc)
        mapInst.current?.setView(loc, 13)
      },
      () => setGeoError('Không thể lấy vị trí. Hãy cho phép định vị.'),
      { timeout: 10_000 },
    )
  }, [])

  // Update user location marker and radius circle
  useEffect(() => {
    if (!userLoc || !mapInst.current) return
    userMarkerRef.current?.remove()
    userMarkerRef.current = L.circleMarker(userLoc, {
      radius: 10,
      color: '#4285F4',
      fillColor: '#4285F4',
      fillOpacity: 1,
    }).addTo(mapInst.current)

    circleRef.current?.remove()
    circleRef.current = L.circle(userLoc, {
      radius: radius * 1000,
      color: '#4285F4',
      fillOpacity: 0.08,
      weight: 2,
    }).addTo(mapInst.current)
  }, [userLoc, radius])

  // Compute filtered + sorted jobs
  const filteredJobs = useMemo<JobWithDist[]>(() => {
    if (!userLoc) return jobsWithCoords
    return jobsWithCoords
      .map((j) => ({ ...j, distance: calcDistanceKm(userLoc[0], userLoc[1], j.lat, j.lng) }))
      .filter((j) => j.distance! <= radius)
      .sort((a, b) => (a.distance ?? 99) - (b.distance ?? 99))
  }, [jobsWithCoords, userLoc, radius])

  // Sync map markers with filtered jobs
  useEffect(() => {
    if (!mapInst.current) return
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []
    filteredJobs.forEach((job) => {
      const distHtml =
        job.distance !== undefined
          ? `<br/><span style="color:#888;font-size:11px">📍 ${job.precise ? '' : '~'}${job.distance.toFixed(1)} km</span>`
          : ''
      const m = L.marker([job.lat, job.lng], job.precise ? undefined : { icon: approximateMarkerIcon })
        .addTo(mapInst.current!)
        .bindPopup(
          `<b style="color:#E84040">${job.title}</b><br/>${job.company}<br/><b style="color:#E84040">${job.salary}</b>${distHtml}`,
        )
        .on('click', () => setSelectedId(job.id))
      markersRef.current.push(m)
    })
  }, [filteredJobs])

  const hasLoc = userLoc !== null

  return (
    <div className="mapview">
      <div className="mapview__bar">
        <span className="mapview__title">📍 Việc làm gần bạn</span>
        <div className="mapview__radii" role="group" aria-label="Bán kính">
          {[1, 3, 5, 10].map((r) => (
            <button
              key={r}
              className={`mapview__radius-btn${radius === r ? ' mapview__radius-btn--active' : ''}`}
              onClick={() => setRadius(r)}
              disabled={!hasLoc}
            >
              {r} km
            </button>
          ))}
        </div>
        <span className="mapview__count">{filteredJobs.length} việc làm</span>
      </div>

      {geoError && <p className="home-geo-error" role="alert">{geoError}</p>}

      <div ref={mapRef} className="mapview__map" />

      <div className="mapview__list">
        <p className="mapview__list-hint">
          {hasLoc ? `Trong vòng ${radius} km từ vị trí của bạn` : 'Tất cả khu vực — cho phép định vị để lọc theo khoảng cách'}
        </p>
        {filteredJobs.length === 0 ? (
          <div className="mapview__empty">
            Không có việc làm trong vòng {radius} km
            <button className="mapview__expand-btn" onClick={() => setRadius(10)}>
              Mở rộng lên 10 km
            </button>
          </div>
        ) : (
          <ul className="mapview__items">
            {filteredJobs.map((job) => (
              <li
                key={job.id}
                className={`mapview__item${selectedId === job.id ? ' mapview__item--selected' : ''}`}
                onClick={() => {
                  setSelectedId(job.id)
                  navigate(`/viec-lam/${job.id}`)
                }}
              >
                <div className="mapview__item-info">
                  <span className="mapview__item-title">{job.title}</span>
                  <span className="mapview__item-meta">{job.company} · {job.location}</span>
                  {job.distance !== undefined && (
                    <span className="mapview__item-dist">📍 {job.precise ? '' : '~'}{job.distance.toFixed(1)} km</span>
                  )}
                </div>
                <span className="mapview__item-salary">{job.salary}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
