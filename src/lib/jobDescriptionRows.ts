// 상세요강(description) → "라벨 | 값" 행 (2026-10-07 알바몬식 개편).
// 제목 반복·소제목(YÊU CẦU/QUYỀN LỢI/## Mô tả …)은 제거하고, 남은 문장을 소제목 맥락에 따라 행으로 묶는다.
// 원문 문장은 고치지 않는다(분류·묶기만). 행이 하나도 없으면 호출부가 구역을 숨긴다.

export type DescRowKey = 'duty' | 'preferred' | 'otherReq' | 'environment' | 'other'
export interface DescRow { key: DescRowKey; label: string; lines: string[] }

export const DESC_ROW_LABELS: Record<DescRowKey, string> = {
  duty: 'Nội dung công việc',
  preferred: 'Ưu tiên',
  otherReq: 'Yêu cầu khác',
  environment: 'Quyền lợi · Môi trường làm việc',
  other: 'Thông tin khác',
}
const ORDER: DescRowKey[] = ['duty', 'preferred', 'otherReq', 'environment', 'other']

/** 소문자·성조 제거 — 소제목·제목 비교용 */
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

function sectionOf(heading: string): DescRowKey {
  const h = fold(heading)
  if (/(mo ta|cong viec|trach nhiem|nhiem vu)/.test(h)) return 'duty'
  if (/(yeu cau|doi tuong|ung vien|tieu chuan)/.test(h)) return 'otherReq'
  if (/(quyen loi|phuc loi|che do|moi truong)/.test(h)) return 'environment'
  return 'other'
}

const HEADING_RE = /^[A-ZÀ-Ỹ0-9 /&:-]{3,40}$/u
const BULLET_RE = /^[•\-–*·]\s+/

export function descriptionRows(description: string | null | undefined, title: string): DescRow[] {
  const text = (description ?? '').trim()
  if (!text || text.startsWith('http')) return []
  const titleKey = fold(title)
  const buckets: Record<DescRowKey, string[]> = { duty: [], preferred: [], otherReq: [], environment: [], other: [] }
  let current: DescRowKey = 'other'
  for (const rawLine of text.replace(/^\s*\[source:[^\]]*\]\s*/i, '').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    if (line.startsWith('## ')) { current = sectionOf(line.slice(3)); continue }
    // 소제목: 짧은 전부 대문자 줄(숫자 없음) — 맥락만 바꾸고 화면에는 내지 않는다
    if (HEADING_RE.test(line) && !/\d/.test(line) && line.split(' ').length <= 4) { current = sectionOf(line); continue }
    if (titleKey && fold(line) === titleKey) continue // 제목 반복
    const body = line.replace(BULLET_RE, '').trim()
    if (!body) continue
    const key: DescRowKey = current === 'otherReq' && /^ưu tiên\b/i.test(body) ? 'preferred' : current
    if (!buckets[key].includes(body)) buckets[key].push(body)
  }
  return ORDER.filter((k) => buckets[k].length > 0).map((k) => ({ key: k, label: DESC_ROW_LABELS[k], lines: buckets[k] }))
}
