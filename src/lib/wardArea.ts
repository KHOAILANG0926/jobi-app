// 행정구역(xã/phường)만 아는 공고의 "동네 지도"(2026-10-08): 공고 주소 끝의 "Xã/Phường …, Huyện/Thị xã/Thành phố …, Tỉnh" 3단 표기에서
// 단위를 뽑고, 같은 단위끼리 같은 key로 묶는다(관리자 검색 캐시·공개 조회가 이 key를 공유). 의존성 없음 — 공고 상세 화면과 관리자 검색이 함께 쓴다.
import { normalizePlaceText } from './locationCandidateMatch'
import { hasConflictingProvinces } from './addressParse'

export type WardKind = 'xa' | 'phuong' | 'thi tran'

export interface WardUnit {
  kind: WardKind
  /** 접두어를 뗀 이름(소문자·무성조) */
  ward: string
  district: string
  province: string
  /** 캐시·조회용 키. 예: xa:tam da|yen phong|bac ninh */
  key: string
  /** 화면 표시용(원문 표기). 예: Xã Tam Đa */
  label: string
  /** VietMap 검색용 전체 글자. 예: Xã Tam Đa, Huyện Yên Phong, Bắc Ninh */
  searchText: string
  /** 구 단위를 뺀 대체 검색 글자. 예: Xã Tam Đa, Bắc Ninh */
  searchTextShort: string
}

const WARD_PREFIX = /^(phuong|xa|thi tran)\s+/
const DISTRICT_PREFIX = /^(huyen|thi xa|thanh pho|quan)\s+/
const PROVINCE_PREFIX = /^(tinh|thanh pho|tp)\s+/
const KIND_BY_PREFIX: Record<string, WardKind> = { phuong: 'phuong', xa: 'xa', 'thi tran': 'thi tran' }

const segmentsOf = (raw: string) => raw.split(',').map((s) => s.trim()).filter(Boolean)

/**
 * 주소 끝의 행정구역 표기에서 단위를 뽑는다. 못 뽑으면 null.
 * - 옛 3단계(2025년 7월 개편 전): "Xã/Phường …, Huyện/Thị xã/Thành phố/Quận …, Tỉnh"
 * - 새 2단계(2025년 7월 개편 후, 구·군 폐지): "Xã/Phường …, Tỉnh/Thành phố" — district는 ''(2026-10-18 #4828 원인)
 * - 접두어(Xã·Phường·Thị trấn)가 온전히 있는 구간만 인정한다(약어 "P."·"X."는 무시).
 * - 서로 다른 xã/phường이 둘 이상 나열된 주소(여러 지역 모집)·서로 다른 시·도가 섞인 주소는 한 곳으로 정할 수 없어 null.
 */
export function parseWardUnit(raw: string): WardUnit | null {
  const segs = segmentsOf(raw ?? '')
  if (segs.length < 2) return null
  if (hasConflictingProvinces(raw)) return null
  const wards = new Set(segs.map(normalizePlaceText).filter((n) => WARD_PREFIX.test(n)))
  if (wards.size > 1) return null
  const build = (wardSeg: string, districtSeg: string | null, provinceSeg: string): WardUnit | null => {
    const wardMatch = normalizePlaceText(wardSeg).match(WARD_PREFIX)
    if (!wardMatch) return null
    const ward = normalizePlaceText(wardSeg).replace(WARD_PREFIX, '').trim()
    const district = districtSeg ? normalizePlaceText(districtSeg).replace(DISTRICT_PREFIX, '').trim() : ''
    const province = normalizePlaceText(provinceSeg).replace(PROVINCE_PREFIX, '').trim()
    if (!ward || !province || (districtSeg && !district)) return null
    const kind = KIND_BY_PREFIX[wardMatch[1]]
    return {
      kind, ward, district, province,
      key: `${kind}:${ward}|${district}|${province}`,
      label: wardSeg,
      searchText: districtSeg ? `${wardSeg}, ${districtSeg}, ${provinceSeg}` : `${wardSeg}, ${provinceSeg}`,
      searchTextShort: `${wardSeg}, ${provinceSeg}`,
    }
  }
  // 옛 3단계 먼저(기존 동작 그대로)
  if (segs.length >= 3) {
    const [w, d, p] = segs.slice(-3)
    if (WARD_PREFIX.test(normalizePlaceText(w)) && DISTRICT_PREFIX.test(normalizePlaceText(d))) return build(w, d, p)
  }
  // 새 2단계: 마지막 칸이 성(구·군 접두어 huyện·thị xã·quận이면 성이 빠진 주소라 인정하지 않음)
  const [w, p] = segs.slice(-2)
  const pNorm = normalizePlaceText(p)
  if (/^(huyen|thi xa|quan)\s+/.test(pNorm) || WARD_PREFIX.test(pNorm)) return null
  return build(w, null, p)
}

/**
 * 공고의 모든 근무지 주소가 같은 xã/phường 한 곳을 가리킬 때만 그 단위를 돌려준다.
 * 주소가 하나라도 단위를 못 뽑거나 서로 다르면 null — 여러 곳 중 어디를 지도에 보일지 정할 수 없다.
 */
export function wardUnitForAddresses(addresses: Array<string | null | undefined>): WardUnit | null {
  const list = addresses.map((a) => (a ?? '').trim()).filter(Boolean)
  if (list.length === 0) return null
  const units = list.map(parseWardUnit)
  if (units.some((u) => !u)) return null
  const first = units[0] as WardUnit
  return units.every((u) => (u as WardUnit).key === first.key) ? first : null
}

/** 공개 조회 API가 받는 key 형식(영문 소문자·숫자·공백·구분자만). 새 2단계 주소는 가운데(구)가 빈칸. */
export const WARD_KEY_PATTERN = /^(xa|phuong|thi tran):[a-z0-9 ]{1,60}\|[a-z0-9 ]{0,60}\|[a-z0-9 ]{1,60}$/

/**
 * 저장된 동 좌표 찾기: key가 그대로 있으면 그것, 없으면 같은 종류·동·성(구는 무시)인 항목들이 모두 같은 곳일 때만 그 값.
 * 옛 3단계로 저장된 좌표를 새 2단계 주소에서 다시 쓰기 위함(VietMap 추가 호출 없음). 서로 다른 곳이면 null.
 */
export function findWardCenter<T extends { status?: string; lat?: number; lng?: number }>(cache: Record<string, T> | null | undefined, key: string): T | null {
  if (!cache) return null
  const own = Object.prototype.hasOwnProperty.call(cache, key) ? cache[key] : undefined
  if (own && own.status === 'found') return own
  const m = key.match(/^([^:]+):([^|]*)\|[^|]*\|(.*)$/)
  if (!m) return null
  const [, kind, ward, province] = m
  const same = Object.entries(cache).filter(([k, v]) => {
    const o = k.match(/^([^:]+):([^|]*)\|[^|]*\|(.*)$/)
    return !!o && o[1] === kind && o[2] === ward && o[3] === province && v?.status === 'found' && typeof v.lat === 'number' && typeof v.lng === 'number'
  }).map(([, v]) => v)
  if (same.length === 0) return null
  const near = (a: T, b: T) => Math.abs((a.lat as number) - (b.lat as number)) < 0.002 && Math.abs((a.lng as number) - (b.lng as number)) < 0.002
  return same.every((v) => near(v, same[0])) ? same[0] : null
}

/** xã/phường 한 곳이 보이는 배율. */
export const WARD_MAP_ZOOM = 13
