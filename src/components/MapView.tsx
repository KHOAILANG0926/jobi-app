import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useJobs } from '../context/JobsContext'
import { calcDistanceKm, resolveMapLocations } from '../lib/jobCoords'
import type { Job } from '../types/job'

type JobWithDist = Job & { lat: number; lng: number; distance?: number }

export default function MapView() {
  const { jobs: rawJobs } = useJobs()
  const navigate = useNavigate()
  // 2026-09-04 사용자 지시로 수정 — 이전에는 withJobCoordinates()가 실제 좌표가
  // 없는 공고에도 지역/기본 중심점(guessCoordinatesFromLocation, 예: 매칭 지역이
  // 없으면 항상 Đà Nẵng 좌표)을 채워 넣었고, 그 값을 그대로 실제 Leaflet 마커로
  // 찍고 있었다 — "내 위치에서 N km"라는 실제 거리 계산·정렬까지 그 가짜 좌표로
  // 수행되는 문제였다(JobDetail.tsx는 이미 rawLat/rawLng + source==='exact' 게이트로
  // 이 문제를 피하고 있었는데 이 컴포넌트만 그 보호가 없었음). resolveMapLocations()
  // (job_work_locations 우선, 없으면 rawLat/rawLng, 그래도 없으면 source가
  // 'region'/'default'로 표시되는 동일한 안전 함수)를 재사용하고, source==='exact'
  // (실제 근무지 좌표로 확인된 경우)인 공고만 지도에 표시한다 — 검증 안 된 공고는
  // 이 "내 주변 채용" 지도에서 아예 제외한다(가짜 마커 대신 완전히 숨김).
  const jobsWithCoords = useMemo<JobWithDist[]>(() => {
    const out: JobWithDist[] = []
    for (const j of rawJobs) {
      const resolved = resolveMapLocations(j)
      if (resolved.source !== 'exact' || resolved.points.length === 0) continue
      out.push({ ...j, lat: resolved.points[0].lat, lng: resolved.points[0].lng })
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
          ? `<br/><span style="color:#888;font-size:11px">📍 ${job.distance.toFixed(1)} km</span>`
          : ''
      const m = L.marker([job.lat, job.lng])
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
                    <span className="mapview__item-dist">📍 {job.distance.toFixed(1)} km</span>
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
