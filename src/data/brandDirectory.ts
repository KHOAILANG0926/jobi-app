import type { Job } from '../types/job'
import { normalizeViText } from '../lib/jobCoords'

/**
 * "Thương hiệu" 메가메뉴 대상 브랜드 목록 — 2026-09-10 운영 DB(local_jobs,
 * active=true AND admin_hidden 미설정/false, 263건 전수)를 직접 조회해
 * 실제 활성 공고 title/company에 체인·다점포 성격이 확인되는 것만 골랐다.
 * Samsung/LG/Foxconn/Vinfast/SEI 등 제조형 대기업은 다건이어도 제외했다
 * (매장/지점 채용이 아니라 본사 사무직·엔지니어 채용이라 이 메뉴의 취지와
 * 다름). Highlands/KFC/Circle K/WinMart/FamilyMart/Baemin/Starbucks 등은
 * 실제 DB에 활성 공고가 0건이라(2026-09-10 조회 기준) 포함하지 않았다 —
 * 브랜드가 익숙하다는 이유만으로 넣지 않는다.
 *
 * matchKeys: Home.tsx의 브랜드 필터(company 또는 title에 normalizeViText
 * 부분일치, 대소문자/발음구별기호 무관)와 완전히 같은 방식으로 활성 공고
 * 수를 계산하고, 그 결과가 0건이면 이 브랜드는 자동으로 숨겨진다(런타임
 * 계산 — 목록에 있다고 항상 노출되는 게 아니다). 회사명 표기가 다른
 * 경우(대소문자 등)만 여러 matchKey로 안전하게 묶었고, 서로 다른 법인
 * (예: "Công Ty TNHH Shopee"와 "Công Ty TNHH Spx Express")은 임의로
 * 합치지 않고 별도 브랜드로 유지했다.
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
  name: string
  /** company 또는 title에서 찾을 문자열(들) — normalizeViText 부분일치. 표기
   *  차이(대소문자 등)만 있는 경우 여러 개를 등록해 안전하게 묶는다. */
  matchKeys: string[]
  category: BrandCategoryId
  /** 검색/링크에 쓸 대표 문자열 — Home.tsx의 ?brand= 쿼리 값으로 그대로 전달. */
  linkTo: string
  /** 실제로 검증된 도메인이 있을 때만(기존 JobCard.tsx FAVICON_DOMAINS/구
   *  Layout.tsx 카드에 이미 있던 값만 재사용) — 없으면 임의로 만들지 않고
   *  BrandCardLogo의 이니셜 fallback을 그대로 쓴다. */
  domain?: string
  initial: string
  color: string
}

export const BRAND_DIRECTORY: BrandDefinition[] = [
  // ── Fast food ──────────────────────────────────────────────
  { name: 'Jollibee', matchKeys: ['Jollibee'], category: 'fastfood', linkTo: 'Jollibee', domain: 'jollibee.com.vn', initial: 'J', color: '#ce1126' },
  { name: "McDonald's", matchKeys: ["McDonald's", 'McDonald'], category: 'fastfood', linkTo: "McDonald's", domain: 'mcdonalds.com', initial: 'M', color: '#ffc72c' },
  { name: 'Pizza Hut', matchKeys: ['Pizza Hut'], category: 'fastfood', linkTo: 'Pizza Hut', initial: 'P', color: '#e4002b' },

  // ── Cafe / Trà sữa ─────────────────────────────────────────
  { name: 'Americano Coffee', matchKeys: ['Americano Coffee'], category: 'cafe', linkTo: 'Americano Coffee', initial: 'A', color: '#6f4e37' },
  { name: 'The Orange Coffee', matchKeys: ['Orange Coffee'], category: 'cafe', linkTo: 'Orange Coffee', initial: 'O', color: '#f97316' },
  { name: 'Tamba Coffee', matchKeys: ['Tamba Coffee'], category: 'cafe', linkTo: 'Tamba Coffee', initial: 'T', color: '#8b4513' },
  { name: 'Seven Coffee', matchKeys: ['Seven Coffee'], category: 'cafe', linkTo: 'Seven Coffee', initial: 'S', color: '#4a2c2a' },
  { name: 'Trung Nguyên E-Coffee', matchKeys: ['Trung Nguyên E Coffee', 'Trung Nguyên E-Coffee'], category: 'cafe', linkTo: 'Trung Nguyên E Coffee', initial: 'T', color: '#7a3e10' },

  // ── Bakery ─────────────────────────────────────────────────
  { name: 'BreadTalk', matchKeys: ['Breadtalk'], category: 'bakery', linkTo: 'Breadtalk', initial: 'B', color: '#c0392b' },

  // ── Cửa hàng tiện lợi ──────────────────────────────────────
  { name: 'GS25', matchKeys: ['Gs 25', 'GS25', 'GS 25'], category: 'convenience', linkTo: 'GS25', initial: 'G', color: '#00a651' },

  // ── Giao hàng / Dịch vụ ────────────────────────────────────
  { name: 'SPX Express', matchKeys: ['Spx Express', 'SPX EXPRESS'], category: 'delivery', linkTo: 'SPX Express', initial: 'S', color: '#ee4d2d' },
  // 2026-09-10 사용자 지시로 수정: 단독 'GSM'은 통신 업계 범용 용어(예: "GSM
  // 기지국 기술자")와 겹칠 위험이 있어 matchKey·linkTo 모두 실제 회사명
  // 고유 부분("Xanh Và Thông Minh GSM")만 쓰도록 변경 — 브랜드를 고유하게
  // 식별 가능한 2단어 이상 문구만 사용한다.
  { name: 'Xanh SM (GSM)', matchKeys: ['Xanh Và Thông Minh GSM'], category: 'delivery', linkTo: 'Xanh Và Thông Minh GSM', initial: 'X', color: '#00b14f' },
  { name: 'Shopee', matchKeys: ['Shopee'], category: 'delivery', linkTo: 'Shopee', domain: 'shopee.vn', initial: 'S', color: '#ee4d2d' },
]

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
export function computeBrandCounts(jobs: Job[]): BrandWithCount[] {
  return BRAND_DIRECTORY
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
