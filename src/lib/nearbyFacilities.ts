// 선택 공고 근무지 주변 생활시설 요약 (2026-10-05). 입력은 지도에 실제로 로드된 VietMap
// 벡터 타일 POI(name/class)뿐이다 — 데이터가 없으면 0으로 남기고 추정값을 만들지 않는다.
import { calcDistanceKm } from './jobCoords'

export type FacilityCategory =
  | 'restaurant' | 'convenience' | 'cafe' | 'pharmacy' | 'clinic'
  | 'bus' | 'lodging' | 'market' | 'bank'

export type NearbyPoiKind = FacilityCategory | 'workplace'

export interface MapPoi {
  name: string
  cls: string
  lat: number
  lng: number
}

export interface NearbyPoi extends MapPoi {
  kind: NearbyPoiKind
  distanceM: number
}

export const FACILITY_CATEGORIES: ReadonlyArray<{ key: FacilityCategory; label: string }> = [
  { key: 'restaurant', label: 'Quán ăn' },
  { key: 'convenience', label: 'Tạp hóa / tiện lợi' },
  { key: 'cafe', label: 'Cà phê' },
  { key: 'pharmacy', label: 'Nhà thuốc' },
  { key: 'clinic', label: 'Phòng khám / bệnh viện' },
  { key: 'bus', label: 'Điểm xe buýt' },
  { key: 'lodging', label: 'Nhà nghỉ / nhà trọ' },
  { key: 'market', label: 'Chợ / siêu thị' },
  { key: 'bank', label: 'Ngân hàng / ATM' },
]

export const NEARBY_RADII_M = [300, 500] as const
export type NearbyRadius = (typeof NEARBY_RADII_M)[number]

const CLASS_KIND: Readonly<Record<string, NearbyPoiKind>> = {
  restaurant: 'restaurant', fastfood: 'restaurant', food_court: 'restaurant', eatery: 'restaurant', bbq: 'restaurant',
  convenience: 'convenience', department_store: 'convenience',
  cafe: 'cafe', ice_cream: 'cafe',
  pharmacy: 'pharmacy',
  clinic: 'clinic', hospital: 'clinic', medical: 'clinic',
  bus: 'bus', bus_station: 'bus',
  hostel: 'lodging', hotel: 'lodging', guest_house: 'lodging', lodging: 'lodging', resort: 'lodging',
  supermarket: 'market', marketplace: 'market', mall: 'market',
  bank: 'bank', atm: 'bank', 'ACB-ATM': 'bank', ACB: 'bank', money_transfer: 'bank',
  company: 'workplace', industrial: 'workplace',
}

// VietMap은 일부 숙소를 'housing'(아파트 등과 공용)으로, 일부 회사를 class 없이 둔다.
// 이름에 업종이 분명히 적힌 경우만 인정한다.
// JS의 \b는 ASCII 기준이라 베트남어 성조 문자 뒤에서 동작하지 않는다 → 앞쪽 경계만 본다.
const LODGING_NAME = /(^|\s)(nhà nghỉ|nha nghi|khách sạn|khach san|nhà trọ|nha tro|phòng trọ|phong tro|ký túc|ky tuc|ktx|homestay|motel|hostel)/iu
const WORKPLACE_NAME = /^(cty|công ty|cong ty|nhà máy|nha may|xưởng|xuong)(\s|$)/iu

export function classifyPoi(cls: string, name: string): NearbyPoiKind | null {
  const direct = CLASS_KIND[cls]
  if (direct) return direct
  const n = name.trim()
  if (!n) return null
  if ((cls === 'housing' || cls === 'building' || cls === '') && LODGING_NAME.test(n)) return 'lodging'
  if ((cls === '' || cls === 'office' || cls === 'building') && WORKPLACE_NAME.test(n)) return 'workplace'
  return null
}

export interface NearbySummary {
  /** 반경별 생활시설 수. 데이터에 없으면 0. */
  counts: Record<NearbyRadius, Record<FacilityCategory, number>>
  /** 종류별 가장 가까운 시설(최대 반경 안). */
  nearest: Partial<Record<FacilityCategory, NearbyPoi>>
  /** 최대 반경 안 회사·공장(가까운 순). */
  workplaces: NearbyPoi[]
  /** 최대 반경 안 표시용 전체 목록(가까운 순). */
  items: NearbyPoi[]
}

function emptyCounts(): Record<FacilityCategory, number> {
  return Object.fromEntries(FACILITY_CATEGORIES.map((c) => [c.key, 0])) as Record<FacilityCategory, number>
}

/** 같은 이름이 타일 경계 등으로 중복 로드된 경우 ~15m 안이면 하나로 본다. */
function dedupeKey(p: MapPoi): string {
  return `${p.name.trim().toLowerCase()}|${p.lat.toFixed(4)}|${p.lng.toFixed(4)}`
}

export function summarizeNearby(center: { lat: number; lng: number }, pois: MapPoi[], maxRadiusM: number = NEARBY_RADII_M[NEARBY_RADII_M.length - 1]): NearbySummary {
  const seen = new Set<string>()
  const items: NearbyPoi[] = []
  for (const p of pois) {
    if (!p.name?.trim() || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue
    const kind = classifyPoi(p.cls, p.name)
    if (!kind) continue
    const key = dedupeKey(p)
    if (seen.has(key)) continue
    seen.add(key)
    const distanceM = Math.round(calcDistanceKm(center.lat, center.lng, p.lat, p.lng) * 1000)
    if (distanceM > maxRadiusM) continue
    items.push({ ...p, kind, distanceM })
  }
  items.sort((a, b) => a.distanceM - b.distanceM)

  const counts = Object.fromEntries(NEARBY_RADII_M.map((r) => [r, emptyCounts()])) as NearbySummary['counts']
  const nearest: NearbySummary['nearest'] = {}
  for (const item of items) {
    if (item.kind === 'workplace') continue
    for (const r of NEARBY_RADII_M) if (item.distanceM <= r) counts[r][item.kind] += 1
    if (!nearest[item.kind]) nearest[item.kind] = item
  }
  return { counts, nearest, workplaces: items.filter((i) => i.kind === 'workplace'), items }
}

export function formatMeters(m: number): string {
  return m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(1)} km`
}
