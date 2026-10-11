// 상세주소(번지·도로 등) 공고의 VietMap 주소 검색 판정 (2026-10-08 사용자 지시).
// 관리자 Vị trí 탭 "Tìm theo địa chỉ chi tiết" 버튼이 쓴다 — 서버 API(/api/admin-vietmap)·하루 250회 안에서,
// 공고 1곳당 Search 1회 + (번지와 도로명이 모두 맞는 결과가 정확히 1곳일 때만) Place 1회.
// 자동 승인은 번지 + 도로명이 검색 결과에 그대로 있고, 공고 주소의 phường/xã 또는 quận/huyện이 맞을 때만. 나머지는 핀 없음.
// 행정구역은 공고 주소에 적힌 이름(2025 개편 전 옛 xã·huyện 이름)을 그대로 질의와 비교에 쓴다 — 새 이름으로 바꾸지 않는다.
import { addressMatch, normalizePlaceText } from './locationCandidateMatch'
import { hasConflictingProvinces, parseStreetAddress, type StreetAddress } from './addressParse'
import { districtOf, mentionsAddress, type Judgement, type LocateStrategy, type SearchedPlaces } from './chototAutoLocate'

export { parseStreetAddress, isWideAreaAddress, isDetailedAddress, hasConflictingProvinces, type StreetAddress } from './addressParse'

interface Hit { ref_id?: string; name?: string; address?: string; display?: string }

function hitMatchesStreet(hit: Hit, parsed: StreetAddress): boolean {
  const have = new Set(normalizePlaceText(`${hit.name ?? ''} ${hit.display ?? ''} ${hit.address ?? ''}`).split(' '))
  return parsed.numbers.length > 0 && have.has(parsed.numbers[0]) && parsed.nameTokens.every((t) => have.has(t))
}

export function pickAddressHit(address: string, hits: unknown): { hit: Hit | null; multiple: boolean } {
  const parsed = parseStreetAddress(address)
  const list = (Array.isArray(hits) ? hits : []) as Hit[]
  const ok = list.filter((h) => h.ref_id && hitMatchesStreet(h, parsed) && mentionsAddress(h, address))
  if (ok.length === 0) return { hit: null, multiple: false }
  return ok.length === 1 ? { hit: ok[0], multiple: false } : { hit: null, multiple: true }
}

export const ADDRESS_APPROVAL_NOTE = 'Tự động duyệt: số nhà + tên đường khớp chính xác với kết quả VietMap và phường/xã hoặc quận/huyện (tên cũ ghi trong tin) khớp.'

const ADDRESS_CACHE_RETRY_VERSION = 'address-v2'
const ADDRESS_CACHE_RETRY_JOB_IDS = new Set([4685, 4721])

/** 파서 보정 뒤 재조회가 필요한 두 공고만 새 캐시 키를 쓴다. 다른 공고와 기존 캐시는 그대로 유지한다. */
export function addressCacheKey(address: string, jobId: number): string {
  const base = `addr|${normalizePlaceText(`${parseStreetAddress(address).street} ${districtOf(address)}`)}`
  return ADDRESS_CACHE_RETRY_JOB_IDS.has(jobId) ? `${base}|${ADDRESS_CACHE_RETRY_VERSION}|job-${jobId}` : base
}

export function judgeAddressPois(job: { address: string }, found: SearchedPlaces): Judgement {
  if (found.multipleExact) return { approvePoi: null, reason: 'multiple_exact' }
  const poi = found.pois[0]
  if (!poi) return { approvePoi: null, reason: found.hits > 0 ? 'address_not_found' : 'no_search_result' }
  if (addressMatch(job.address, poi.units).result === 'mismatch') return { approvePoi: null, reason: 'address_not_inside' }
  return { approvePoi: poi, reason: null, note: ADDRESS_APPROVAL_NOTE }
}

export const ADDRESS_STRATEGY: LocateStrategy = {
  requireCompany: false,
  precheck(address) {
    if (hasConflictingProvinces(address)) return 'address_conflict'
    return parseStreetAddress(address).searchable ? null : 'no_house_number'
  },
  cacheKey: (_company, address, jobId) => addressCacheKey(address, jobId),
  searchText: (_company, address) => `${parseStreetAddress(address).street}, ${districtOf(address)}`.trim(),
  pick: (_company, address, hits) => pickAddressHit(address, hits),
  judge: (_company, job, found) => judgeAddressPois(job, found),
  evidence: ({ address, poi, distanceM }) => [
    `[Tự động] Tìm theo địa chỉ chi tiết trên VietMap: ${poi.name}`,
    `Địa chỉ trong tin: ${address}`,
    `Địa chỉ VietMap: ${poi.address || '—'} · Phường/xã: ${poi.units.ward || '—'} · Quận/huyện: ${poi.units.district || '—'}`,
    distanceM === null ? '' : `Khoảng cách tới vị trí tham chiếu: ${Math.round(distanceM)} m`,
    `VietMap ref: ${poi.refId}`,
  ].filter(Boolean).join('\n'),
}
