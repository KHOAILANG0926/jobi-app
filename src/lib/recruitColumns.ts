/**
 * 상세 'Thông tin tuyển dụng' 두 칸 나누기.
 * 왼쪽: 마감·인원·나이·성별·대상·업종(업종은 모바일 전용), 오른쪽: 나머지.
 * 2026-11-01 Lee: 왼쪽에 PC에서 보이는 항목이 없으면 빈칸으로 두지 않고 오른쪽 항목을 왼쪽으로 옮긴다. 빈 칸은 그리지 않는다.
 */
const LEFT = ['deadline', 'numHires', 'age', 'gender', 'sourceEligibility', 'category']
const MOBILE_ONLY = ['category']

export function recruitColumnsOf<T extends { key: string }>(fields: T[]): T[][] {
  const left = fields.filter((f) => LEFT.includes(f.key))
  const right = fields.filter((f) => !LEFT.includes(f.key))
  const leftShownOnPc = left.some((f) => !MOBILE_ONLY.includes(f.key))
  const columns = leftShownOnPc ? [left, right] : [[...right, ...left]]
  return columns.filter((c) => c.length > 0)
}
