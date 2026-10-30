import assert from 'node:assert/strict'
import { hasLocationClue } from './locationReviewClue'

// 회사명도 번지도 없음(동 이름만) → 단서 없음
assert.equal(hasLocationClue('', ['Khu phố Mao Yên, phường Phương Liễu, Bắc Ninh']), false)
assert.equal(hasLocationClue('Nhà tuyển dụng Facebook', ['Phường Phương Liễu, Bắc Ninh']), false)
// 회사명 있음 → 관리자가 회사명으로 찾을 수 있음
assert.equal(hasLocationClue('Bomunttl', ['Ngô Tất Tố - TP. Bắc Ninh']), true)
// 회사명 없어도 번지+도로명 있음
assert.equal(hasLocationClue('', ['33 Lý Thái Tổ, Kinh Bắc, Bắc Ninh']), true)
console.log('locationReviewClue tests passed')
