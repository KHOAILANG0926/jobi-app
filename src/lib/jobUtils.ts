import type { Job } from '../types/job'
import { withJobCoordinates } from './jobCoords.ts'

export type ApplyRoute =
  | { mode: 'internal' }
  | { mode: 'external'; url: string }
  | { mode: 'unavailable' }

/**
 * 2026-09-15: 크롤링 출처(employer_id 없음) 공고는 내부 지원(applications
 * insert)을 만들어도 조회할 owner가 없는 "고아 지원"이 되고, RLS
 * (applications_insert 정책, employer_id IS NOT NULL 요구)가 실제로 막는다 —
 * 원문 사이트(source_url)로 보내는 게 맞는 동작이다. 이 판정을 JobDetail.tsx와
 * useApply.ts 두 곳에 각각 복제해뒀다가 한쪽만 고치면 다시 어긋날 위험이
 * 있어(2026-09-15 실제로 useApply.ts만 이 판정이 없어 발생한 결함을 수정한
 * 직후 발견) 하나로 합쳤다.
 */
export function resolveApplyRoute(job: Pick<Job, 'employerId' | 'sourceUrl' | 'description'>): ApplyRoute {
  if (job.employerId) return { mode: 'internal' }
  const url = job.sourceUrl || (job.description?.startsWith('http') ? job.description : undefined)
  return url ? { mode: 'external', url } : { mode: 'unavailable' }
}

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
