import assert from 'node:assert/strict'
import { compareWithOcr, moneyValues, canRepublish } from './ocr-compare.mjs'

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
// KDA 사례: 급여 "310.000đ" 과 OCR "310k/11h" 는 일치
const kda = { employer_phone: '0877880756', salary: '310.000đ', contact_name: 'NGOC ANH DUONG', company: 'KDA', age_min: 14, age_max: 50 }
const kdaOcr = 'CÔNG TY KDA TUYỂN GẤP NGOC ANH DUONG 08.778.807.56 Lương 310k/11h Tuổi 14-50t'
assert.deepEqual(compareWithOcr(kda, kdaOcr), { status: 'ok', mismatches: [] })
assert.equal(compareWithOcr({ ...kda, salary: '320.000đ' }, kdaOcr).status, 'mismatch')
assert.ok(moneyValues('310k').has(310000) && moneyValues('310.000').has(310000) && moneyValues('310 nghìn').has(310000))
assert.ok(moneyValues('8,5 triệu').has(8500000) && moneyValues('8 000 000').has(8000000) && !moneyValues('11h').size)
assert.equal(compareWithOcr(base, '').status, 'unreadable')
const j0 = { publish_gate_reason: 'ok', admin_hidden: false, created_at: '2026-10-14T01:00:00Z', application_deadline: null }
assert.equal(canRepublish(j0, '2026-10-15'), true)
assert.equal(canRepublish({ ...j0, publish_gate_reason: 'no_verified_coordinate' }, '2026-10-15'), false)
assert.equal(canRepublish({ ...j0, publish_gate_reason: null }, '2026-10-15'), false)
assert.equal(canRepublish({ ...j0, admin_hidden: true }, '2026-10-15'), false)
assert.equal(canRepublish({ ...j0, created_at: '2026-09-01T00:00:00Z' }, '2026-10-15'), false)
assert.equal(canRepublish({ ...j0, application_deadline: '2026-10-01' }, '2026-10-15'), false)
console.log('ocr-compare: all assertions passed')
