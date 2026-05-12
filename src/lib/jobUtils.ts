import type { Job } from '../types/job'
import { withJobCoordinates } from './jobCoords'

export function ensureJobFields(j: Job): Job {
  const text = `${j.title} ${j.description}`.toLowerCase()
  const inferredUrgent = text.includes('tuyển gấp') || text.includes('gấp')
  return withJobCoordinates({
    ...j,
    employerPhone: j.employerPhone?.trim() || '0900 000 000',
    applicationDeadline: j.applicationDeadline || j.postedAt,
    urgent: j.urgent ?? inferredUrgent,
  })
}

export function formatDeadlineVi(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''))
  if (Number.isNaN(d.getTime())) return iso
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

export function zaloMeUrl(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits ? `https://zalo.me/${digits}` : 'https://zalo.me/'
}
