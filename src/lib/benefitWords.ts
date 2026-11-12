/**
 * 복리후생(셔틀·기숙사·식사) 원문 낱말 규칙 — 한 곳(#728 S7, Lee 2026-11-12 "중복·덮어쓰기·잘못된 판단 해결").
 * 전에는 낱말표(BENEFIT_HINTS)가 검사 파일(jobInspect)에 있고 AI 답을 거르는 만드는 쪽(aiClassifyGuard)이 그것을 가져다 써서
 * 방향이 거꾸로였고, 낱말이 빠지면 AI는 맞게 읽었는데 버려지고 검사도 같이 통과했다(5421 "Bao ăn ở" 숙식 제공).
 * 낱말 규칙은 여기서만 고친다. 식사는 mealBenefit.ts(식비 수당 구분)와 같은 규칙을 그대로 다시 내보낸다.
 */
import { MEAL_HINT } from './mealBenefit.ts'

export const SHUTTLE_HINT = /\b(?:xe dua don|xe dua ruoc|xe don|dua don)\b/
/** 기숙사·무료 숙소. "Bao ăn ở"/"Bao ở"/"Hỗ trợ ăn ở"(숙식 제공)도 기숙사 혜택이다(2026-11-12 #728 5421). */
export const DORMITORY_HINT = /\b(?:ky tuc xa|ktx|cho o mien phi|bo tri (?:cho )?an o|(?:bao|ho tro) (?:an )?o(?![^\n]{0,30}(?:\d[\d.,]*\s*(?:d|vnd|k|tr|trieu|nghin|ngan)\b|tien mat))|cho o)\b/
export { MEAL_HINT }

export const BENEFIT_WORDS: Array<{ key: 'shuttle_bus' | 'dormitory' | 'meal_provided'; label: string; re: RegExp }> = [
  { key: 'shuttle_bus', label: 'Xe đưa đón', re: SHUTTLE_HINT },
  { key: 'dormitory', label: 'Ký túc xá', re: DORMITORY_HINT },
  // 2026-11-02 Lee: 식비 수당(phụ cấp ăn uống 등)도 식사 혜택 — 낱말 규칙 한 곳(lib/mealBenefit.ts).
  { key: 'meal_provided', label: 'Ăn ca', re: MEAL_HINT },
]
