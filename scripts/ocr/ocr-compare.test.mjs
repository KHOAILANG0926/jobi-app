import assert from 'node:assert/strict'
import { compareWithOcr, moneyValues, posterSalaryEvidence, canRepublish } from './ocr-compare.mjs'

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
const j0 = { occupation_code: '82022', occupation_evidence: 'làm linh kiện tai nghe', source_text: 'CTY KDA tuyển làm linh kiện tai nghe', origin: 'crawler', publish_gate_reason: 'ok', admin_hidden: false, created_at: '2026-10-14T01:00:00Z', application_deadline: null }
assert.equal(canRepublish(j0, '2026-10-15'), true)
assert.equal(canRepublish({ ...j0, publish_gate_reason: 'no_verified_coordinate' }, '2026-10-15'), false)
assert.equal(canRepublish({ ...j0, publish_gate_reason: null }, '2026-10-15'), false)
assert.equal(canRepublish({ ...j0, admin_hidden: true }, '2026-10-15'), false)
assert.equal(canRepublish({ ...j0, created_at: '2026-09-01T00:00:00Z' }, '2026-10-15'), false)
assert.equal(canRepublish({ ...j0, application_deadline: '2026-10-01' }, '2026-10-15'), false)
// admin 공고: publish_gate_reason이 NULL이어도 재공개 가능, 나머지 조건은 동일
const ja = { ...j0, origin: 'admin', publish_gate_reason: null }
assert.equal(canRepublish(ja, '2026-10-15'), true)
assert.equal(canRepublish({ ...ja, admin_hidden: true }, '2026-10-15'), false)
assert.equal(canRepublish({ ...ja, created_at: '2026-09-01T00:00:00Z' }, '2026-10-15'), false)
assert.equal(canRepublish({ ...ja, application_deadline: '2026-10-01' }, '2026-10-15'), false)

assert.equal(canRepublish({ ...ja, occupation_code: null }), false, 'unclassified admin must not republish');
assert.equal(canRepublish({ ...ja, occupation_evidence: '' }), false, 'missing duty evidence must not republish');
assert.equal(canRepublish({ ...ja, source_text: 'Làm trên ĐT + Máy tính' }), false, 'evidence absent from source must not republish');
// 2026-10-18: 세부 코드 미확정(1단계 코드)만으로 재공개를 막지 않는다 — 실제 #4828 사례
assert.equal(canRepublish({ ...ja, occupation_code: '8', occupation_evidence: 'Sản xuất dây truyền dữ liệu, dây mạng', source_text: 'CÔNG VIỆC\nSản xuất dây truyền dữ liệu, dây mạng.' }, '2026-10-18'), true, 'level-1 code with source evidence may republish');
console.log('ocr-compare: all assertions passed')

// Highlands: the post body has employer/contact; the poster may only show wages.
// Absence of a body-backed value on the poster is NOT an OCR contradiction.
{
  const body = 'HIGHLANDS COFFEE TÌM ĐỒNG ĐỘI\nĐịa điểm: Số 395 Ngô Gia Tự\nCửa hàng: Highlands Coffee Mường Thanh Bắc Ninh\nLiên hệ Mr Tuấn Minh: 0365102703\nThu nhập cạnh tranh'
  const poster = 'PHA CHẾ PARTTIME\n26K/giờ\nFULLTIME 7-9 triệu/tháng'
  const job = { source_text: body, company: 'Highlands Coffee Mường Thanh Bắc Ninh',
    employer_phone: '0365102703', contact_name: 'Tuấn Minh', salary: 'Thu nhập cạnh tranh' }
  assert.deepEqual(posterSalaryEvidence(poster), ['26K/giờ', '7-9 triệu/tháng'], 'wage figures must be verbatim poster evidence')
  assert.deepEqual(compareWithOcr(job, poster).mismatches.map(m => m.field), ['salary'],
    'competitive wording alone does not replace poster numeric wages')
  const populated = { ...job, salary: 'Theo poster: 26K/giờ · 7-9 triệu/tháng' }
  assert.deepEqual(compareWithOcr(populated, poster), { status: 'ok', mismatches: [] },
    'body-backed contact and poster-backed wages match separate sources')
  assert.deepEqual(compareWithOcr({ ...job, salary: '15 triệu' }, poster).mismatches.map(m => m.field),
    ['salary'], 'unsupported salary still held when absent from both sources')
}

assert.deepEqual(posterSalaryEvidence('Số 395 Ngô Gia Tự, 0365102703'), [], 'never infer wage from address or phone')
