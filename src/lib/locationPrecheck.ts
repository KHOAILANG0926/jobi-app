// 수집 첫 단계 = 위치 확인(Lee 2026-11-06 최우선 규칙). 지도와 같은 위치 찾기(resolveAutoLocation) 결과로만 판정한다.
// "찾을 수 있음" = 번지 확인(exact) · 공단 정문(gate) · 회사 이름으로 찾은 업체 자리(Google/Goong company).
// 동·거리·공단 중심·성 대략 위치만 나오면 "못 찾음" → 수집하지 않는다.
import type { LocationDecision, ResolverJob } from './autoLocationResolver'
import { readLocationText } from './addressReader'
import { readCompany, type CompanyRead } from './companyReader'

// source_text: 원문 전체. 주소 칸(addresses)이 없으면 원문 주소는 이 원문에서 주소 읽기 한 곳(addressReader)으로 읽는다(Lee 2026-11-07).
// 그때 location은 수집 그룹 지역(원문에 이름이 있을 때만)이고, 읽은 주소 + 지역이 위치 글자가 된다.
// company: 사이트 회사 칸(TopCV 등)만. 없으면 원문(source_text) → 포스터 글자(poster_text) 순으로 회사 이름 읽기 한 곳(companyReader)으로 읽는다.
export interface PrecheckInput { company?: unknown; location?: unknown; addresses?: unknown; source_text?: unknown; poster_text?: unknown }
export interface PrecheckVerdict { findable: boolean; kind: string; reason: string }

const COMPANY_PLACE = /^(?:Google|Goong) \S+ \(company\)$/

export function precheckVerdict(decision: LocationDecision): PrecheckVerdict {
  const kind = decision.kind
  if (kind === 'exact') return { findable: true, kind, reason: 'exact_address' }
  if (kind === 'gate') return { findable: true, kind, reason: 'park_gate' }
  const source = 'source' in decision ? String(decision.source ?? '') : ''
  if (kind === 'area' && COMPANY_PLACE.test(source)) return { findable: true, kind, reason: source.startsWith('Google') ? 'google_company_place' : 'goong_company_place' }
  if (kind === 'area') return { findable: false, kind, reason: /administrative/i.test(String(decision.evidence ?? '')) && /mismatch/.test(String(decision.evidence ?? '')) ? 'outside_original_province' : 'approximate_only' }
  return { findable: false, kind, reason: decision.failed ? 'provider_failed' : 'not_found' }
}

const FALLBACK_COMPANY = /^nhà tuyển dụng facebook$/i
/** 회사 이름(Lee 2026-11-07 규정): 사이트 회사 칸 → 원문 → 포스터 글자. 못 찾으면 name=''(→ 수집하지 않음). */
export function precheckCompany(input: PrecheckInput): CompanyRead & { from: 'site' | 'text' | 'poster' | '' } {
  const site = typeof input?.company === 'string' ? input.company.trim().slice(0, 200) : ''
  const text = typeof input?.source_text === 'string' ? input.source_text.slice(0, 20000) : ''
  const poster = typeof input?.poster_text === 'string' ? input.poster_text.slice(0, 20000) : ''
  const fromText = text ? readCompany(text) : { name: '', agency: false, fee: false }
  if (site && !FALLBACK_COMPANY.test(site)) return { ...fromText, name: site, from: 'site' }
  if (fromText.name) return { ...fromText, from: 'text' }
  const fromPoster = poster ? readCompany(poster) : { name: '', agency: false, fee: false }
  if (fromPoster.name) return { ...fromPoster, fee: fromPoster.fee || fromText.fee, from: 'poster' }
  return { name: '', agency: false, fee: fromText.fee, from: '' }
}

/** 수집기가 보낸 원문(회사·지역·근무지 주소)을 위치 찾기 입력으로. 잘못된 입력은 null. */
export function precheckJob(input: PrecheckInput): ResolverJob | null {
  const company = precheckCompany(input).name
  const addresses = (Array.isArray(input?.addresses) ? input.addresses : [])
    .filter((a): a is string => typeof a === 'string' && a.trim().length > 0).map((a) => a.trim().slice(0, 300)).slice(0, 5)
  const location = precheckLocationText(input, addresses.length > 0)
  if (!location && !addresses.length) return null
  return { id: 0, company, location, targets: (addresses.length ? addresses : [location]).map((address) => ({ address, workLocationId: null })) }
}

/** 위치 글자. 주소 칸이 없고 원문이 오면 원문에서 주소를 읽어 지역 앞에 붙인다(주소 읽기는 addressReader 한 곳). */
export function precheckLocationText(input: PrecheckInput, hasAddresses = false): string {
  const region = typeof input?.location === 'string' ? input.location.trim() : ''
  const source = typeof input?.source_text === 'string' ? input.source_text.slice(0, 20000) : ''
  return (!hasAddresses && source ? readLocationText(source, region) : region).slice(0, 300)
}
