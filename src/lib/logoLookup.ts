// 사진 없는 공고의 회사 로고 찾기(Lee 2026-11-07 "진행"). 순서: 페이스북 사진(우리 저장소 복사본) → 회사 웹사이트 로고 → 공용 사진.
// Google 검색을 새로 하지 않는다: 위치 확인이 이미 물어 저장해 둔 Google 결과(같은 검색어·같은 같은 이름 1곳·원래 성 안)에서
// 장소 번호만 꺼낸다. 웹사이트는 그 장소 번호로 한 번만 묻고(월 한도는 DB external_api_reserve) 결과는 공고에 기록한다.
import type { ResolverJob } from './autoLocationResolver'
import { googlePlaceHits, googleSearchText, pickCompanyPlace } from './companyPlaceSearch'
import { companyLogoUrl, jobImagePublicUrl } from './companyLogo'
import { brandFor, brandLogoFor } from './brandLogo'
import type { BrandDefinition } from '../data/brandDirectory'
import type { Job } from '../types/job'

/** 위치 확인과 같은 저장 열쇠(autoLocationResolver resolveByCompanyName의 Google 단계). */
export const googleCacheKey = (company: string, address: string) => JSON.stringify(['company-v2', 'google', googleSearchText(company, address)])

/** 위치 확인이 저장해 둔 Google 결과에서 같은 회사 1곳(원래 성 안)의 장소 번호. 저장된 결과가 없으면 null(새로 묻지 않음). */
export async function cachedGooglePlaceId(
  job: ResolverJob,
  cached: (key: string) => Promise<unknown | null>,
  within: (addresses: string[], point: { lat: number; lng: number }) => Promise<boolean>,
): Promise<string | null> {
  if (!job.company.trim()) return null
  const addresses = [...new Set([...job.targets.map((t) => t.address.trim()), job.location].filter(Boolean))]
  for (const address of addresses) {
    const hits = googlePlaceHits(await cached(googleCacheKey(job.company, address)))
    const pick = pickCompanyPlace(job.company, address, hits)
    const hit = pick.hit ? hits.find((h) => h.id === pick.hit!.id) : null
    if (hit && await within([address, job.location], hit)) return hit.id
  }
  return null
}

/** Google websiteUri → 도메인(소문자, www 뗌). 잘못된 주소는 null. */
export function websiteDomain(uri: unknown): string | null {
  try {
    const u = new URL(String(uri ?? ''))
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    const host = u.hostname.toLowerCase().replace(/^www\./, '')
    return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host) ? host : null
  } catch { return null }
}

/** 로고 찾기가 필요한 공고: 브랜드 로고도 공고 사진(우리 저장소)도 없음. */
export function needsLogoLookup(job: Pick<Job, 'company' | 'title' | 'imageUrl' | 'images'>, brands: BrandDefinition[]): boolean {
  return !brandLogoFor(job, brands) && !companyLogoUrl(job.imageUrl) && !jobImagePublicUrl(job.images?.[0])
}

/** 로고 찾기를 붙인 시각(이전 등록 공고는 찾기를 거치지 않았다 — 자동 작업은 기존 공고를 건드리지 않음). */
export const LOGO_LOOKUP_SINCE = '2026-11-07T15:50:00+07:00'

/** 검사표용 대표 사진·로고 출처. 화면 순서(companyLogo.jobRepresentativeImageUrl)와 같다. */
export function photoSource(
  job: Pick<Job, 'company' | 'title' | 'imageUrl' | 'images' | 'companyDomain'> & { createdAt?: string | null; lookupResult?: string | null },
  brands: BrandDefinition[],
): 'brand' | 'brand_icon' | 'photo' | 'site' | 'none' | 'excluded' | 'no_place' | 'quota' | 'pending' | 'before_rule' {
  const brand = brandFor(job, brands)
  if (brand) return brand.logoUrl ? 'brand' : 'brand_icon'
  if (companyLogoUrl(job.imageUrl) || jobImagePublicUrl(job.images?.[0])) return 'photo'
  if (job.companyDomain) return 'site'
  const r = job.lookupResult
  if (r === 'none' || r === 'excluded' || r === 'no_place' || r === 'quota') return r
  if (job.createdAt && new Date(job.createdAt) < new Date(LOGO_LOOKUP_SINCE)) return 'before_rule'
  return 'pending'
}
