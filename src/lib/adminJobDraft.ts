import type { Job } from '../types/job'
import { readCompany } from './companyReader'
import { readAddress } from './addressReader'
import { readSalary } from './salaryReader'
import { phonesIn } from './jobDescriptionBuild'
import { classifyOccupation } from './occupationReader.mjs'

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

/** 관리자 '원문 붙여 넣기 → 자동 채우기'(#701 D, 2026-11-26): 수집기·등록 입구가 쓰는 공통 판독기로만 채운다(AI·새 서버 없음).
 *  예전에는 브라우저가 열쇠 없이 AI 회사 주소를 직접 불러 늘 실패했다. 원문에 없는 값은 비워 둔다(추정 금지) — 관리자가 확인·수정 뒤 저장.
 *  직업코드는 원문 근거가 있을 때만(수집기와 같은 규칙 파일), 근거는 원문 글자 그대로 — 저장 때 DB 공개 판정(R8)이 다시 확인한다. */
export function readAdminPost(text: string): Partial<Omit<Job, 'id'>> {
  const source = String(text ?? '').normalize('NFC')
  const title = source.split('\n').map((l) => l.trim()).find(Boolean) ?? ''
  const phone = source.split('\n').flatMap(phonesIn)[0] ?? ''
  const occupation = classifyOccupation(title, source)
  return {
    title,
    company: readCompany(source).name,
    location: readAddress(source),
    salary: readSalary(source)?.salary ?? '',
    employerPhone: phone,
    description: source.trim(),
    ...(occupation ? { occupationCode: occupation.occupation_code, occupationEvidence: occupation.occupation_evidence } : {}),
  }
}
