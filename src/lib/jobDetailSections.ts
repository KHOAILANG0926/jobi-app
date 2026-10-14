/**
 * Lossless source-description layout. Every nonblank source line, including
 * headings, bullet punctuation and repeated lines, appears exactly once.
 * Classification changes only the bucket; it never edits the source text.
 */
export const DETAIL_LABELS = {
  '01': 'Nội dung công việc',
  '02': 'Yêu cầu ứng viên',
  '03': 'Thời gian và hình thức làm việc',
  '04': 'Thu nhập và phụ cấp',
  '05': 'Phúc lợi và môi trường làm việc',
  '06': 'Quy trình tuyển dụng',
  '07': 'Thông tin bổ sung',
  '08': 'Hình ảnh tuyển dụng',
} as const
export type DetailKey = keyof typeof DETAIL_LABELS
export type DetailTextKey = Exclude<DetailKey, '08'>
export interface DetailSection { key: DetailTextKey; label: string; lines: string[] }
const ORDER: DetailTextKey[] = ['01', '02', '03', '04', '05', '06', '07']

// Normalize ONLY for classification. Never emit normalized strings.
function fold(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase()
}
function classify(line: string, current: DetailTextKey): DetailTextKey {
  const s = fold(line).replace(/^\s*[-•*]\s*/, '').trim()
  if (/^(?:cong viec|mo ta cong viec|noi dung cong viec)\s*:?$/.test(s)) return '01'
  if (/^(?:yeu cau|yeu cau tuyen dung|yeu cau ung vien)\s*:?$/.test(s)) return '02'
  if (/^(?:luong va phuc loi|luong|luong thuong|quyen loi|phuc loi)\s*:?$/.test(s)) return '04'
  if (/^(?:thoi gian lam viec|hinh thuc lam viec|lich lam viec)\s*:?$/.test(s)) return '03'
  if (/^(?:quy trinh tuyen dung|ho so ung tuyen|cach ung tuyen)\s*:?$/.test(s)) return '06'
  if (/^(?:dia diem lam viec|lien he|thong tin khac|ghi chu)\s*:?$/.test(s)) return '07'
  if (/^(?:ca ngay|ca dem|luong|thuong|chuyen can|phu cap|tro cap|muc luong)\b/.test(s)) return '04'
  if (/^(?:co xe dua don|duoc mang dien thoai|co ky tuc xa|co bua an|ho tro an|phuc loi|bao hiem)\b/.test(s)) return '05'
  if (/^(?:gio lam viec|thoi gian lam viec|ngay lam|tang ca|lam them)\b/.test(s)) return '03'
  if (/^(?:phong van|nop ho so|quy trinh tuyen dung)\b/.test(s)) return '06'
  // Source lines outside a recognized context belong to Additional Information.
  return current
}
export function sourceLines(description: string | null | undefined): string[] {
  if (!description) return []
  return description.split(/\r\n|\n|\r/).filter(line => line.trim().length > 0)
}
function signature(lines: string[]): string {
  // Count repeated lines rather than deduplicating; order may change by grouping.
  return JSON.stringify([...lines].sort())
}
export function verifyDescriptionPreserved(original: string | null | undefined, sections: Pick<DetailSection, 'lines'>[]): boolean {
  return signature(sourceLines(original)) === signature(sections.flatMap(section => section.lines))
}
export interface DetailResult { sections: DetailSection[]; preserved: boolean; usedFallback: boolean }
export function detailSections(description: string | null | undefined): DetailResult {
  const lines = sourceLines(description)
  if (!lines.length) return { sections: [], preserved: true, usedFallback: false }
  const buckets: Record<DetailTextKey, string[]> = { '01': [], '02': [], '03': [], '04': [], '05': [], '06': [], '07': [] }
  let current: DetailTextKey = '07'
  for (const line of lines) {
    const category = classify(line, current)
    // Explicit headings change context; detailed facts may be reclassified.
    const folded = fold(line).trim()
    if (/^(?:cong viec|mo ta cong viec|noi dung cong viec|yeu cau|yeu cau tuyen dung|yeu cau ung vien|luong va phuc loi|luong|luong thuong|quyen loi|phuc loi|thoi gian lam viec|hinh thuc lam viec|lich lam viec|quy trinh tuyen dung|ho so ung tuyen|cach ung tuyen|dia diem lam viec|lien he|thong tin khac|ghi chu)\s*:?$/.test(folded)) current = category
    buckets[category].push(line)
  }
  const sections = ORDER.filter(key => buckets[key].length).map(key => ({ key, label: DETAIL_LABELS[key], lines: buckets[key] }))
  if (!verifyDescriptionPreserved(description, sections)) {
    return { sections: [{ key: '07', label: DETAIL_LABELS['07'], lines }], preserved: false, usedFallback: true }
  }
  return { sections, preserved: true, usedFallback: false }
}
