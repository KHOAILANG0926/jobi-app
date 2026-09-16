import { normalizeViText } from './jobCoords.ts'
import type { Job } from '../types/job.ts'

type BrandLike = { matchKeys: string[] }

/**
 * "브랜드 후보" 탐지 — 등록된 브랜드(job_brands/job_brand_aliases)와 매칭되지
 * 않는 공고 중 체인/프랜차이즈 가능성이 있는 회사를 admin/Brands 화면에
 * 후보로 보여준다. 순수 파생 계산이라 별도 DB 테이블 없이 매번 useJobs()의
 * 실제 활성 공고를 다시 스캔한다(2026-09-10 사용자 지시: "불필요한 별도
 * 시스템을 만들지 말고 현재 구조에서 가장 단순하게 구현"). 하나의 키워드만
 * 으로 브랜드를 확정하지 않는다 — 동일 회사 공고 2건 이상을 1차 신호로 쓰고,
 * 지점/체인 표현은 참고용 배지로만 보여준다.
 */

const EXCLUDED_MANUFACTURER_KEYWORDS = [
  'samsung', 'lg electronics', 'lg display', 'lg innotek', 'foxconn', 'canon',
  'vinfast', 'vingroup', 'sei', 'goertek', 'luxshare', 'pegatron', 'panasonic',
  'bosch', 'yazaki', 'nidec', 'hansae', 'formosa', 'jabil',
]

// normalizeViText 결과(악센트 제거·소문자) 기준 — "hệ thống"/"chi nhánh"/
// "chuỗi"/"cửa hàng" 등 지점·체인 성격 표현.
const CHAIN_SIGNAL_RE = /he thong|chi nhanh|chuoi|cua hang/

// 현재 Thương hiệu 대상 업종(카페/패스트푸드/편의점/베이커리/배송·서비스)에
// 대응하는 Job.category만 후보 대상으로 본다 — factory/office/cleaning/other는
// 제조·사무직 위주라 애초에 대상에서 뺀다(제조 대기업 오탐 방지의 2차 안전장치).
const TARGET_JOB_CATEGORIES: Job['category'][] = ['cafe', 'restaurant', 'retail', 'delivery']

const MIN_POSTINGS = 2

export interface BrandCandidate {
  companyKey: string
  companyName: string
  jobCount: number
  sampleJob: Job
  locations: string[]
  chainSignal: boolean
}

function isAlreadyRegistered(job: Job, brands: BrandLike[]): boolean {
  return brands.some((b) =>
    b.matchKeys.some((key) => {
      const nk = normalizeViText(key)
      return normalizeViText(job.company).includes(nk) || normalizeViText(job.title).includes(nk)
    }),
  )
}

function isExcludedManufacturer(companyNorm: string): boolean {
  return EXCLUDED_MANUFACTURER_KEYWORDS.some((k) => companyNorm.includes(k))
}

export function detectBrandCandidates(
  jobs: Job[],
  brands: BrandLike[],
  dismissedKeys: Set<string>,
): BrandCandidate[] {
  const byCompany = new Map<string, Job[]>()
  for (const job of jobs) {
    if (!TARGET_JOB_CATEGORIES.includes(job.category)) continue
    if (isAlreadyRegistered(job, brands)) continue
    const key = normalizeViText(job.company)
    if (!key || isExcludedManufacturer(key) || dismissedKeys.has(key)) continue
    const list = byCompany.get(key) ?? []
    list.push(job)
    byCompany.set(key, list)
  }

  const candidates: BrandCandidate[] = []
  for (const [key, list] of byCompany) {
    if (list.length < MIN_POSTINGS) continue
    const locations = [...new Set(list.map((j) => j.location).filter((v): v is string => !!v))]
    const chainSignal = list.some((j) =>
      CHAIN_SIGNAL_RE.test(normalizeViText(`${j.title} ${j.description ?? ''}`)),
    )
    candidates.push({
      companyKey: key,
      companyName: list[0].company,
      jobCount: list.length,
      sampleJob: list[0],
      locations,
      chainSignal,
    })
  }
  return candidates.sort((a, b) => b.jobCount - a.jobCount)
}
