/**
 * 상세 'Thông tin tuyển dụng' 배치 — 2026-11-01 Lee: 칸을 미리 왼쪽·오른쪽으로 나누지 않고
 * 항목에 순번을 매겨 1(왼쪽) 2(오른쪽) 3(다음 줄 왼쪽) … 순서로 채운다. 없는 항목은 건너뛰어 빈칸이 생기지 않는다.
 * 순번: 직무 → 10-30 확정 ② 모집조건 순서(마감·인원·나이·성별·학력·경력·기타 요구) → 확정안 밖 항목.
 */
export const RECRUIT_ORDER = [
  'roles',
  'deadline', 'numHires', 'age', 'sourceEligibility', 'gender', 'education', 'preference', 'otherReq',
  'docs', 'language', 'trip', 'category',
]

export function recruitOrdered<T extends { key: string }>(fields: T[]): T[] {
  const rank = (k: string) => { const i = RECRUIT_ORDER.indexOf(k); return i < 0 ? RECRUIT_ORDER.length : i }
  return fields.map((f, i) => ({ f, i })).sort((a, b) => rank(a.f.key) - rank(b.f.key) || a.i - b.i).map(({ f }) => f)
}
