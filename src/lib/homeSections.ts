/**
 * 메인 화면 칸 나누기 — Lee 2026-11-01 (알바몬 구성을 따라감, 광고가 아니라 규칙으로 채움).
 * 순서: ① Việc làm đặc biệt(특별한 알바, 맨 위) ② Việc làm nổi bật(주목받는 알바, 나머지 전부) ③ Thương hiệu tuyển dụng(브랜드 알바).
 *       한 공고는 한 칸에만 나온다(같은 공고 두 번 금지). ①②③이 모든 공고를 담으므로 '전체' 칸은 결과가 없을 때 안내만.
 * ① 특별: 기숙사·통근버스·식사 중 2개 이상, 또는 같은 업종·같은 지급 단위 공고 중간 급여보다 20% 이상 높음(그 묶음이 3개 이상일 때만 비교).
 * ③ 브랜드: 브랜드 목록(job_brands, 공식 출처로 지점 3곳 이상 확인된 체인만 등록)과 업체 이름이 맞는 공고.
 * 빈 칸은 화면에서 숨긴다. 카드 모양은 승인된 JobCard 그대로.
 */
import type { Job } from '../types/job'
import { jobMatchesBrand, type BrandDefinition } from '../data/brandDirectory'

export const HOME_SECTION_TITLES = { special: 'Việc làm đặc biệt', featured: 'Việc làm nổi bật', brand: 'Thương hiệu tuyển dụng' } as const

export const HIGH_PAY_RATIO = 1.2
const MIN_GROUP = 3

/** 카드 급여 글자에서 첫 금액을 원(đồng) 단위 숫자로(같은 단위끼리만 비교한다). 금액을 못 읽으면 null. */
export function payValue(salary: string | null | undefined): number | null {
  const m = String(salary ?? '').match(/(\d+(?:[.,]\d+)*)\s*(triệu|tr\b|k\b|nghìn|đ|vnđ|vnd|đồng)?/iu)
  if (!m) return null
  // 범위("8 - 18 triệu")는 앞 숫자 뒤에 단위가 없으므로 뒤에 나오는 첫 단위를 쓴다.
  const unit = (m[2] ?? String(salary).slice((m.index ?? 0) + m[0].length).match(/triệu|tr\b|k\b|nghìn|vnđ|vnd|đồng|đ/iu)?.[0] ?? '').toLowerCase()
  const raw = m[1]
  // "5.500.000" / "23.000" = 천 단위 점, "8.5"(triệu) = 소수점
  const thousandDots = /^\d{1,3}(?:[.,]\d{3})+$/.test(raw)
  const n = Number(thousandDots ? raw.replace(/[.,]/g, '') : raw.replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return null
  if (unit === 'triệu' || unit === 'tr') return n * 1_000_000
  if (unit === 'k' || unit === 'nghìn') return n * 1_000
  return n >= 1000 ? n : null
}

const benefitCount = (j: Job) => [j.shuttleBus, j.dormitory, j.mealProvided].filter((v) => v === true).length

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** 같은 업종·같은 지급 단위 묶음의 중간 급여보다 20% 이상 높은 공고 id. */
export function highPayIds(jobs: Job[]): Set<string> {
  const groups = new Map<string, Array<{ id: string; v: number }>>()
  for (const j of jobs) {
    const v = payValue(j.salary)
    if (v == null || !j.salaryPeriod || j.salaryPeriod === 'other') continue
    const key = `${j.category}|${j.salaryPeriod}`
    groups.set(key, [...(groups.get(key) ?? []), { id: j.id, v }])
  }
  const out = new Set<string>()
  for (const list of groups.values()) {
    if (list.length < MIN_GROUP) continue
    const med = median(list.map((x) => x.v))
    for (const x of list) if (x.v >= med * HIGH_PAY_RATIO) out.add(x.id)
  }
  return out
}

export interface HomeSections { special: Job[]; featured: Job[]; brand: Job[]; all: Job[] }

export function homeSections(jobs: Job[], brands: BrandDefinition[]): HomeSections {
  const highPay = highPayIds(jobs)
  const special = jobs.filter((j) => benefitCount(j) >= 2 || highPay.has(j.id))
  const used = new Set(special.map((j) => j.id))
  const brand = jobs.filter((j) => !used.has(j.id) && brands.some((b) => jobMatchesBrand(j, b)))
  for (const j of brand) used.add(j.id)
  const featured = jobs.filter((j) => !used.has(j.id))
  return { special, featured, brand, all: jobs }
}
