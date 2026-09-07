import type { Job } from '../types/job'

const DEFAULT = { lat: 16.0471, lng: 108.2068 }

// 지역명(성/시) → 그 지역의 대표(중심가) 좌표. 실제 회사 위치가 아니라 "이 지역 어딘가"를
// 나타내는 근사치일 뿐이며, 거리 정렬(MapView)이나 지도 뷰포트 중심(JobDetail 지역 지도)
// 용도로만 쓴다 — job.lat/job.lng에 저장하거나 정확한 근무지 marker로 표시하지 않는다.
const PLACES: { keys: string[]; lat: number; lng: number }[] = [
  { keys: ['bac ninh', 'bắc ninh'], lat: 21.1861, lng: 106.0763 },
  { keys: ['ha noi', 'hà nội', 'ha dong', 'hà đông', 'cau giay', 'cầu giấy'], lat: 21.0285, lng: 105.8542 },
  {
    // 2026-09-07 사용자 지시로 추가된 키: 'ba ria'/'vung tau'/'ba ria vung tau'
    // — 2025년 성급 통합(crawler/vn_province_merger_2025.py)으로 Bà Rịa -
    // Vũng Tàu가 Hồ Chí Minh에 합쳐졌다. 실측(job_id=436 "Toàn khu vực, Vũng
    // Tàu")에서 이 좌표가 나와야 함이 확인됨 — 좌표 자체는 새로 만들지 않고
    // crawler/job_quality.py의 PROVINCE_COORDS['Hồ Chí Minh']를 그대로 재사용.
    keys: [
      'ho chi minh', 'hồ chí minh', 'tp.hcm', 'tp. hcm', 'sai gon', 'sài gòn', 'quan 1', 'quận 1', 'q1',
      'ba ria', 'bà rịa', 'vung tau', 'vũng tàu', 'ba ria vung tau', 'bà rịa vũng tàu',
    ],
    lat: 10.7769, lng: 106.7009,
  },
  { keys: ['da nang', 'đà nẵng'], lat: 16.0471, lng: 108.2068 },
  { keys: ['binh duong', 'bình dương'], lat: 11.3254, lng: 106.4774 },
  {
    // 2026-09-07 사용자 지시로 'hai duong'/'hải dương' 추가 — 2025년 통합으로
    // Hải Dương가 Hải Phòng에 합쳐짐(vn_province_merger_2025.py).
    keys: ['hai phong', 'hải phòng', 'hai duong', 'hải dương'],
    lat: 20.8449, lng: 106.6881,
  },
  { keys: ['can tho', 'cần thơ'], lat: 10.0452, lng: 105.7469 },
  {
    // 2026-09-07 사용자 지시로 'khanh hoa'/'khánh hòa' 추가 — Khánh Hòa는
    // 통합 없이 유지된 성(자기 자신 그룹)이고, 그 성도(省都)가 이미 이
    // 목록에 있는 Nha Trang이라 같은 좌표를 그대로 공유한다.
    keys: ['nha trang', 'khanh hoa', 'khánh hòa'],
    lat: 12.2388, lng: 109.1967,
  },
  { keys: ['hue', 'huế'], lat: 16.4637, lng: 107.5909 },
  { keys: ['hung yen', 'hưng yên'], lat: 20.6567, lng: 106.0511 },
  {
    // 2026-09-07 사용자 지시로 'binh phuoc'/'bình phước' 추가 — 2025년
    // 통합으로 Bình Phước가 Đồng Nai에 합쳐짐.
    keys: ['dong nai', 'đồng nai', 'bien hoa', 'biên hòa', 'binh phuoc', 'bình phước'],
    lat: 10.9453, lng: 106.8243,
  },
  { keys: ['long an', 'tan an', 'tân an'], lat: 10.5333, lng: 106.4167 },
  { keys: ['quang ninh', 'quảng ninh', 'ha long', 'hạ long'], lat: 20.9515, lng: 107.0797 },
  { keys: ['thai nguyen', 'thái nguyên'], lat: 21.5928, lng: 105.8442 },
  { keys: ['bac giang', 'bắc giang'], lat: 21.2731, lng: 106.1946 },

  // ── 2026-09-07 사용자 지시로 추가 — pending 근무지(region_only)의 실제
  // 운영 데이터(job_work_locations.matched_recruitment_regions)를 읽기
  // 전용으로 집계한 결과 findRegionCenter가 인식하지 못하던 성·시들. 좌표는
  // 임의로 만들지 않고 crawler/job_quality.py의 PROVINCE_COORDS와
  // crawler/vn_province_merger_2025.py의 2025년 성급 통합표(신뢰할 수 있는
  // 두 공개 자료로 교차 확인됨)를 그대로 재사용한다 — 통합으로 사라진
  // 옛 성 이름은 통합된 새 성의 PROVINCE_COORDS 좌표를 그대로 쓴다.
  {
    // Hòa Bình -> Phú Thọ(2025년 통합, Phú Thọ + Vĩnh Phúc + Hòa Bình).
    keys: ['phu tho', 'phú thọ', 'hoa binh', 'hòa bình'],
    lat: 21.4208, lng: 105.2306,
  },
  {
    // Hà Nam/Nam Định 흡수 통합: Ninh Bình + Hà Nam + Nam Định.
    keys: ['ninh binh', 'ninh bình', 'ha nam', 'hà nam', 'nam dinh', 'nam định'],
    lat: 20.2506, lng: 105.9744,
  },
  {
    // Tiền Giang -> Đồng Tháp(2025년 통합, Đồng Tháp + Tiền Giang).
    keys: ['dong thap', 'đồng tháp', 'tien giang', 'tiền giang'],
    lat: 10.4938, lng: 105.6881,
  },
  { keys: ['nghe an', 'nghệ an'], lat: 18.6796, lng: 105.6813 },
  {
    // Lâm Đồng: 통합 없이 유지된 성(Đắk Nông/Bình Thuận을 흡수) — 자기 자신 그룹.
    keys: ['lam dong', 'lâm đồng'],
    lat: 11.9404, lng: 108.4583,
  },
  {
    // Trà Vinh/Bến Tre -> Vĩnh Long(2025년 통합, Vĩnh Long + Bến Tre + Trà Vinh).
    keys: ['vinh long', 'vĩnh long', 'ben tre', 'bến tre', 'tra vinh', 'trà vinh'],
    lat: 10.2537, lng: 105.9722,
  },
  {
    // Phú Yên -> Đắk Lắk(2025년 통합, Đắk Lắk + Phú Yên).
    keys: ['dak lak', 'đắk lắk', 'phu yen', 'phú yên'],
    lat: 12.6667, lng: 108.0500,
  },
  {
    // Yên Bái -> Lào Cai(2025년 통합, Lào Cai + Yên Bái). Lào Cai는 job_quality.
    // PROVINCE_COORDS에 없어(그 표는 실제로 등장한 성 위주로만 채워짐) 재사용할
    // 기존 좌표가 없다 — Lào Cai 시(省都)의 공개된 실제 좌표를 직접 사용한다
    // (임의의 사업장 좌표가 아니라 이미 잘 알려진 행정중심지 좌표).
    keys: ['lao cai', 'lào cai', 'yen bai', 'yên bái'],
    lat: 22.4809, lng: 103.9755,
  },
  {
    // Lạng Sơn: 통합 없이 유지된 성. job_quality.PROVINCE_COORDS에 없어(위와
    // 동일한 이유) Lạng Sơn 시의 공개된 실제 좌표를 직접 사용한다.
    keys: ['lang son', 'lạng sơn'],
    lat: 21.8537, lng: 106.7610,
  },
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

export type MapCoordinateSource = 'exact' | 'address' | 'district' | 'region' | 'pending' | 'default'

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
 * Resolves the best available SINGLE point for a job with no job_work_locations
 * rows at all (legacy jobs, or a job whose recruitment_regions is also empty) —
 * in priority order:
 * 1. `exact`   — real lat/lng stored on the job (local_jobs.lat/lng).
 * 2. `region`  — the location text matches a known province/city in `PLACES` (city-level
 *    center, not the real workplace).
 * 3. `default` — no usable location text at all; falls back to the Vietnam-wide center.
 * `region`/`default` coordinates are for drawing the map only — never write them back to
 * `job.lat`/`job.lng` or persist them anywhere.
 *
 * `district`/`address` are never returned by THIS function (kept for backward
 * compatibility with existing callers of the single-point API) — `resolveMapLocations()`
 * is the one that actually reaches an `address`-tier point, for a job that DOES have
 * job_work_locations rows carrying a geocoder-derived (but unverified) coordinate.
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

export interface ResolvedMapPoint {
  lat: number
  lng: number
  label?: string
  /** true only for a genuinely precise workplace coordinate — coordinateAccuracy
   *  === 'exact', or 'ward' with locationVerified === true (원문 좌표로 실제
   *  확인된 근무구역). false for every kind of approximate/fallback point: an
   *  unverified geocoder coordinate (ward without verification, or 'region'),
   *  a province/district administrative-center lookup, or a recruitment-region
   *  center. UI uses this to choose marker style and the "정확한 위치" vs
   *  "대략적인 위치" caption — it must NEVER be used to decide distance-search
   *  eligibility (2026-09-05 정책: 지도 표시 자격과 거리검색 자격은 별개 —
   *  거리검색은 resolveDistanceSearchPoint()만 쓴다). */
  precise: boolean
}

export interface ResolvedMapLocations {
  points: ResolvedMapPoint[]
  source: MapCoordinateSource
  zoom: number
}

/** job_work_locations.geocode_status 문자열 — types/job.ts의 GeocodeStatus와
 *  값 집합은 같지만, 이 파일이 그 타입에 의존하지 않고도 쓸 수 있도록
 *  별도로 좁혀 선언한다(CoordinateAccuracyLike와 동일한 이유). */
type GeocodeStatusLike = 'pending' | 'success' | 'failed' | 'manual'

interface WorkLocationLike {
  rawAddress: string
  lat?: number
  lng?: number
  coordinateAccuracy?: CoordinateAccuracyLike
  locationVerified?: boolean
  matchedRecruitmentRegions?: string[]
  /** 'pending'이면 아직 지오코딩을 시도하지 않은 상태(주로 addressAccuracy
   *  'region_only') — resolveMapLocations()가 이 값을 확인해 "위치 확인
   *  중"으로 구분한다(2026-09-07 사용자 지시). 단, addressAccuracy가
   *  'region_only'면 이 상태여도 기존 findRegionCenter() 지역 대표 지도를
   *  그대로 보여준다 — "아직 못 정한 것"과 "원문 자체가 지역 수준"은 서로
   *  다른 사실이고, 후자는 pending 여부와 무관하게 항상 지역 대표 위치를
   *  보여줘 왔다(2026-09-07 사용자 지시로 수정 — 처음 pending 처리를 넣을 때
   *  이 기존 동작과 충돌이 생겼던 것을 바로잡음). */
  geocodeStatus?: GeocodeStatusLike
  /** job_work_locations.address_accuracy — 'region_only'면 이 근무지
   *  텍스트 자체가 성·시/구·군 수준이라 처음부터 특정 지오코딩 대상이
   *  아니었다(geocodeStatus가 'pending'으로 영구히 남는 게 정상). 위
   *  geocodeStatus 설명 참고. */
  addressAccuracy?: AddressAccuracyLike
}

/** coordinate_accuracy 문자열 — types/job.ts의 CoordinateAccuracy와 값 집합은
 *  같지만, 이 파일이 그 타입에 의존하지 않고도(순수 유틸리티 유지) 쓸 수
 *  있도록 별도로 좁혀 선언한다. */
type CoordinateAccuracyLike = 'exact' | 'ward' | 'region' | 'unresolved'

/** address_accuracy 문자열 — types/job.ts의 AddressAccuracy와 값 집합은
 *  같지만, 위 CoordinateAccuracyLike와 동일한 이유로 별도 선언한다. */
type AddressAccuracyLike = 'exact_text' | 'region_only'

/** 이 근무지 좌표를 "정확한 위치"로 표시해도 되는지 — 지도 마커 스타일과
 *  거리검색 자격 판단 둘 다의 공통 기준(다만 거리검색은 이 값을 직접 쓰지
 *  않고 resolveDistanceSearchPoint()를 통해서만 쓴다 — 두 자격을 같은 한
 *  boolean으로 뭉뚱그리지 않기 위해 함수를 분리해뒀다).
 *
 * 2026-09-05 최종 기준으로 정정: coordinateAccuracy==='exact'만으로는
 * 더 이상 충분하지 않다 — locationVerified===true만 유일한 근거다.
 * 'exact'는 이 컬럼에 남아있는 레거시/오류 데이터(실제 원문 좌표 검증
 * 없이 예전 파이프라인이 'exact'를 써넣은 경우가 있었음)까지 포함할 수
 * 있어, coordinateAccuracy 값만 보고 정확하다고 단정하면 검증되지 않은
 * 좌표가 거리검색·정확한 핀에 섞여 들어갈 수 있다. location_verified는
 * job_work_locations에서 원문 좌표 대조로 실제 확인됐을 때만 true가
 * 되는 값이므로(crawl_topcv.py의 source_verified 참고), 이것만이 유일한
 * 신뢰 근거다. */
function isPreciseWorkLocation(l: { locationVerified?: boolean }): boolean {
  return l.locationVerified === true
}

/**
 * 근무지 1곳을 지도 포인트로 변환한다 — 등급(A~D)과 무관하게 항상 무언가를
 * 반환하려 시도한다(정책: "모든 위치 등급에서 지도 표시"):
 * 1. 이 근무지 자체의 geocode 좌표가 있으면 그대로 쓴다(정확/근사 여부는
 *    precise 플래그로만 구분 — 'ward' 미검증/'region'도 좌표 자체는 있을 수
 *    있고, 이 경우 지오코더가 반환한 "안전한 상위 지역 좌표"로 근사 표시).
 * 2. 좌표가 아예 없으면(region_only 텍스트, 또는 'unresolved') 원문 텍스트
 *    자체에서 알려진 성·시/구·군 이름을 찾아 그 행정 중심으로 근사 표시.
 * 3. 그것도 못 찾으면 이 근무지에 매칭된 모집지역명으로 다시 시도한다.
 * 4. 전부 실패하면 null — 이 근무지 하나는 지도에 점을 못 찍지만(텍스트·
 *    길찾기는 호출부가 이 함수와 무관하게 항상 그대로 보여준다), 다른
 *    근무지가 있으면 그쪽은 계속 표시된다.
 */
function resolveWorkLocationMapPoint(l: WorkLocationLike): ResolvedMapPoint | null {
  if (typeof l.lat === 'number' && typeof l.lng === 'number' && Number.isFinite(l.lat) && Number.isFinite(l.lng)) {
    return { lat: l.lat, lng: l.lng, label: l.rawAddress, precise: isPreciseWorkLocation(l) }
  }
  // 2026-09-07 사용자 지시(충돌 수정): addressAccuracy==='exact_text'인데
  // geocodeStatus==='pending'(아직 지오코딩을 시도조차 안 함)이면, 원문
  // 텍스트에 우연히 알려진 지명이 들어있어도(예: "Aeon Mall Hà Đông"의
  // "Hà Đông") 그걸로 임의 좌표를 만들면 안 된다 — "아직 확인 중"인 구체
  // 주소를 마치 확인된 근사 위치처럼 보여주게 된다. addressAccuracy가
  // 'region_only'인 pending은 원래부터 이 함수 아래의 findRegionCenter
  // fallback을 그대로 타야 한다(기존 동작 유지 — region_only 텍스트는
  // pending 여부와 무관하게 항상 지역 대표 위치를 보여줘 왔음).
  if (l.geocodeStatus === 'pending' && l.addressAccuracy !== 'region_only') {
    return null
  }
  const fromOwnText = findRegionCenter(l.rawAddress)
  if (fromOwnText) return { ...fromOwnText, label: l.rawAddress, precise: false }
  for (const region of l.matchedRecruitmentRegions ?? []) {
    const fromRegion = findRegionCenter(region)
    if (fromRegion) return { ...fromRegion, label: l.rawAddress, precise: false }
  }
  return null
}

/**
 * Multi-marker resolution for JobDetail's map, covering every location tier
 * the 2026-09-05 최종 제품 정책 requires a map for:
 * - 근무지 행이 있으면(좌표 검증 여부와 무관하게) 위치별로 점을 만든다.
 * - 근무지 행이 0건이고 모집지역만 있으면(정책 Tier E) 모집지역별 중심점을
 *   만든다 — 한 좌표를 여러 지역에 복제하지 않고, 지역마다 자기 중심을 쓴다.
 * - 그것도 없으면 기존 resolveMapLocation()의 단일점(지역명 텍스트 매칭 또는
 *   베트남 전체 중심)으로 collapse — 이전 동작과 100% 동일.
 */
export function resolveMapLocations(job: {
  rawLat?: number
  rawLng?: number
  rawLocation?: string
  workLocations?: WorkLocationLike[]
  recruitmentRegions?: string[]
}): ResolvedMapLocations {
  const workLocations = job.workLocations ?? []

  const workLocationPoints = workLocations
    .map(resolveWorkLocationMapPoint)
    .filter((p): p is ResolvedMapPoint => p !== null)

  // 2026-09-07 사용자 지시(충돌 수정) — geocode_status='pending'인 근무지가
  // 있는데 위에서 점을 하나도 못 만들었다면("실패"가 아니라 "아직 확인
  // 안 됨"), 좌표가 없다는 이유로 숨기거나 베트남 기본 중심(source:
  // 'default')으로 표시하지 않고 명확한 'pending' 소스로 구분한다.
  // addressAccuracy==='region_only'인 pending 근무지는 이미 위
  // resolveWorkLocationMapPoint()의 findRegionCenter fallback으로 정상
  // 해결됐을 수 있으므로(기존 동작 유지) 그 경우는 workLocationPoints가
  // 비어있지 않아 이 분기에 걸리지 않는다 — 오직 "지도에 보여줄 점이 하나도
  // 없는" 경우에만 'pending'으로 구분한다.
  if (workLocationPoints.length === 0 && workLocations.some((l) => l.geocodeStatus === 'pending')) {
    return { points: [], source: 'pending', zoom: 5 }
  }

  if (workLocationPoints.length > 0) {
    const anyPrecise = workLocationPoints.some((p) => p.precise)
    return {
      points: workLocationPoints,
      // 'address' — 이 union 멤버는 예전에 "구조화된 주소는 있지만 geocoding
      // API가 없어 도달 불가"로 예약만 돼 있었다(resolveMapLocation() 참고).
      // 이제 실제로 쓰인다: 근무지 좌표가 있지만 전부 미검증(precise=false)
      // 일 때의 지도 소스 값 — "정확한(exact)"도 "지역 텍스트 추측(region)"
      // 도 아닌, "구체적 주소 텍스트에서 나온 근사 좌표"라는 중간 등급.
      source: anyPrecise ? 'exact' : 'address',
      // A single geocoded point can zoom in tighter (street-level) since there's
      // no second point that needs to stay in frame; 2+ points let fitBounds
      // decide the actual view, this is just the initial center's zoom.
      zoom: workLocationPoints.length > 1 ? 12 : anyPrecise ? 16 : 13,
    }
  }

  // 근무지 행 자체가 0건(원문에 "Địa điểm làm việc" 후보가 아예 없음) —
  // 모집지역만 있으면(정책 Tier E) 지역별로 각자의 중심점을 만든다.
  if (workLocations.length === 0 && job.recruitmentRegions && job.recruitmentRegions.length > 0) {
    const regionPoints = job.recruitmentRegions
      .map((region): ResolvedMapPoint | null => {
        const center = findRegionCenter(region)
        return center ? { ...center, label: region, precise: false } : null
      })
      .filter((p): p is ResolvedMapPoint => p !== null)
    if (regionPoints.length > 0) {
      return { points: regionPoints, source: 'region', zoom: regionPoints.length > 1 ? 8 : 11 }
    }
  }

  const single = resolveMapLocation(job)
  return {
    points: [{ lat: single.lat, lng: single.lng, precise: single.source === 'exact' }],
    source: single.source,
    zoom: single.zoom,
  }
}

/** 이 근무지가 "근사(approximate)" 거리검색 자격을 갖는지 — location_
 *  verified는 없지만, 최소한 실제 특정 장소를 지오코딩한 좌표(coordinate
 *  Accuracy가 'exact' 또는 'ward')는 있어 대략적인 거리 계산에 쓸 수 있는
 *  경우. 'region'(행정 중심)/'unresolved'(좌표 없음)는 여기 포함되지
 *  않는다 — 지도·길찾기는 유지하되 거리계산·거리순 정렬에서는 제외한다. */
function isApproximateDistanceEligible(l: { coordinateAccuracy?: CoordinateAccuracyLike }): boolean {
  return l.coordinateAccuracy === 'exact' || l.coordinateAccuracy === 'ward'
}

export interface DistanceSearchPoint {
  lat: number
  lng: number
  /** true = location_verified===true(원문 좌표로 실제 확인) → 정밀 거리검색
   *  자격, 호출부는 정확한 마커 + "N km"로 표시해야 한다. false = 검증은
   *  안 됐지만 실제 지오코딩된 exact/ward 좌표가 있어 근사 거리검색에
   *  포함됨 — 호출부는 근사 마커 + "~N km"(약 N km)로 표시해야 한다. */
  precise: boolean
}

/**
 * 거리검색("내 주변")/거리순 정렬에 써도 되는 좌표만 반환한다 — 지도 표시용
 * resolveMapLocations()와는 완전히 분리된 별도 함수. 2026-09-05 정책 개정
 * (2단계 거리검색 — 이전엔 location_verified===true만 인정해 실제 지오코딩된
 * exact/ward 좌표를 가진 공고 다수가 거리검색에서 통째로 빠졌다):
 * - precise=true: location_verified===true인 실제 근무지 좌표 — 정밀
 *   거리검색.
 * - precise=false: location_verified은 없지만 coordinateAccuracy가
 *   'exact' 또는 'ward'인 실제 지오코딩된 근무지 좌표 — 근사 거리검색.
 * 'region'/'unresolved'(행정 중심/좌표 없음)는 등급과 무관하게 절대
 * 포함하지 않는다. 성·시/구·군 행정 중심(findRegionCenter)이나 모집지역
 * 중심, 회사 등록주소 좌표는 이 함수에 애초에 들어오지 않는다
 * (WorkLocationLike는 job_work_locations의 실제 근무지 좌표만 나타낸다).
 */
export function resolveDistanceSearchPoints(job: {
  workLocations?: WorkLocationLike[]
}): DistanceSearchPoint[] {
  return (job.workLocations ?? [])
    .filter((l): l is WorkLocationLike & { lat: number; lng: number } =>
      typeof l.lat === 'number' && typeof l.lng === 'number' &&
      Number.isFinite(l.lat) && Number.isFinite(l.lng) &&
      (isPreciseWorkLocation(l) || isApproximateDistanceEligible(l)),
    )
    .map((l) => ({ lat: l.lat, lng: l.lng, precise: isPreciseWorkLocation(l) }))
}

/**
 * 거리검색용 대표 1점 — 정밀(precise) 좌표가 하나라도 있으면 그중 첫
 * 번째를 우선 반환하고, 없으면 근사(precise=false) 좌표 중 첫 번째.
 * 자격 있는 좌표가 하나도 없으면 null(이 공고는 거리검색/거리순 정렬에서
 * 제외돼야 한다는 뜻 — 지도 fallback으로라도 거리를 계산하면 안 됨).
 */
export function resolveDistanceSearchPoint(job: {
  workLocations?: WorkLocationLike[]
}): DistanceSearchPoint | null {
  const points = resolveDistanceSearchPoints(job)
  return points.find((p) => p.precise) ?? points[0] ?? null
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

/**
 * The search text to use for a work location's external Google Maps link.
 * `rawAddress` is the human-readable label shown on screen and can carry an
 * approximation caveat (e.g. "Bắc Ninh (khu vực làm việc, vị trí trung tâm gần
 * đúng)") — using that as a map search query pollutes the query with prose
 * that isn't part of the place name. `normalizedAddress`, when present, is
 * the cleaned place name meant for exactly this purpose and must be preferred.
 *
 * 2026-09-04 사용자 지시: "Google Maps 텍스트 길찾기는 항상 원문 위치 + 상위
 * 시·도 + Vietnam을 URL 인코딩해 사용" — 근무지 원문 주소 자체에 상위 시·도
 * 이름이 이미 포함돼 있는 경우도 있지만(예: "..., Thành phố Hồ Chí Minh, Tân
 * Phú") 보장되지 않는 주소도 있어(예: "45 Trần Mai Ninh, Tân Bình"만 있고
 * "TP.HCM"이 빠짐), 매번 공고의 상위 시·도(jobLocation)와 "Vietnam"을 명시적
 *으로 덧붙여 국가/지역이 항상 명확하도록 한다 — 동명 지역/해외 동명 장소로
 * 잘못 안내될 위험을 줄인다. jobLocation이 이미 주소 텍스트에 포함돼 있어도
 * 중복 표기 자체는 Google Maps 검색에 해가 되지 않는다(더 구체적으로 만들 뿐).
 */
export function resolveWorkLocationQuery(
  loc: { rawAddress: string; normalizedAddress?: string },
  jobLocation?: string,
): string {
  const base = loc.normalizedAddress || loc.rawAddress
  const parts = [base]
  const province = jobLocation?.trim()
  if (province) parts.push(province)
  parts.push('Vietnam')
  return parts.join(', ')
}

/**
 * 텍스트 검색 기반 Google Maps 링크 — 좌표(lat/lng)를 전혀 쓰지 않는다.
 * `destination`도 `query`와 동일한 텍스트를 쓰므로, Google이 그 텍스트 자체를
 * 다시 geocode해서 길찾기를 계산한다 — 우리 내부 coordinate_accuracy 등급(내부
 * 마커/정확한 거리 계산용)과는 완전히 독립적이다.
 *
 * 2026-09-04 사용자 지시("길찾기 정책 수정"): "location_verified=false인
 * ward도 길찾기 버튼을 숨기지 않음 — 마커와 정확한 거리 계산만 제외. 길찾기는
 * 좌표 대신 raw_address + 상위 시·도 + Vietnam 텍스트 검색으로 실행." — 이
 * 함수는 항상 텍스트 쿼리만 받으므로, 호출부(JobDetail.tsx)가 coordinateAccuracy/
 * locationVerified와 무관하게 항상 호출해도 안전하다(애초에 좌표를 아예
 * 참조하지 않음).
 */
export function googleMapsLinks(query: string): { view: string; directions: string } {
  const q = encodeURIComponent(query)
  return {
    view: `https://www.google.com/maps/search/?api=1&query=${q}`,
    directions: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
  }
}
