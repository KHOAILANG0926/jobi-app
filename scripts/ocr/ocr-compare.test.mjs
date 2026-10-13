import assert from 'node:assert/strict'
import { compareWithOcr } from './ocr-compare.mjs'

const ocr = 'CÔNG TY KDA TUYỂN GẤP\nLiên hệ: NGOC ANH DUONG\nSĐT: 0877 880 756\nLương 8.000.000 - 12.000.000\nTuổi 14-50t'
const base = { employer_phone: '0877880756', contact_zalo: null, salary: '8.000.000 - 12.000.000', contact_name: 'NGOC ANH DUONG', company: 'KDA', age_min: 14, age_max: 50 }
assert.equal(compareWithOcr(base, ocr).status, 'ok')
// 성조·대소문자 차이는 통과(OCR이 성조를 놓치는 경우)
assert.equal(compareWithOcr({ ...base, contact_name: 'Ngọc Anh Dương' }, ocr).status, 'ok')
// 전화번호 한 자리 다름 → 그 항목만 어긋남
const r = compareWithOcr({ ...base, employer_phone: '0877880757' }, ocr)
assert.equal(r.status, 'mismatch'); assert.deepEqual(r.mismatches.map((m) => m.field), ['employer_phone'])
// "연령 확인 필요"로 바꿔 age를 못 옮긴 경우가 아니라, 값이 원문과 다른 경우
assert.deepEqual(compareWithOcr({ ...base, age_min: 18 }, ocr).mismatches.map((m) => m.field), ['age_min'])
assert.deepEqual(compareWithOcr({ ...base, salary: '15 triệu' }, ocr).mismatches.map((m) => m.field), ['salary'])
assert.equal(compareWithOcr(base, '').status, 'unreadable')
console.log('ocr-compare: all assertions passed')
