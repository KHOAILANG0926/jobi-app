/**
 * 브랜드 로고 수평 전개 — Lee 2026-11-01 "브랜드 정리하면서 로고도 같이 표현했으면 수평 전개해야지".
 * 공고가 등록 브랜드(공식 사이트 domain 확인)와 맞으면, 브랜드 메뉴와 같은 공식 사이트 아이콘을 공고 카드·상세 로고 자리에 쓴다.
 * 순서: 브랜드 로고 → 공고 포스터 → (없으면 각 화면의 기존 글자 표시).
 */
import type { Job } from '../types/job'
import { jobMatchesBrand, type BrandDefinition } from '../data/brandDirectory'

export const brandIconUrl = (domain: string) => `https://www.google.com/s2/favicons?sz=128&domain=${domain}`

export function brandLogoFor(job: Pick<Job, 'company' | 'title'>, brands: BrandDefinition[]): string | undefined {
  const brand = brands.find((b) => b.domain && jobMatchesBrand(job as Job, b))
  return brand?.domain ? brandIconUrl(brand.domain) : undefined
}
