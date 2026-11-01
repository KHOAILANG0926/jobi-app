import { cardSalary, PAY_LABELS } from '../lib/mainJobCards'
import type { Job } from '../types/job'

/**
 * 급여 표시 한 곳 — 2026-11-01 Lee "수평 전개": 구직자에게 급여가 보이는 모든 화면(카드·모바일 목록·지도 창·추천·저장·최근 본·급구 표·지원 창·알림)이
 * 이 부품 하나로 같은 모양을 쓴다. 지급 단위 이름표 색(월급 빨강·시급/연봉 파랑·일급 보라) + 회색 금액, 한 줄.
 * 직무가 여럿이면 회색 "₫ Xem lương theo vị trí", 금액을 못 읽으면 원문 글자 그대로(회색).
 */
export default function SalaryText({ job, empty = '—' }: { job: Pick<Job, 'salary'> & Partial<Pick<Job, 'salaryPeriod' | 'description'>>; empty?: string }) {
  const s = cardSalary(job as Job)
  if (s && !s.lines) {
    const kind = s.kind ?? 'other'
    return <span className="pay">{kind !== 'other' && <><span className={`pay-label pay-label--${kind}`}>{PAY_LABELS[kind]}</span> </>}<span className="pay-amount">{s.text}</span></span>
  }
  if (s?.lines) return <span className="pay"><span className="pay-none">₫ Xem lương theo vị trí</span></span>
  const raw = String(job.salary ?? '').trim()
  return <span className="pay"><span className="pay-none">{raw || empty}</span></span>
}
