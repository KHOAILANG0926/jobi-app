// 지도에서 클릭한 건물/시설 정보 (2026-10-05, 생활지도 2차). VietMap 벡터 데이터에
// 실제로 있는 값(name/class/geometry)만 쓴다. 건물 폴리곤에는 이름이 없으므로 POI 점이
// 폴리곤 "안"에 정확히 하나 있을 때만 그 이름을 후보로 보여주고, 근처(바깥) POI 이름을
// 건물에 붙이지 않는다.
import { calcDistanceKm } from './jobCoords'
import { classifyPoi, type MapPoi, type NearbySummary } from './nearbyFacilities'

export type LngLat = [number, number]
export type PolygonRings = LngLat[][]

export interface PickedPlace {
  /** 같은 대상 재클릭 판단용. */
  key: string
  kind: 'poi' | 'building'
  /** POI 원본 이름(건물은 없음). */
  name: string | null
  /** POI 원본 class(건물은 없음). */
  cls: string | null
  lat: number
  lng: number
  /** 건물 폴리곤(타일 경계에서 잘린 조각일 수 있음). */
  polygon: PolygonRings | null
  /** 건물 폴리곤 안에 있는 이름 있는 POI(공간 포함 관계만). */
  insidePois: MapPoi[]
  nearby: NearbySummary | null
  /** 현재 화면의 타일로 300/500m 생활시설을 모두 셌는지(z16 미만이면 false). */
  nearbyComplete: boolean
}

/** Ray casting. 첫 ring = 외곽, 나머지 = 구멍. */
export function pointInPolygon(point: LngLat, rings: PolygonRings): boolean {
  const inRing = (ring: LngLat[]) => {
    let inside = false
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]
      const [xj, yj] = ring[j]
      if ((yi > point[1]) !== (yj > point[1]) && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) inside = !inside
    }
    return inside
  }
  if (!rings.length || !inRing(rings[0])) return false
  return !rings.slice(1).some(inRing)
}

/** 외곽 ring 꼭짓점 평균(표시·거리 기준점용, 닫는 점 제외). */
export function polygonCenter(rings: PolygonRings): { lat: number; lng: number } {
  const ring = rings[0] ?? []
  const pts = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring
  const n = Math.max(1, pts.length)
  return { lng: pts.reduce((s, p) => s + p[0], 0) / n, lat: pts.reduce((s, p) => s + p[1], 0) / n }
}

/** 폴리곤 안에 있는 이름 있는 POI(중복 제거). */
export function poisInsideBuilding(rings: PolygonRings, pois: MapPoi[]): MapPoi[] {
  const seen = new Set<string>()
  const out: MapPoi[] = []
  for (const p of pois) {
    if (!p.name.trim()) continue
    const key = `${p.name.trim().toLowerCase()}|${p.lat.toFixed(5)}|${p.lng.toFixed(5)}`
    if (seen.has(key)) continue
    if (pointInPolygon([p.lng, p.lat], rings)) { seen.add(key); out.push(p) }
  }
  return out
}

/**
 * 건물 이름 표시 규칙: 폴리곤 안 POI가 정확히 1개일 때만 그 이름(근거: 건물 안 위치).
 * 0개 → 이름 없음, 2개 이상 → 한 건물에 여러 시설(특정 이름을 건물명으로 쓰지 않음).
 */
export function buildingNameFromInside(inside: MapPoi[]): string | null {
  return inside.length === 1 ? inside[0].name : null
}

const CLASS_LABEL: Readonly<Record<string, string>> = {
  company: 'Công ty', industrial: 'Nhà máy / khu công nghiệp', office: 'Văn phòng', building: 'Tòa nhà', housing: 'Nhà ở / lưu trú',
  restaurant: 'Nhà hàng', fastfood: 'Đồ ăn nhanh', eatery: 'Quán ăn', food_court: 'Khu ẩm thực', bbq: 'Quán nướng', food: 'Cửa hàng thực phẩm',
  cafe: 'Cà phê', ice_cream: 'Kem / đồ uống', convenience: 'Cửa hàng tiện lợi', department_store: 'Tạp hóa',
  supermarket: 'Siêu thị', marketplace: 'Chợ', mall: 'Trung tâm thương mại', store: 'Cửa hàng',
  pharmacy: 'Nhà thuốc', clinic: 'Phòng khám', hospital: 'Bệnh viện', medical: 'Cơ sở y tế',
  bus: 'Điểm xe buýt', bus_station: 'Điểm xe buýt', hostel: 'Nhà nghỉ', hotel: 'Khách sạn', guest_house: 'Nhà khách', lodging: 'Lưu trú', resort: 'Khu nghỉ dưỡng',
  bank: 'Ngân hàng', atm: 'ATM', 'ACB-ATM': 'ATM', ACB: 'Ngân hàng', school: 'Trường học', education: 'Trường học', gas_station: 'Cây xăng', fuel: 'Cây xăng',
  chargingstation: 'Trạm sạc', police: 'Công an / cơ quan', post_office: 'Bưu điện', parking: 'Bãi đỗ xe', committee: 'Ủy ban',
}

/** POI 종류 표기. 모르는 class는 원문 class를 숨기고 일반 표기로. */
export function poiCategoryLabel(cls: string | null, name: string | null): string {
  if (cls && CLASS_LABEL[cls]) return CLASS_LABEL[cls]
  const kind = classifyPoi(cls ?? '', name ?? '')
  if (kind === 'workplace') return 'Công ty'
  if (kind === 'lodging') return 'Nhà nghỉ / nhà trọ'
  return 'Địa điểm'
}

export function isWorkplacePlace(place: Pick<PickedPlace, 'kind' | 'cls' | 'name' | 'insidePois'>): boolean {
  if (place.kind === 'poi') return classifyPoi(place.cls ?? '', place.name ?? '') === 'workplace'
  return place.insidePois.some((p) => classifyPoi(p.cls, p.name) === 'workplace')
}

export interface JobNearPlace<T> {
  job: T
  distanceM: number
  /** 공고 근무지 좌표가 이 건물 폴리곤 안이거나 POI와 같은 좌표. */
  samePlace: boolean
}

/** 클릭 지점 주변 JOBI 공고(확인된 근무지 좌표 기준). 같은 장소를 먼저, 그다음 거리순. */
export function jobsNearPlace<T>(
  place: Pick<PickedPlace, 'lat' | 'lng' | 'polygon'>,
  jobs: Array<{ job: T; points: Array<{ lat: number; lng: number }> }>,
  maxDistanceM = 500,
): JobNearPlace<T>[] {
  const out: JobNearPlace<T>[] = []
  for (const { job, points } of jobs) {
    let best: JobNearPlace<T> | null = null
    for (const p of points) {
      const distanceM = Math.round(calcDistanceKm(place.lat, place.lng, p.lat, p.lng) * 1000)
      const samePlace = place.polygon ? pointInPolygon([p.lng, p.lat], place.polygon) : distanceM <= 15
      if (distanceM > maxDistanceM && !samePlace) continue
      if (!best || (samePlace && !best.samePlace) || (samePlace === best.samePlace && distanceM < best.distanceM)) best = { job, distanceM, samePlace }
    }
    if (best) out.push(best)
  }
  return out.sort((a, b) => Number(b.samePlace) - Number(a.samePlace) || a.distanceM - b.distanceM)
}
