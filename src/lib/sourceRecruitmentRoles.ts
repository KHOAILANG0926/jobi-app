import { sourceLines, fold } from './jobDetailSections.ts'

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
    // 2026-11-01: 상세요강을 원문에서 다시 만들면 원문 소제목(Vị trí tuyển dụng)이 빠진다(#5157 직무 행 사라짐).
    // 소제목이 없어도 "Nhân viên … Fulltime/Partime"처럼 고용형태가 붙은 직무 문장은 원문 그대로 직무로 본다.
    const explicitRole = /^(?:nhan vien|nv)\s+\S.*\b(?:full\s*[- ]?time|part\s*[- ]?time|partime)\b/.test(normalized)
    if (!insideRoles && !explicitRole) continue
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
