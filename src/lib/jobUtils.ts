import type { Job } from '../types/job'
import { withJobCoordinates } from './jobCoords.ts'

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
