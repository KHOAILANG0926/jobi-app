/** Read-only projection: existing fields first, otherwise explicit source sentences.
 * Never changes the source or supplies guessed requirements. Shared by public, SSR and employer display paths. */
export function recruitmentSummary(row: Record<string, unknown>) {
  const text = (v: unknown) => typeof v === 'string' && v.trim() ? v.trim() : undefined
  const lines = String(row.description ?? '').split(/\r?\n/).map(l => l.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean)
  const one = (pattern: RegExp) => {
    const matches = [...new Set(lines.filter(l => pattern.test(l)))]
    return matches.length === 1 ? matches[0] : undefined
  }
  const age = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 14 && v <= 100 ? v : undefined
  const min = age(row.age_min), max = age(row.age_max)
  const bounds = min !== undefined && max !== undefined ? (min <= max ? `${min}–${max} tuổi` : undefined)
    : max !== undefined ? `Không quá ${max} tuổi` : min !== undefined ? `Từ ${min} tuổi` : undefined
  return {
    ageRequirement: text(row.age_requirement) ?? one(/^(?:(?:độ tuổi|tuổi)\s*[:：]|(?:không quá|dưới|trên|từ|tối đa|tối thiểu)\s+\d{2}.*tuổi)/iu) ?? bounds,
    preference: text(row.preference) ?? one(/^(?:(?:có|không(?:\s+yêu cầu)?|chưa có|ưu tiên(?:\s+(?:ứng viên|người))?\s+có)\s+kinh nghiệm\b|kinh nghiệm\s*[:：]|\d+\s*năm\s+kinh nghiệm)/iu),
    languageRequirement: text(row.language_requirement) ?? one(/^(?:giao tiếp|thành thạo|sử dụng|biết|yêu cầu|có khả năng)\s+tiếng\s+(?:Trung|Anh|Hàn|Nhật)\b/iu),
    requiredDocuments: text(row.required_documents) ?? one(/^(?:ứng viên\s+)?(?:(?:vui lòng|cần|phải)\s+)?(?:gửi|nộp|chuẩn bị)\s+(?:CV|hồ sơ)(?=\s|[.!,:;]|$)/iu),
  }
}
