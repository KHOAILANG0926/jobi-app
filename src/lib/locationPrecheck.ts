// 수집 첫 단계 = 위치 확인(Lee 2026-11-06 최우선 규칙). 지도와 같은 위치 찾기(resolveAutoLocation) 결과로만 판정한다.
// "찾을 수 있음" = 확정 좌표(exact: Google 같은 이름 1곳·VietMap·Goong 번지·회사 장소) · 공단 정문(gate) — 위치 확인 우선순위 Google → VietMap → Goong(Lee 2026-11-23).
// 동·거리·공단 중심·성 대략 위치만 나오면 "못 찾음" → 수집하지 않는다.
import { companyCore } from './jobIdentity'
import type { LocationDecision, ResolverJob } from './autoLocationResolver'
import { readLocationText, readLocationTexts } from './addressReader'
import { readCompany, type CompanyRead } from './companyReader'

// source_text: 원문 전체. 주소 칸(addresses)이 없으면 원문 주소는 이 원문에서 주소 읽기 한 곳(addressReader)으로 읽는다(Lee 2026-11-07).
// 그때 location은 수집 그룹 지역(원문에 이름이 있을 때만)이고, 읽은 주소 + 지역이 위치 글자가 된다.
// company: 사이트 회사 칸(TopCV 등)만. 없으면 원문(source_text) → 포스터 글자(poster_text) 순으로 회사 이름 읽기 한 곳(companyReader)으로 읽는다.
export interface PrecheckInput { company?: unknown; location?: unknown; addresses?: unknown; source_text?: unknown; poster_text?: unknown }
export interface PrecheckVerdict { findable: boolean; kind: string; reason: string }

/** API 오류의 종류(한 곳): 한도 초과(우리 월 한도·429)와 그 밖의 장애를 가른다. 둘 다 '못 찾음'이 아니다. */
export const providerErrorKind = (e: unknown): 'quota' | 'provider_failed' =>
  /quota_exhausted|upstream_failed_429/.test(String((e as Error)?.message)) ? 'quota' : 'provider_failed'

/** 위치 확인이 '지금 확인 못 함'(한도·장애)으로 막혔는지 — 정상 '검색 결과 없음'(null)과 구분한다(지도 정상화 C, Lee 2026-11-24).
 *  막혔으면 수집기가 버리지 않고 보류함에 두고 다음에 다시 묻는다(기존 보류·재확인 정책 그대로). 순서·판정 기준은 바꾸지 않는다. */
export function checkBlocked(d: Pick<LocationDecision, 'failed' | 'deferred' | 'evidence'>): 'google_quota' | 'provider_quota' | 'provider_failed' | null {
  const ev = String(d.evidence ?? '')
  if (/google:quota/.test(ev)) return 'google_quota'
  if (d.deferred || /(vietmap|goong):quota/.test(ev)) return 'provider_quota'
  if (d.failed || /(google|vietmap|goong):provider_failed/.test(ev)) return 'provider_failed'
  return null
}

export function precheckVerdict(decision: LocationDecision): PrecheckVerdict {
  const kind = decision.kind
  if (kind === 'exact') return { findable: true, kind, reason: 'exact_address' }
  if (kind === 'gate') return { findable: true, kind, reason: 'park_gate' }
  // 한도 초과·API 장애는 '못 찾음'이 아니라 보류(다음에 다시) — 정상 '결과 없음'만 not_found(7일 뒤 다시, 최대 2번). 구분은 checkBlocked 한 곳(#560, 지도 정상화 C).
  const blocked = checkBlocked(decision)
  if (blocked) return { findable: false, kind, reason: blocked }
  if (kind === 'area') return { findable: false, kind, reason: /administrative/i.test(String(decision.evidence ?? '')) && /mismatch/.test(String(decision.evidence ?? '')) ? 'outside_original_province' : 'approximate_only' }
  return { findable: false, kind, reason: 'not_found' }
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
  // 주소 칸이 없으면 원문에 적힌 매장마다 위치 글자(Lee 2026-11-11 매장 여러 곳). 첫 번째는 location과 같다.
  const fromText = addresses.length ? [] : precheckLocationTexts(input)
  const list = addresses.length ? addresses : fromText.length > 1 && fromText[0] === location ? fromText : [location]
  return { id: 0, company, location, targets: list.map((address) => ({ address, workLocationId: null })) }
}

/** 위치 글자. 주소 칸이 없고 원문이 오면 원문에서 주소를 읽어 지역 앞에 붙인다(주소 읽기는 addressReader 한 곳). */
export function precheckLocationText(input: PrecheckInput, hasAddresses = false): string {
  const region = typeof input?.location === 'string' ? input.location.trim() : ''
  const source = typeof input?.source_text === 'string' ? input.source_text.slice(0, 20000) : ''
  return (!hasAddresses && source ? readLocationText(source, region) : region).slice(0, 300)
}

/** 원문 매장마다 위치 글자(최대 5곳, 첫 번째 = precheckLocationText). 원문이 없으면 지역 하나. */
export function precheckLocationTexts(input: PrecheckInput): string[] {
  const region = typeof input?.location === 'string' ? input.location.trim() : ''
  const source = typeof input?.source_text === 'string' ? input.source_text.slice(0, 20000) : ''
  return (source ? readLocationTexts(source, region) : [region]).map((t) => t.slice(0, 300)).filter(Boolean)
}

/** 전화번호 기록으로 소개소 보기(Lee 2026-11-07 5번 B): 이 공고 번호가 회사 코드표(job_company_phones)에 다른 회사로 이미 쓰였으면 소개소.
 * rows = 그 번호들에 묶인 회사의 핵심 이름(core). 이름 없는 공고(번호가 곧 회사, p0…)는 근거가 아니다. 이름이 서로 포함되면 같은 회사로 본다. */
export function agencyByPhone(name: string, rows: Array<{ core?: string | null }>): boolean {
  const me = companyCore(name).core
  if (!me) return false
  return rows.some((r) => {
    const other = String(r?.core ?? '')
    return !!other && !/^p0\d{8,10}$/.test(other) && !other.includes(me) && !me.includes(other)
  })
}
