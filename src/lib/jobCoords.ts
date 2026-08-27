import type { Job } from '../types/job'

const DEFAULT = { lat: 16.0471, lng: 108.2068 }

// 지역명(성/시) → 그 지역의 대표(중심가) 좌표. 실제 회사 위치가 아니라 "이 지역 어딘가"를
// 나타내는 근사치일 뿐이며, 거리 정렬(MapView)이나 지도 뷰포트 중심(JobDetail 지역 지도)
// 용도로만 쓴다 — job.lat/job.lng에 저장하거나 정확한 근무지 marker로 표시하지 않는다.
const PLACES: { keys: string[]; lat: number; lng: number }[] = [
  { keys: ['bac ninh', 'bắc ninh'], lat: 21.1861, lng: 106.0763 },
  { keys: ['ha noi', 'hà nội', 'ha dong', 'hà đông', 'cau giay', 'cầu giấy'], lat: 21.0285, lng: 105.8542 },
  { keys: ['ho chi minh', 'hồ chí minh', 'tp.hcm', 'tp. hcm', 'sai gon', 'sài gòn', 'quan 1', 'quận 1', 'q1'], lat: 10.7769, lng: 106.7009 },
  { keys: ['da nang', 'đà nẵng'], lat: 16.0471, lng: 108.2068 },
  { keys: ['binh duong', 'bình dương'], lat: 11.3254, lng: 106.4774 },
  { keys: ['hai phong', 'hải phòng'], lat: 20.8449, lng: 106.6881 },
  { keys: ['can tho', 'cần thơ'], lat: 10.0452, lng: 105.7469 },
  { keys: ['nha trang'], lat: 12.2388, lng: 109.1967 },
  { keys: ['hue', 'huế'], lat: 16.4637, lng: 107.5909 },
  { keys: ['hung yen', 'hưng yên'], lat: 20.6567, lng: 106.0511 },
  { keys: ['dong nai', 'đồng nai', 'bien hoa', 'biên hòa'], lat: 10.9453, lng: 106.8243 },
  { keys: ['long an', 'tan an', 'tân an'], lat: 10.5333, lng: 106.4167 },
  { keys: ['quang ninh', 'quảng ninh', 'ha long', 'hạ long'], lat: 20.9515, lng: 107.0797 },
  { keys: ['thai nguyen', 'thái nguyên'], lat: 21.5928, lng: 105.8442 },
  { keys: ['bac giang', 'bắc giang'], lat: 21.2731, lng: 106.1946 },
]

/** Chuẩn hoá để so khớp địa điểm / từ khoá (bỏ dấu, thường). */
export function normalizeViText(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Ước lượng tọa độ từ chuỗi địa điểm (VN) */
export function guessCoordinatesFromLocation(location: string): { lat: number; lng: number } {
  const n = normalizeViText(location)
  if (!n) return { ...DEFAULT }
  for (const p of PLACES) {
    if (p.keys.some((k) => n.includes(normalizeViText(k)))) {
      return { lat: p.lat, lng: p.lng }
    }
  }
  return { ...DEFAULT }
}

/**
 * 지역명 텍스트가 알려진 성/시와 매칭될 때만 그 지역의 중심 좌표를 반환하고, 매칭되는 게
 * 없으면 `null`을 반환한다(guessCoordinatesFromLocation처럼 Đà Nẵng 기본값으로 떨어지지
 * 않음) — 지도를 아예 보여주지 않아야 하는 경우와, "이 지역 근처"라고 보여줘도 되는 경우를
 * 호출부에서 구분할 수 있게 하기 위함. 반환값은 지도 뷰포트 중심 용도일 뿐 실제 근무지
 * 좌표가 아니다.
 */
export function findRegionCenter(location: string): { lat: number; lng: number } | null {
  const n = normalizeViText(location)
  if (!n) return null
  for (const p of PLACES) {
    if (p.keys.some((k) => n.includes(normalizeViText(k)))) {
      return { lat: p.lat, lng: p.lng }
    }
  }
  return null
}

export type MapCoordinateSource = 'exact' | 'address' | 'district' | 'region' | 'default'

export interface ResolvedMapLocation {
  lat: number
  lng: number
  source: MapCoordinateSource
  zoom: number
}

// Geographic center of Vietnam — used only when a job has no usable location data at
// all, so the map still renders something instead of nothing. Never a real workplace.
const VIETNAM_CENTER = { lat: 14.0583, lng: 108.2772 }

/**
 * Resolves the best available point for the JobDetail map, in priority order:
 * 1. `exact`   — real lat/lng stored on the job (local_jobs.lat/lng).
 * 2. `address` / `district` — not reachable today. `local_jobs` only has one free-text
 *    `location` column (no separate street-address or district field), and this project
 *    has no geocoding API to turn free text into a precise point (checked — none exists).
 *    These two source values are kept in the type so a future structured-address or
 *    geocoding addition doesn't need a new union member, but nothing here returns them
 *    yet — claiming that precision without real data would be exactly the "임의 좌표"
 *    this must avoid.
 * 3. `region`  — the location text matches a known province/city in `PLACES` (city-level
 *    center, not the real workplace).
 * 4. `default` — no usable location text at all; falls back to the Vietnam-wide center.
 * `region`/`default` coordinates are for drawing the map only — never write them back to
 * `job.lat`/`job.lng` or persist them anywhere.
 */
export function resolveMapLocation(job: { rawLat?: number; rawLng?: number; rawLocation?: string }): ResolvedMapLocation {
  if (
    typeof job.rawLat === 'number' && typeof job.rawLng === 'number' &&
    Number.isFinite(job.rawLat) && Number.isFinite(job.rawLng)
  ) {
    return { lat: job.rawLat, lng: job.rawLng, source: 'exact', zoom: 15 }
  }
  const loc = job.rawLocation?.trim()
  if (loc) {
    const region = findRegionCenter(loc)
    if (region) return { ...region, source: 'region', zoom: 12 }
  }
  return { ...VIETNAM_CENTER, source: 'default', zoom: 5 }
}

export function calcDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function withJobCoordinates(job: Job): Job {
  if (
    typeof job.lat === 'number' &&
    typeof job.lng === 'number' &&
    Number.isFinite(job.lat) &&
    Number.isFinite(job.lng)
  ) {
    return job
  }
  const c = guessCoordinatesFromLocation(job.location)
  return { ...job, lat: c.lat, lng: c.lng }
}
