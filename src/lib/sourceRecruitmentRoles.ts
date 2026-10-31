import { sourceLines, fold } from './jobDetailSections'

/** Source-backed multi-role extraction. Never invent a role or assign one salary to all roles.
 * The original description remains untouched in Mô tả công việc. */
export function sourceRecruitmentRoles(description: string | null | undefined): { roles: string[]; workTypes: string[] } {
  if (!description) return { roles: [], workTypes: [] }
  const roles: string[] = []
  const workTypes: string[] = []
  let insideRoles = false
  for (const raw of sourceLines(description)) {
    const line = raw.trim().replace(/^[•*\-]\s*/, '').trim()
    const normalized = fold(line.replace(/^[^\p{L}\p{N}]+/u, '')).replace(/[:：\s]+$/g, '')
    if (/^(?:vi tri tuyen dung|vi tri can tuyen|cac vi tri tuyen dung)$/.test(normalized)) {
      insideRoles = true
      continue
    }
    if (insideRoles && /^(?:quyen loi|yeu cau|cach nop ho so|cach ung tuyen|lien he|dia diem|dia chi|khu vuc|thu nhap|luong|phuc loi)\b/.test(normalized)) {
      insideRoles = false
    }
    if (!insideRoles) continue
    // Employee roles are explicit statements, not free-form duties (e.g. "Pha chế thức uống").
    if (!/^(?:nhan vien|nv)\s+\S/.test(normalized) && !/^[A-ZÀ-ỸĐ\s]+\s*\((?:PARTTIME|FULLTIME)\)$/u.test(line)) continue
    const typeWords = line.match(/\b(?:full\s*[- ]?time|part\s*[- ]?time|partime|ban thoi gian|toan thoi gian)\b/giu) ?? []
    for (const word of typeWords) {
      const normalizedType = fold(word)
      const type = /^full|toan/.test(normalizedType) ? 'Fulltime' : 'Parttime'
      if (!workTypes.includes(type)) workTypes.push(type)
    }
    const role = line.replace(/\b(?:full\s*[- ]?time|part\s*[- ]?time|partime|ban thoi gian|toan thoi gian)\b/giu, '').replace(/[\s\-–]+$/g, '').trim()
    if (role && !roles.includes(role)) roles.push(role)
  }
  return { roles, workTypes }
}
