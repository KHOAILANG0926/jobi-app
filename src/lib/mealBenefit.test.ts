// 식비 수당도 식사 혜택(Lee 2026-11-02) — 실제 원문(#5299 Vua Nệm "Có phụ cấp ăn uống")으로 시험
import { MEAL_HINT, mealIsAllowance, mealLabel } from './mealBenefit.ts'
import { bare } from './jobDetailSections.ts'
function assert(ok: boolean, name: string) { if (!ok) throw new Error(name) }
assert(MEAL_HINT.test(bare('Có phụ cấp ăn uống')), '#5299 allowance counts as meal benefit')
assert(MEAL_HINT.test(bare('Bao ăn ca')) && MEAL_HINT.test(bare('Hỗ trợ tiền ăn 30k/ngày')), 'provided and allowance both match')
assert(!MEAL_HINT.test(bare('Thưởng Lễ, Tết, lương tháng 13')), 'bonus is not meal')
assert(mealIsAllowance('Có phụ cấp ăn uống') && mealLabel('Có phụ cấp ăn uống') === 'Phụ cấp ăn', 'allowance only → Phụ cấp ăn')
assert(!mealIsAllowance('Bao ăn trưa, phụ cấp ăn ca') && mealLabel('Bao ăn trưa') === 'Ăn ca', 'provided meal wins → Ăn ca')
assert(mealLabel('Phụ cấp ăn trưa 25k') === 'Phụ cấp ăn' && mealLabel(null, 'Bao ăn') === 'Bao ăn', 'phụ cấp ăn trưa is allowance; empty keeps default')
console.log('mealBenefit: allowance/provided labels passed')
