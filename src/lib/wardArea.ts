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
 * 주소 끝의 3단 표기(읍·면·동 / 구·군 / 성)에서 행정구역 단위를 뽑는다. 못 뽑으면 null.
 * - 접두어(Xã·Phường·Thị trấn)가 온전히 있는 구간만 인정한다(약어 "P."·"X."는 무시).
 * - 서로 다른 xã/phường이 둘 이상 나열된 주소(여러 지역 모집)·서로 다른 시·도가 섞인 주소는 한 곳으로 정할 수 없어 null.
 */
export function parseWardUnit(raw: string): WardUnit | null {
  const segs = segmentsOf(raw ?? '')
  if (segs.length < 3) return null
  if (hasConflictingProvinces(raw)) return null
  const [wardSeg, districtSeg, provinceSeg] = segs.slice(-3)
  const wardNorm = normalizePlaceText(wardSeg)
  const districtNorm = normalizePlaceText(districtSeg)
  const wardMatch = wardNorm.match(WARD_PREFIX)
  if (!wardMatch || !DISTRICT_PREFIX.test(districtNorm)) return null
  const wards = new Set(segs.map(normalizePlaceText).filter((n) => WARD_PREFIX.test(n)))
  if (wards.size > 1) return null
  const ward = wardNorm.replace(WARD_PREFIX, '').trim()
  const district = districtNorm.replace(DISTRICT_PREFIX, '').trim()
  const province = normalizePlaceText(provinceSeg).replace(PROVINCE_PREFIX, '').trim()
  if (!ward || !district || !province) return null
  const kind = KIND_BY_PREFIX[wardMatch[1]]
  return {
    kind, ward, district, province,
    key: `${kind}:${ward}|${district}|${province}`,
    label: wardSeg,
    searchText: `${wardSeg}, ${districtSeg}, ${provinceSeg}`,
    searchTextShort: `${wardSeg}, ${provinceSeg}`,
  }
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

/** 공개 조회 API가 받는 key 형식(영문 소문자·숫자·공백·구분자만). */
export const WARD_KEY_PATTERN = /^(xa|phuong|thi tran):[a-z0-9 ]{1,60}\|[a-z0-9 ]{1,60}\|[a-z0-9 ]{1,60}$/

/** xã/phường 한 곳이 보이는 배율. */
export const WARD_MAP_ZOOM = 13
