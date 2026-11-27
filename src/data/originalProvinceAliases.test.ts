// 낱말 표(originalProvinceAliases)가 경계 자료(originalProvinceBoundaries)의 aliases와 한 글자도 어긋나지 않게 지킨다.
// 카드 글자 정리가 가벼운 표를 쓰도록 떼어 낸 것이라, 경계 자료가 바뀌면 이 시험이 실패해 표를 다시 만들게 한다.
import { ORIGINAL_PROVINCES } from './originalProvinceBoundaries.ts'
import { ORIGINAL_PROVINCE_ALIASES } from './originalProvinceAliases.ts'

const expected = ORIGINAL_PROVINCES.flatMap((a) => a.aliases)
if (JSON.stringify(ORIGINAL_PROVINCE_ALIASES) !== JSON.stringify(expected)) {
  throw new Error('FAIL: originalProvinceAliases가 originalProvinceBoundaries의 aliases와 다름 — 표를 다시 만든다')
}
console.log('originalProvinceAliases: matches boundaries aliases (' + expected.length + ')')
