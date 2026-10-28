// 10-14 순서표 ② "회사+공단"의 일반화(Lee 2026-10-28): 회사명 + 원문 지역(공단/거리/동/시).
// 공단 밖 식당·서비스직처럼 번지가 없는 공고도 상호명으로 찾는다. 채택 조건(모두 만족할 때만):
//   상호명 정확 일치 + 원문 성(원래 행정구역 경계) 안 + 원문에 거리 이름이 있으면 그 거리 일치(없으면 동·구 이름 일치).
//   같은 이름 후보가 2곳 이상이면 채택하지 않는다(10-11 B안의 다른 지점 오찍힘 방지).
// 못 찾으면 resolver의 기존 다음 단계(공단 입구 → 동 → 시 대략 위치)로 넘어간다. 호출 한도·VietMap 경로·canonical writer는 그대로.
import { isExactCompanyName, looksLikeRegisteredAddress, normalizePlaceText, buildCandidateEvidence, nameSimilarity, type PoiCandidate } from './locationCandidateMatch'
import { administrativeAreaForTarget, areaContains } from './administrativeArea'
import { parkNameFromAddresses } from './parkLocate'
import { districtOf, mentionsAddress, queryKey, type Judgement, type LocateStrategy, type SearchedPlaces } from './chototAutoLocate'

interface Hit { ref_id?: string; name?: string; address?: string; display?: string }

const NOT_STREET = /^(?:kcn|ccn|khu cong nghiep|cum cong nghiep|phuong|p|xa|thi tran|tt|quan|q|huyen|h|thi xa|tx|thanh pho|tp|tinh|t)\b/
/** 원문 주소 첫 부분의 거리 이름(번지 없음 허용). 공단 이름·행정구역만 있으면 ''. */
export function originalStreet(address: string): string {
  const first = normalizePlaceText(String(address ?? '').split(/,|\s[-–]\s/)[0] ?? '')
  // "ngõ" 접두는 "Ngô" 같은 이름과 글자가 같아져 지우지 않는다.
  const street = first.replace(/^(?:so\s+)?\d+[a-z]?(?:\/\d+)*\s+/, '').replace(/^(?:duong|pho)\s+/, '').trim()
  return street.length > 2 && !NOT_STREET.test(first) ? street : ''
}

/** 이름이 정확히 같은 후보가 정확히 1곳일 때만 고른다(2곳 이상이면 multiple, 좁히지 않음). */
export function pickSingleExact(company: string, hits: unknown): { hit: Hit | null; multiple: boolean } {
  const exact = ((Array.isArray(hits) ? hits : []) as Hit[]).filter((h) => h.ref_id && h.name && isExactCompanyName(company, h.name))
  return exact.length === 1 ? { hit: exact[0], multiple: false } : { hit: null, multiple: exact.length > 1 }
}

export function judgeCompanyArea(company: string, job: { address: string; location: string }, found: SearchedPlaces): Judgement {
  if (found.multipleExact || found.pois.length > 1) return { approvePoi: null, reason: 'multiple_exact' }
  const poi: PoiCandidate | undefined = found.pois[0]
  if (!poi) return { approvePoi: null, reason: 'no_search_result' }
  if (!isExactCompanyName(company, poi.name)) return { approvePoi: null, reason: 'name_not_exact' }
  // 공단 밖 "Công ty TNHH …" POI는 법인 등록 주소일 수 있다(10-08 Pizza 사례) — 기존 판정과 같이 채택하지 않는다.
  if (looksLikeRegisteredAddress(poi.name)) return { approvePoi: null, reason: 'registered_address_like' }
  const area = administrativeAreaForTarget(job.address, job.location)
  // 도시 대표점 증명(trusted_city_representative)은 그 점 하나만 증명하므로, 후보 위치는 원래 성 경계로 검사한다.
  if (!area || !areaContains({ ...area, proofType: undefined }, poi)) return { approvePoi: null, reason: 'address_not_inside' }
  const text = ` ${normalizePlaceText(`${poi.address} ${poi.units.ward ?? ''} ${poi.units.district ?? ''}`)} `
  const street = originalStreet(job.address)
  const local = street ? text.includes(` ${street} `) : mentionsAddress({ address: poi.address }, job.address)
  if (!local) return { approvePoi: null, reason: 'address_not_inside' }
  return { approvePoi: poi, reason: null, approvalReason: 'exact_name_in_district' }
}

export const COMPANY_AREA_STRATEGY: LocateStrategy = {
  requireCompany: true,
  // 원문에 원래 행정구역(성/시)이 확인되지 않으면 "원문 지역 안"을 판정할 수 없으므로 검색하지 않는다.
  // 공단 표에 없는 공단 이름(예: "KCN Yên Phong")은 공단 윤곽 근거가 없으므로 기존 공단 찾기 단계를 그대로 쓴다.
  precheck: (address) => !administrativeAreaForTarget(address, '') ? 'no_address' : parkNameFromAddresses([address]) ? 'no_address' : null,
  cacheKey: (company, address) => queryKey(company, address),
  searchText: (company, address) => `${company} ${districtOf(address)}`.trim(),
  pick: (company, _address, hits) => pickSingleExact(company, hits),
  judge: judgeCompanyArea,
  evidence: ({ company, address, poi, distanceM }) => buildCandidateEvidence({ company, jobAddress: address, poi, similarity: nameSimilarity(company, poi.name), distanceM }),
}
