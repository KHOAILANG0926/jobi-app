import type { Job } from '../types/job'

export function parseAdminJobDraft(text: string, categories: readonly string[]): Partial<Omit<Job, 'id'>> {
  const value: unknown = JSON.parse(text)
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Bản nháp phải là một đối tượng JSON.')
  const input = value as Record<string, unknown>
  if (typeof input.title !== 'string' || !input.title.trim() || typeof input.company !== 'string' || !input.company.trim())
    throw new Error('Bản nháp cần tiêu đề và công ty.')
  const result: Record<string, unknown> = {}
  for (const key of ['title', 'company', 'salary', 'location', 'hours', 'employerPhone', 'applicationDeadline', 'description', 'imageUrl', 'workPeriod', 'workDays', 'education', 'preference', 'numHires']) {
    if (input[key] === undefined) continue
    if (typeof input[key] !== 'string') throw new Error(key + ': cần nội dung dạng chữ.')
    result[key] = input[key]
  }
  if (input.category !== undefined) {
    if (typeof input.category !== 'string' || !categories.includes(input.category)) throw new Error('Ngành nghề không hợp lệ.')
    result.category = input.category
  }
  for (const key of ['urgent', 'companyVerified']) {
    if (input[key] === undefined) continue
    if (typeof input[key] !== 'boolean') throw new Error(key + ': cần true hoặc false.')
    result[key] = input[key]
  }
  for (const key of ['lat', 'lng', 'companyFoundedYear', 'hireCount']) {
    if (input[key] == null) continue
    if (typeof input[key] !== 'number' || !Number.isFinite(input[key])) throw new Error(key + ': số không hợp lệ.')
    const number = input[key] as number
    if ((key === 'lat' && Math.abs(number) > 90) || (key === 'lng' && Math.abs(number) > 180)) throw new Error('Tọa độ không hợp lệ.')
    result[key] = number
  }
  if ((result.lat === undefined) !== (result.lng === undefined)) throw new Error('Cần cả vĩ độ và kinh độ.')
  return result as Partial<Omit<Job, 'id'>>
}

export function adminSavedJob(value: unknown) {
  if (!value || typeof value !== 'object') throw new Error('Máy chủ chưa trả về tin đã lưu.')
  const row = value as Record<string, unknown>
  if (typeof row.id !== 'number' || !Number.isSafeInteger(row.id) || row.id <= 0 || typeof row.active !== 'boolean' || typeof row.admin_hidden !== 'boolean')
    throw new Error('Chưa xác nhận được mã tin và trạng thái đã lưu. Kiểm tra danh sách trước khi lưu lại.')
  return { id: row.id, isPublic: row.active && !row.admin_hidden, href: '/viec-lam/sb-' + row.id }
}
