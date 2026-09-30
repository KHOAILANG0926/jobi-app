import type { Job } from '../types/job'
import { withJobCoordinates } from './jobCoords.ts'

export type ApplyRoute =
  | { mode: 'internal' }
  | { mode: 'unavailable' }

/**
 * 2026-09-15: 크롤링 출처(employer_id 없음) 공고는 내부 지원(applications
 * insert)을 만들어도 조회할 owner가 없는 "고아 지원"이 되고, RLS
 * (applications_insert 정책, employer_id IS NOT NULL 요구)가 실제로 막는다.
 * 2026-09-29 긴급 원복(사용자 지시): 지원 버튼이 원문 사이트(source_url)를 여는
 * 동작은 제거 — 크롤링 공고는 'unavailable'로 두고 사이트 안에서 지원 불가 사실과
 * 공고에 등록된 연락 방법만 보여준다. 판정은 JobDetail.tsx와 useApply.ts가 공유한다.
 */
export function resolveApplyRoute(job: Pick<Job, 'employerId'>): ApplyRoute {
  return job.employerId ? { mode: 'internal' } : { mode: 'unavailable' }
}

/**
 * 목록·상세의 지원 버튼 동작(2026-09-30) — 모든 화면이 이 하나의 기준을 쓴다.
 * - internal: 플랫폼 구인자 공고(employer_id 있음) → 로그인 → 내부 지원
 * - contact: 직접 연락형(employer_id 없음 + 공고에 적힌 전화/Zalo 있음) → 로그인 없이 내부 상세의 연락 안내
 * - none: 연락처 없는 크롤링 공고 → 지원 가능하다고 표시하지 않음
 * 외부 채용사이트로는 어떤 경우에도 보내지 않는다(CLAUDE.md '원본 채용사이트 연결 금지').
 */
export type ApplyAction = 'internal' | 'contact' | 'none'

export function resolveApplyAction(job: Pick<Job, 'employerId' | 'employerPhone' | 'zalo'>): ApplyAction {
  if (job.employerId) return 'internal'
  return job.employerPhone?.trim() || job.zalo?.trim() ? 'contact' : 'none'
}

/** 상세 페이지 연락 안내 위치(목록의 '연락 방법 보기'가 이 해시로 이동) */
export const JOB_CONTACT_HASH = 'lien-he'

export function ensureJobFields(j: Job): Job {
  const text = `${j.title} ${j.description}`.toLowerCase()
  const inferredUrgent = text.includes('tuyển gấp') || text.includes('gấp')
  return withJobCoordinates({
    ...j,
    salary:    j.salary?.trim()  || 'Thỏa thuận',
    location:  j.location?.trim() || 'Việt Nam',
    education: j.education?.trim() || 'Không yêu cầu',
    preference: j.preference?.trim() || 'Không yêu cầu kinh nghiệm',
    hours:     j.hours?.trim() || '',
    workDays:  j.workDays?.trim() || '',
    numHires:  j.numHires?.trim() || '',
    employerPhone: j.employerPhone?.trim() || '',
    applicationDeadline: j.applicationDeadline || '',
    urgent: j.urgent ?? inferredUrgent,
  })
}

export function formatDeadlineVi(iso: string | null | undefined): string {
  if (!iso) return 'Tuyển liên tục (Đến khi đủ)'
  const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''))
  if (Number.isNaN(d.getTime())) return 'Tuyển liên tục (Đến khi đủ)'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

export function zaloMeUrl(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits ? `https://zalo.me/${digits}` : 'https://zalo.me/'
}
