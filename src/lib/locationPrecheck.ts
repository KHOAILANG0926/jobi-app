// 수집 첫 단계 = 위치 확인(Lee 2026-11-06 최우선 규칙). 지도와 같은 위치 찾기(resolveAutoLocation) 결과로만 판정한다.
// "찾을 수 있음" = 번지 확인(exact) · 공단 정문(gate) · 회사 이름으로 찾은 업체 자리(Google/Goong company).
// 동·거리·공단 중심·성 대략 위치만 나오면 "못 찾음" → 수집하지 않는다.
import type { LocationDecision, ResolverJob } from './autoLocationResolver'

export interface PrecheckInput { company?: unknown; location?: unknown; addresses?: unknown }
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

/** 수집기가 보낸 원문(회사·지역·근무지 주소)을 위치 찾기 입력으로. 잘못된 입력은 null. */
export function precheckJob(input: PrecheckInput): ResolverJob | null {
  const company = typeof input?.company === 'string' ? input.company.trim().slice(0, 200) : ''
  const location = typeof input?.location === 'string' ? input.location.trim().slice(0, 300) : ''
  const addresses = (Array.isArray(input?.addresses) ? input.addresses : [])
    .filter((a): a is string => typeof a === 'string' && a.trim().length > 0).map((a) => a.trim().slice(0, 300)).slice(0, 5)
  if (!location && !addresses.length) return null
  return { id: 0, company, location, targets: (addresses.length ? addresses : [location]).map((address) => ({ address, workLocationId: null })) }
}
