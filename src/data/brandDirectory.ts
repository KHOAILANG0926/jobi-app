import type { Job } from '../types/job'
import { normalizeViText } from '../lib/jobCoords'

/**
 * "Thương hiệu" 메가메뉴 대상 브랜드 — 2026-09-10까지는 이 파일에 13개 브랜드가
 * 하드코딩돼 있었으나, 신규 공고가 계속 쌓이는 구조에서 브랜드 추가마다 코드
 * 수정/배포가 필요한 것이 부적합하다는 사용자 지시로 Supabase(job_brands/
 * job_brand_aliases, src/context/BrandsContext.tsx) 기반으로 전환했다 — 이제
 * 이 파일은 그 데이터가 따라야 할 "형태"와 순수 계산 함수만 갖는다. 브랜드
 * 목록 자체(BRAND_DIRECTORY 배열)는 더 이상 여기 없다: 새 브랜드는 관리자가
 * /admin의 Brands 화면에서 "후보 승인" 절차를 거쳐 등록하며, 그 순간부터
 * 코드 수정 없이 메뉴에 나타난다.
 */

export type BrandCategoryId =
  | 'fastfood'
  | 'cafe'
  | 'bakery'
  | 'convenience'
  | 'delivery'

export const BRAND_CATEGORY_LABELS: Record<BrandCategoryId, string> = {
  fastfood: 'Fast food',
  cafe: 'Cafe / Trà sữa',
  bakery: 'Bakery',
  convenience: 'Cửa hàng tiện lợi',
  delivery: 'Giao hàng / Dịch vụ',
}

export interface BrandDefinition {
  id: number
  name: string
  /** job_brand_aliases의 모든 alias(활성분만) — company 또는 title에서
   *  normalizeViText 부분일치로 찾는다. */
  matchKeys: string[]
  category: BrandCategoryId
  /** 클릭 시 Home.tsx의 기존 ?brand= 필터로 그대로 넘기는 대표 alias
   *  (job_brand_aliases.is_primary=true인 것). */
  linkTo: string
  domain?: string
  initial: string
  color: string
  /** 관리자가 /admin에서 직접 지정 — 예전처럼 공고 수 임계값으로 자동
   *  계산하지 않는다(2026-09-10 사용자 지시). */
  featured: boolean
}

export interface BrandWithCount extends BrandDefinition {
  count: number
}

function jobMatchesBrand(job: Job, brand: BrandDefinition): boolean {
  return brand.matchKeys.some((key) => {
    const nk = normalizeViText(key)
    return normalizeViText(job.company).includes(nk) || normalizeViText(job.title).includes(nk)
  })
}

/** 실제 활성 공고(useJobs()가 이미 active=true만 반환)를 기준으로 브랜드별
 *  건수를 계산하고, 0건인 브랜드는 결과에서 제외한다 — 목록에 있다고 항상
 *  보이는 게 아니라 매번 실제 데이터로 다시 계산된다. */
export function computeBrandCounts(jobs: Job[], brands: BrandDefinition[]): BrandWithCount[] {
  return brands
    .map((brand) => ({ ...brand, count: jobs.filter((j) => jobMatchesBrand(j, brand)).length }))
    .filter((b) => b.count > 0)
}

/** 카테고리별로 묶어서 반환 — 브랜드가 하나도 없는 카테고리는 아예 포함하지
 *  않는다(빈 분류를 화면에 보여주지 않는다는 요구사항). */
export function groupBrandsByCategory(
  brandsWithCount: BrandWithCount[],
): { id: BrandCategoryId; label: string; brands: BrandWithCount[] }[] {
  const order: BrandCategoryId[] = ['fastfood', 'cafe', 'bakery', 'convenience', 'delivery']
  return order
    .map((id) => ({
      id,
      label: BRAND_CATEGORY_LABELS[id],
      brands: brandsWithCount.filter((b) => b.category === id).sort((a, b) => b.count - a.count),
    }))
    .filter((g) => g.brands.length > 0)
}
