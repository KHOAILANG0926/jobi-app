/**
 * 모바일 메인 칸 — Lee 2026-11-02 결정(알바몬 모바일 구성 참고, 우리는 유료가 없어 규칙으로 채움).
 * 순서: ① 급여 높은 공고(월로 바꾼 기본급 ≥ 7triệu) ② 특별한 공고(기숙사·통근버스·식사 중 2개 이상) ③ 실시간 공고(최신순, 더보기).
 * 한 공고는 ①② 중 한 칸에만(① 우선). ③은 전체 최신순이라 ①②의 공고도 다시 나올 수 있다. 빈 칸은 숨긴다.
 * 기본급: 범위는 낮은 쪽, 일급 × 26일, 시급 × 8시간 × 26일. 금액을 못 읽는 공고(직무별 급여 등)는 ①에 넣지 않는다.
 * 브랜드 칸은 메뉴(Thương hiệu)에 있으므로 모바일 메인에서는 뺀다(브랜드 공고가 늘면 다시 정함).
 */
import type { Job } from '../types/job'
import { cardSalary } from './mainJobCards.ts'
import { payValue } from './homeSections.ts'

export const HIGH_PAY_MONTHLY = 7_000_000
export const WORK_DAYS = 26
export const WORK_HOURS = 8

/** 카드 급여를 월 금액(đồng)으로. 못 읽으면 null. */
export function monthlyBasePay(job: Pick<Job, 'salary' | 'salaryPeriod'> & Partial<Pick<Job, 'description'>>): number | null {
  const card = cardSalary(job)
  if (!card || card.lines) return null
  const v = payValue(card.text)
  if (v == null) return null
  if (card.kind === 'hour') return v * WORK_HOURS * WORK_DAYS
  if (card.kind === 'day') return v * WORK_DAYS
  if (card.kind === 'month') return v
  return null
}

const benefitCount = (j: Job) => [j.shuttleBus, j.dormitory, j.mealProvided].filter((v) => v === true).length

export interface MobileHomeSections { highPay: Job[]; special: Job[]; live: Job[] }

export function mobileHomeSections(jobs: Job[]): MobileHomeSections {
  const pay = new Map(jobs.map((j) => [j.id, monthlyBasePay(j)]))
  const highPay = jobs.filter((j) => (pay.get(j.id) ?? 0) >= HIGH_PAY_MONTHLY)
    .sort((a, b) => (pay.get(b.id) ?? 0) - (pay.get(a.id) ?? 0))
  const used = new Set(highPay.map((j) => j.id))
  const special = jobs.filter((j) => !used.has(j.id) && benefitCount(j) >= 2)
  const live = [...jobs].sort((a, b) => String(b.postedAt).localeCompare(String(a.postedAt)))
  return { highPay, special, live }
}
