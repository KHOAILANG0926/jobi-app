/**
 * 브랜드 로고 수평 전개 — Lee 2026-11-01 "브랜드 정리하면서 로고도 같이 표현했으면 수평 전개해야지".
 * 공고가 등록 브랜드(공식 사이트 domain 확인)와 맞으면, 브랜드 메뉴와 같은 공식 사이트 아이콘을 공고 카드·상세 로고 자리에 쓴다.
 * 순서: 브랜드 로고 → 공고 포스터 → (없으면 각 화면의 기존 글자 표시).
 */
import type { Job } from '../types/job'
import { jobMatchesBrand, type BrandDefinition } from '../data/brandDirectory'

export const brandIconUrl = (domain: string) => `https://www.google.com/s2/favicons?sz=128&domain=${domain}`

/** 브랜드 로고 한 곳(Lee 2026-11-07): 공식 로고 그림(public/brand-logos) → 없으면 공식 사이트 아이콘. 메뉴·카드·상세가 같이 쓴다. */
export function brandImageUrl(brand: Pick<BrandDefinition, 'domain' | 'logoUrl'>): string | undefined {
  if (brand.logoUrl && /^\/brand-logos\/[a-z0-9-]+\.png$/.test(brand.logoUrl)) return brand.logoUrl
  return brand.domain ? brandIconUrl(brand.domain) : undefined
}

export function brandLogoFor(job: Pick<Job, 'company' | 'title'>, brands: BrandDefinition[]): string | undefined {
  const brand = brands.find((b) => b.domain && jobMatchesBrand(job as Job, b))
  return brand ? brandImageUrl(brand) : undefined
}

/** 공고와 맞는 브랜드(검사표용). */
export function brandFor(job: Pick<Job, 'company' | 'title'>, brands: BrandDefinition[]): BrandDefinition | undefined {
  return brands.find((b) => b.domain && jobMatchesBrand(job as Job, b))
}
