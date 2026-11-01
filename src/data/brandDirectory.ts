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

// 2026-11-01 Lee: 알바몬 "업직종별 브랜드" 구성을 따라 30개 업종(공장 제외 — 브랜드는 손님을 상대하는 체인점 기준).
// 옛 5개 값(fastfood·cafe·bakery·convenience·delivery)은 그대로 쓴다(기존 브랜드 불변). DB 검사: 20261101220000.
export const BRAND_CATEGORY_GROUPS = [
  { label: 'Ăn uống', ids: ['restaurant', 'family_buffet', 'fastfood', 'chicken_pizza', 'cafe', 'tea_dessert', 'bakery', 'beer_pub', 'lunch_meals'] },
  { label: 'Bán lẻ', ids: ['mall', 'supermarket', 'convenience', 'fashion', 'beauty_pharmacy', 'phone_electronics', 'furniture', 'books_stationery', 'fuel_carwash'] },
  { label: 'Dịch vụ', ids: ['hotel_spa', 'gym_sports', 'net_game', 'amusement', 'cinema_events', 'cleaning', 'repair', 'education'] },
  { label: 'Văn phòng', ids: ['call_center', 'finance_insurance'] },
  { label: 'Giao hàng', ids: ['delivery', 'warehouse'] },
] as const

export type BrandCategoryId = (typeof BRAND_CATEGORY_GROUPS)[number]['ids'][number]
export const BRAND_CATEGORY_IDS: BrandCategoryId[] = BRAND_CATEGORY_GROUPS.flatMap((g) => [...g.ids])

export const BRAND_CATEGORY_LABELS: Record<BrandCategoryId, string> = {
  restaurant: 'Nhà hàng · Quán ăn',
  family_buffet: 'Nhà hàng gia đình · Buffet',
  fastfood: 'Fast food',
  chicken_pizza: 'Gà rán · Pizza',
  cafe: 'Cà phê',
  tea_dessert: 'Trà sữa · Kem · Tráng miệng',
  bakery: 'Bánh · Bakery',
  beer_pub: 'Bia · Quán nhậu',
  lunch_meals: 'Cơm văn phòng · Đồ ăn sẵn',
  mall: 'Trung tâm thương mại',
  supermarket: 'Siêu thị',
  convenience: 'Cửa hàng tiện lợi',
  fashion: 'Thời trang · Phụ kiện · Trang sức',
  beauty_pharmacy: 'Mỹ phẩm · Nhà thuốc',
  phone_electronics: 'Điện thoại · Điện máy',
  furniture: 'Nội thất',
  books_stationery: 'Sách · Văn phòng phẩm',
  fuel_carwash: 'Xăng dầu · Rửa xe',
  hotel_spa: 'Khách sạn · Resort · Spa',
  gym_sports: 'Gym · Thể thao',
  net_game: 'Quán net · Game',
  amusement: 'Khu vui chơi',
  cinema_events: 'Rạp phim · Sự kiện',
  cleaning: 'Vệ sinh',
  repair: 'Sửa chữa · Bảo hành',
  education: 'Trung tâm ngoại ngữ · Giáo dục',
  call_center: 'Chăm sóc khách hàng · Tổng đài',
  finance_insurance: 'Tài chính · Bảo hiểm',
  delivery: 'Giao hàng · Shipper',
  warehouse: 'Kho · Logistics',
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
  const order: BrandCategoryId[] = BRAND_CATEGORY_IDS
  return order
    .map((id) => ({
      id,
      label: BRAND_CATEGORY_LABELS[id],
      brands: brandsWithCount.filter((b) => b.category === id).sort((a, b) => b.count - a.count),
    }))
    .filter((g) => g.brands.length > 0)
}

/** 2026-11-01 Lee(알바몬 업직종별 브랜드): 30개 업종 전부와 업종별 브랜드 공고 수(0 포함). */
export function brandIndustries(jobs: Job[], brands: BrandDefinition[]): Array<{ id: BrandCategoryId; label: string; count: number; brands: BrandWithCount[] }> {
  const all = brands.map((brand) => ({ ...brand, count: jobs.filter((j) => jobMatchesBrand(j, brand)).length }))
  return BRAND_CATEGORY_IDS.map((id) => {
    const list = all.filter((b) => b.category === id).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    return { id, label: BRAND_CATEGORY_LABELS[id], count: list.reduce((n, b) => n + b.count, 0), brands: list }
  })
}
