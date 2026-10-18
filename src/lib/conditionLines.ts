// 근무조건 칸 내용 규칙 (2026-10-18 Lee 결정)
// 1) 한 항목 = 한 줄. 쉼표(,)·세미콜론(;)에서만 나눈다. 원문 글자는 바꾸지 않는다(구두점도 그대로 남김).
//    숫자 사이 쉼표(예: 8,5 triệu)는 항목 구분이 아니므로 나누지 않는다.
// 2) 항목 중간에서 줄이 꺾이면 안 된다. 한 칸 최대 3줄.
// 3) 3줄을 넘거나 한 항목이 칸 폭에 한 줄로 안 들어가면 → 칸에는 'Xem thêm'만, 전체는 상세요강 해당 소제목에.
export const CONDITION_MAX_LINES = 3

export function conditionItems(text: string | null | undefined): string[] {
  if (!text) return []
  return text
    .split(/(?<=;)|(?<=,)(?!\d)/)
    .map((part) => part.trim())
    .filter(Boolean)
}

/** 상세요강 해당 소제목에 이미 같은 내용이 있는지(대소문자·성조·끝 구두점 무시). 없으면 칸 내용을 그곳에 보여 준다. */
export function itemsCoveredBy(items: string[], lines: string[]): boolean {
  const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()
    .replace(/[\s.,;:!]+$/g, '').replace(/\s+/g, ' ').trim()
  const hay = lines.map(fold)
  return items.every((item) => { const n = fold(item); return !n || hay.some((line) => line.includes(n)) })
}
