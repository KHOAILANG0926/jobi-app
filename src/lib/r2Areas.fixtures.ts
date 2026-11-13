// R2(#753) 화면 영역 독립 기대값 — CLAUDE.md 10-30 확정 구성(승인된 4영역)에서 사람이 정한 "원문 줄 종류 → 표시되어도 되는 영역".
// 영역 제목은 승인된 화면의 제목 그대로: ① Điều kiện làm việc / ② Thông tin tuyển dụng / ③ Khu vực làm việc / ④ Mô tả công việc.
// 줄 종류(r2Oracle.fixtures.ts의 section 01~07)별 허용 영역:
//   01 업무 내용        → ④            (업무는 근무조건·모집조건·근무지역에 들어가면 안 됨)
//   02 모집 조건        → ② (원문 줄을 지우지 않고 ④에 남기는 것도 허용 — #653·KDA 기준 공고)
//   03 근무시간·요일·형태 → ① 또는 ④   (① Thời gian làm việc 칸, 칸이 이미 찼으면 ④ 끝에 지우지 않고 남김 — #653)
//   04 급여·수당·상여    → ① 또는 ④   (① Phụ cấp·Thưởng 칸, 3줄을 넘으면 ④)
//   05 복리후생·환경     → ① 또는 ④   (① Phúc lợi 칸, 원문 문장은 ④ Môi trường làm việc에 지우지 않고 남김 — #653)
//   06 지원 방법·연락처  → ④            (Quy trình tuyển dụng·Liên hệ)
//   07 그 밖(회사 소개 등) → ④
// 어느 영역에도 안 나오면 '빠짐', 허용 밖 영역에 나오면 '잘못된 칸'. 생산 코드(albamonCompose·detailSections)로 만든 값이 아니다.
export const AREA_TITLES = { '①': 'Điều kiện làm việc', '②': 'Thông tin tuyển dụng', '③': 'Khu vực làm việc', '④': 'Mô tả công việc' } as const
export type Area = keyof typeof AREA_TITLES
export const ALLOWED_AREAS: Record<'01' | '02' | '03' | '04' | '05' | '06' | '07', Area[]> = {
  '01': ['④'], '02': ['②', '④'],  '03': ['①', '④'], '04': ['①', '④'], '05': ['①', '④'], '06': ['④'], '07': ['④'],
}
