// 근무지 좌표 후보(job_location_candidates) 자동 생성용 순수 판정 (2026-10-06).
// VietMap Search v4로 찾은 상가·회사(POI)를 공고의 회사명·근무지 주소와 비교한다.
// 결과는 "후보"로 저장된다. 자동 승인 핀은 아래 evaluateAutoApproval 기준(회사명 정확 일치 + 구·KCN 안)을 통과한 1곳뿐이고,
// 나머지는 핀 없음(pending)으로 두며 관리자가 AdminLocations(예외 처리용)에서 승인·거절한다.
// - 지점이 여러 곳인 업체는 이름만으로 확정하지 않도록 행정구역(phường/xã·quận/huyện·tỉnh/TP) 일치 여부를
//   함께 기록해 관리자에게 보여준다.
// 외부 import 없이 앱과 scripts/generate-location-candidates.ts 양쪽에서 쓴다.

/** 비교용 정규화: 소문자, 성조·đ 제거, 기호 제거, 공백 정리. */
export function normalizePlaceText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// 회사명 비교에서 의미 없는 법인 형태·일반어
const COMPANY_STOPWORDS = new Set([
  'cong', 'ty', 'cty', 'tnhh', 'co', 'phan', 'cp', 'mtv', 'thanh', 'vien', 'mot', 'hai', 'chi', 'nhanh', 'cn',
  'viet', 'nam', 'vn', 'vietnam', 'company', 'limited', 'ltd', 'co', 'jsc', 'corp', 'corporation', 'group',
  'tap', 'doan', 'and', 'va', 'the',
])

export function companyTokens(name: string): string[] {
  return normalizePlaceText(name).split(' ').filter((t) => t.length > 1 && !COMPANY_STOPWORDS.has(t))
}

/** 회사명 ↔ POI 이름 유사도(0~1): 회사명 핵심 단어 중 POI 이름에 있는 비율. */
export function nameSimilarity(company: string, poiName: string): number {
  const want = companyTokens(company)
  if (want.length === 0) return 0
  const have = new Set(companyTokens(poiName))
  return want.filter((t) => have.has(t)).length / want.length
}

/** 자동 후보로 남길 최소 이름 유사도. 미만은 이름만 비슷한 다른 업체일 가능성이 커 버린다. */
export const MIN_NAME_SIMILARITY = 0.5

const ADMIN_PREFIX = /^(phuong|xa|thi tran|quan|huyen|thi xa|thanh pho|tp|tinh)\s+/

function adminCore(name: string): string {
  return normalizePlaceText(name).replace(ADMIN_PREFIX, '').trim()
}

export interface AdminUnits { ward?: string; district?: string; province?: string }

export type AddressMatch = 'match' | 'partial' | 'mismatch' | 'unknown'

/**
 * POI 행정구역이 공고 근무지 주소에 들어 있는지.
 * - match: phường/xã가 같고 quận/huyện 또는 tỉnh/TP도 같음
 * - partial: phường/xã는 확인 못 했지만 quận/huyện 또는 tỉnh/TP가 같음
 * - mismatch: 공고 주소에 행정구역 이름이 있는데 POI 쪽과 하나도 맞지 않음(다른 지점일 수 있음)
 * - unknown: 비교할 행정구역 정보가 없음
 */
export function addressMatch(jobAddress: string, poi: AdminUnits): { result: AddressMatch; ward: boolean; district: boolean; province: boolean } {
  const text = ` ${normalizePlaceText(jobAddress)} `
  const has = (unit?: string) => {
    const core = unit ? adminCore(unit) : ''
    return core.length > 1 && text.includes(` ${core} `)
  }
  const ward = has(poi.ward)
  const district = has(poi.district)
  const province = has(poi.province)
  const anyUnit = !!(poi.ward || poi.district || poi.province)
  const jobMentionsAdmin = /\b(phuong|xa|quan|huyen|thi xa|thanh pho|tp|tinh)\b/.test(text) || text.split(' ').length > 3
  let result: AddressMatch
  if (!anyUnit || normalizePlaceText(jobAddress) === '') result = 'unknown'
  else if (ward && (district || province)) result = 'match'
  else if (district || province) result = 'partial'
  else result = jobMentionsAdmin ? 'mismatch' : 'unknown'
  return { result, ward, district, province }
}

export const ADDRESS_MATCH_LABEL: Record<AddressMatch, string> = {
  match: 'Địa chỉ khớp (phường/xã + quận/huyện hoặc tỉnh)',
  partial: 'Khớp một phần (quận/huyện hoặc tỉnh) — kiểm tra chi nhánh',
  mismatch: 'Địa chỉ KHÔNG khớp — có thể là chi nhánh khác',
  unknown: 'Không đủ thông tin để so địa chỉ',
}

export interface PoiCandidate {
  name: string
  address: string
  lat: number
  lng: number
  units: AdminUnits
  refId: string
}

/** 관리자에게 보여줄 근거(evidence) 텍스트. DDL 없이 기존 evidence 컬럼에 기록(2026-10-06 결정). */
export function buildCandidateEvidence(input: { company: string; jobAddress: string; poi: PoiCandidate; similarity: number; distanceM: number | null }): string {
  const m = addressMatch(input.jobAddress, input.poi.units)
  const unit = (label: string, value: string | undefined, ok: boolean) => `${label}: ${value || '—'} ${value ? (ok ? '✓' : '✗') : ''}`.trim()
  return [
    `[Tự động] VietMap POI: ${input.poi.name}`,
    `Địa chỉ POI: ${input.poi.address || '—'}`,
    `${ADDRESS_MATCH_LABEL[m.result]} · ${unit('Phường/xã', input.poi.units.ward, m.ward)} · ${unit('Quận/huyện', input.poi.units.district, m.district)} · ${unit('Tỉnh/TP', input.poi.units.province, m.province)}`,
    `Tên công ty trong tin: ${input.company} · độ khớp tên ${Math.round(input.similarity * 100)}%`,
    input.distanceM === null ? 'Khoảng cách tới vị trí phường/xã của tin: —' : `Khoảng cách tới vị trí phường/xã của tin: ${Math.round(input.distanceM)} m`,
    `VietMap ref: ${input.poi.refId}`,
    'Chưa duyệt: cần quản trị viên đối chiếu trên bản đồ/vệ tinh trước khi dùng.',
  ].join('\n')
}

export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371008.8
  const rad = (d: number) => d * Math.PI / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** 같은 공고·같은 주소에 이미(어떤 상태든, 거절 포함) 30 m 안의 후보가 있으면 다시 만들지 않는다. */
export const DUPLICATE_RADIUS_M = 30
export function isDuplicateCandidate(
  existing: Array<{ address_snapshot: string; lat: number; lng: number }>,
  next: { address: string; lat: number; lng: number },
): boolean {
  return existing.some((c) => c.address_snapshot === next.address && distanceMeters(c, next) <= DUPLICATE_RADIUS_M)
}

/** 점이 닫힌 링 안에 있는지(ray casting). ring은 [경도, 위도] 순서(industrialParkOutlines와 같음). */
export function pointInRing(lat: number, lng: number, ring: ReadonlyArray<readonly [number, number]>): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

// 회사명 정확 일치 비교에서 지역·시설 일반어는 무시한다("Pizza Hut" = "Pizza Hut Bắc Ninh").
const EXACT_IGNORED = new Set(['bac', 'ninh', 'kcn', 'khu', 'nghiep', 'cong', 'nha', 'may', 'xuong', 'kho'])

/** 회사명 ↔ POI 이름이 법인 형태·지역 일반어를 빼고 단어 그대로 같은지(순서 포함). 비슷한 이름은 정확 일치가 아니다. */
export function isExactCompanyName(company: string, poiName: string): boolean {
  const a = companyTokens(company).filter((t) => !EXACT_IGNORED.has(t))
  const b = companyTokens(poiName).filter((t) => !EXACT_IGNORED.has(t))
  return a.length > 0 && a.join(' ') === b.join(' ')
}

export type AutoApprovalReason = 'exact_name_inside_kcn' | 'exact_name_in_district' | 'name_not_exact' | 'outside_kcn' | 'address_not_inside'

/**
 * 자동 승인 핀 기준(2026-10-08 사용자 지시): 회사명이 정확히 일치하고, POI가 공고 주소(구·KCN) 안에 있을 때만.
 * 그 밖에는 모두 "핀 없음"(후보로만 남고 관리자가 예외로 처리).
 * - insideKcn: 공고 주소가 윤곽이 있는 KCN이면 POI가 그 윤곽 안인지(true/false), KCN 윤곽을 모르면 null.
 *   KCN 윤곽이 있으면 구 일치만으로는 통과시키지 않는다(KCN 밖 같은 구의 다른 지점일 수 있음).
 * - 윤곽이 없으면 주소의 구(quận/huyện)가 같거나, phường/xã + tỉnh가 모두 같을 때(addressMatch 'match')만 "안".
 * 같은 회사명 후보가 여러 곳이면(지점 여럿) 호출 쪽에서 자동 승인하지 않는다.
 */
export function evaluateAutoApproval(input: {
  company: string
  poiName: string
  jobAddress: string
  poiUnits: AdminUnits
  insideKcn: boolean | null
}): { approve: boolean; reason: AutoApprovalReason } {
  if (!isExactCompanyName(input.company, input.poiName)) return { approve: false, reason: 'name_not_exact' }
  if (input.insideKcn !== null) {
    return input.insideKcn ? { approve: true, reason: 'exact_name_inside_kcn' } : { approve: false, reason: 'outside_kcn' }
  }
  const m = addressMatch(input.jobAddress, input.poiUnits)
  if (m.district || m.result === 'match') return { approve: true, reason: 'exact_name_in_district' }
  return { approve: false, reason: 'address_not_inside' }
}

export const AUTO_APPROVAL_NOTE: Record<AutoApprovalReason, string> = {
  exact_name_inside_kcn: 'Tự động duyệt: tên công ty khớp chính xác và vị trí nằm trong khu công nghiệp ghi trong địa chỉ.',
  exact_name_in_district: 'Tự động duyệt: tên công ty khớp chính xác và vị trí nằm trong quận/huyện (hoặc phường/xã + tỉnh) ghi trong địa chỉ.',
  name_not_exact: 'Không tự động duyệt: tên công ty không khớp chính xác.',
  outside_kcn: 'Không tự động duyệt: vị trí nằm ngoài khu công nghiệp ghi trong địa chỉ.',
  address_not_inside: 'Không tự động duyệt: vị trí không nằm trong quận/huyện ghi trong địa chỉ.',
}
