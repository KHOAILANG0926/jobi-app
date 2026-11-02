/**
 * 식사 혜택 — Lee 2026-11-02 "식사 제공이나 식비 제공이나 무슨 차이": 식비 수당도 "Ăn ca" 아이콘을 켜고,
 * 밥을 주는지 돈을 주는지는 이름으로 구분한다(원문에 식비 수당 낱말만 있으면 "Phụ cấp ăn").
 * 낱말 규칙 한 곳: 공고 검사(jobInspect BENEFIT_HINTS)·AI 판정 확인(aiClassifyGuard)·화면 이름(상세·태그·배지)이 같이 쓴다.
 */
import { bare } from './jobDetailSections.ts'

/** 식비 수당(돈): phụ cấp ăn (uống/trưa/ca), trợ cấp ăn, hỗ trợ tiền ăn, tiền ăn. */
const ALLOWANCE = /\b(?:phu cap|tro cap|ho tro tien|tien) an(?: uong| trua| ca| com)?\b/g
/** 식사 제공(밥): ăn ca, bữa ca, bữa ăn, cơm trưa, cơm ca, bao ăn, ăn trưa, hỗ trợ ăn. */
const PROVIDED = /\b(?:an ca|bua ca|bua an|com trua|com ca|bao an|an trua|ho tro an)\b/

/** 공고 칸 meal_provided를 원문 단어로 확인하는 규칙(식사 제공 + 식비 수당). */
export const MEAL_HINT = /\b(?:an ca|bua ca|bua an|com trua|ho tro an|bao an|an trua|phu cap an|tro cap an|ho tro tien an|tien an)\b/

/** 원문에 식비 수당만 있고 식사 제공 낱말이 없으면 true(화면 이름 "Phụ cấp ăn"). */
export function mealIsAllowance(text: string | null | undefined): boolean {
  const t = bare(String(text ?? ''))
  if (!t.match(ALLOWANCE)) return false
  return !PROVIDED.test(t.replace(ALLOWANCE, ' '))
}

export const mealLabel = (text: string | null | undefined, provided = 'Ăn ca') => mealIsAllowance(text) ? 'Phụ cấp ăn' : provided
